/// <reference lib="webworker" />
// Kitten TTS off the main thread: downloads (once, then from Cache Storage) the model, voice
// table and runtime, then turns sentences into 24 kHz samples. Jobs run one at a time because an
// ONNX session cannot run concurrently; the engine keeps the queue short.
import { readNpz, type Matrix } from "./npz";
import {
  HOP,
  SAMPLE_RATE,
  type FromWorker,
  type Sources,
  type ToWorker,
} from "./protocol";
import { denoise, level } from "./denoise";
import { encode, wordStarts } from "./text";

declare const self: DedicatedWorkerGlobalScope;

// The two runtime libraries are fetched from a CDN at run time; only what this file calls is typed.
interface Tensor<T = Float32Array<ArrayBuffer>> {
  data: T;
}
interface Session {
  run(
    feeds: Record<string, unknown>,
  ): Promise<{ waveform?: Tensor; duration?: Tensor<BigInt64Array> }>;
}
interface Ort {
  env: {
    wasm: { wasmPaths?: string; wasmBinary?: ArrayBuffer; numThreads?: number };
  };
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
  InferenceSession: {
    create(model: ArrayBuffer, opts: object): Promise<Session>;
  };
}
interface KittenConfig {
  voice_aliases?: Record<string, string>;
}
interface Runtime {
  ort: Ort;
  session: Session;
  phonemize: (text: string) => Promise<string>;
  voices: Map<string, Matrix>;
  config: KittenConfig;
}

const CACHE = "lantun-voice-kitten-v1";
// The model pads every clip with a tail of silence (KittenTTS trims the same amount).
const TRIM_SAMPLES = 5000;
const LEAD_KEEP_SAMPLES = 1200;

const post = (msg: FromWorker, transfer: Transferable[] = []): void =>
  self.postMessage(msg, transfer);

let loaded = 0;
const counted = (n: number): void => {
  loaded += n;
  post({ type: "progress", loaded });
};

// Cache Storage first: a returning reader on the same site starts in a second, not a download.
const fetchCached = async (url: string): Promise<ArrayBuffer> => {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    counted(buf.byteLength);
    return buf;
  }
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    counted(value.length);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }
  await cache?.put(url, new Response(bytes)).catch(() => undefined);
  return bytes.buffer;
};

const load = async (src: Sources): Promise<Runtime> => {
  const [ort, ph, model, wasm, voices, config] = await Promise.all([
    import(/* @vite-ignore */ src.ort) as Promise<Ort>,
    import(/* @vite-ignore */ src.phonemizer) as Promise<{
      phonemize: (t: string, lang: string) => Promise<string[]>;
    }>,
    fetchCached(src.model),
    fetchCached(src.ortWasm),
    fetchCached(src.voices).then(readNpz),
    fetch(src.config).then((r) => r.json() as Promise<KittenConfig>),
  ]);
  // Handing over the binary we already cached stops the runtime downloading it a second time.
  ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.wasmPaths = src.ortWasm.slice(
    0,
    src.ortWasm.lastIndexOf("/") + 1,
  );
  // Threads need cross-origin isolation, which publisher pages rarely have.
  ort.env.wasm.numThreads = self.crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 1)
    : 1;
  const session = await ort.InferenceSession.create(model, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  // Runs of words repeat (and prev/seek replays them); espeak is cheap but not free.
  const seen = new Map<string, string>();
  const phonemize = async (run: string): Promise<string> => {
    const hit = seen.get(run);
    if (hit !== undefined) return hit;
    const out = (await ph.phonemize(run, "en-us"))
      .join(" ")
      .replace(/_/g, "")
      .replace(/\n/g, " ");
    if (seen.size > 5000) seen.clear();
    seen.set(run, out);
    return out;
  };
  return { ort, session, phonemize, voices, config };
};

const synth = async (
  rt: Runtime,
  text: string,
  voice: string,
  speed: number,
) => {
  const style = rt.voices.get(rt.config.voice_aliases?.[voice] ?? voice);
  if (!style) throw new Error(`Unknown voice ${voice}`);
  const { ids, words } = await encode(text, rt.phonemize);
  // The voice table holds one style vector per text length (as KittenTTS indexes it); longer
  // texts share the last.
  const row = Math.min(text.length, style.rows - 1);
  const { Tensor } = rt.ort;
  const out = await rt.session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), [
      1,
      ids.length,
    ]),
    style: new Tensor(
      "float32",
      style.data.slice(row * style.cols, (row + 1) * style.cols),
      [1, style.cols],
    ),
    speed: new Tensor("float32", new Float32Array([speed]), [1]),
  });
  const audio = out.waveform?.data;
  const durations = out.duration?.data;
  if (!audio || !durations) throw new Error("Model returned no audio");
  // The leading pad token is ~0.65 s of silence on every clip; between sentences it read as a
  // hesitation. Keep a short breath of it.
  const lead = Math.max(0, Number(durations[0] ?? 0) * HOP - LEAD_KEEP_SAMPLES);
  const starts = wordStarts(words, durations, HOP / SAMPLE_RATE).map((t) =>
    Math.max(0, t - lead / SAMPLE_RATE),
  );
  return {
    samples: level(
      denoise(
        audio.subarray(lead, Math.max(lead, audio.length - TRIM_SAMPLES)),
        SAMPLE_RATE,
      ),
      SAMPLE_RATE,
    ),
    starts,
  };
};

let runtime: Promise<Runtime> | null = null;
let queue: Extract<ToWorker, { type: "synth" }>[] = [];
let busy = false;

const pump = async (): Promise<void> => {
  if (busy || !runtime) return;
  busy = true;
  try {
    // Yield between jobs: synthesis blocks this thread, so without a macrotask break a 'drop'
    // sent during a job would only be read once the whole queue had run.
    for (
      let job = queue.shift();
      job;
      await new Promise((r) => setTimeout(r, 0)), job = queue.shift()
    ) {
      try {
        const rt = await runtime;
        const started = performance.now();
        const { samples, starts } = await synth(
          rt,
          job.text,
          job.voice,
          job.speed,
        );
        post(
          {
            type: "audio",
            id: job.id,
            samples,
            starts,
            ms: performance.now() - started,
          },
          [samples.buffer, starts.buffer],
        );
      } catch (err) {
        post({
          type: "error",
          id: job.id,
          message: String((err as Error)?.message ?? err),
        });
      }
    }
  } finally {
    busy = false;
  }
};

self.onmessage = (e: MessageEvent<ToWorker>): void => {
  const msg = e.data;
  if (msg.type === "load") {
    runtime ??= load(msg.sources);
    runtime.then(
      () => post({ type: "ready" }),
      (err: unknown) =>
        post({
          type: "error",
          message: String((err as Error)?.message ?? err),
        }),
    );
    void pump();
  } else if (msg.type === "synth") {
    queue.push(msg);
    void pump();
  } else {
    // The engine has already forgotten these; just do not spend time on them.
    const keep = new Set(msg.keep);
    queue = queue.filter((job) => keep.has(job.id));
  }
};
