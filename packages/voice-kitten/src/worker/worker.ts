/// <reference lib="webworker" />
// Kitten TTS off the main thread: downloads (once, then from Cache Storage) the model, voice table
// and runtime, then turns sentences into 24 kHz samples, one job at a time.
import { denoise, level } from "../audio/audio.lib";
import { readNpz } from "../npz/npz.lib";
import { encode, wordStarts } from "../text/text.lib";
import { CACHE, HOP, LEAD_KEEP_SAMPLES, PHONEME_CACHE, SAMPLE_RATE, TRIM_SAMPLES } from "./worker.constants";
import type {
  FromWorker,
  KittenConfig,
  Ort,
  Phonemizer,
  Runtime,
  Sources,
  Synthesized,
  SynthJob,
  ToWorker,
} from "./worker.types";

declare const self: DedicatedWorkerGlobalScope;

let loaded = 0;
let runtime: Promise<Runtime> | null = null;
let queue: SynthJob[] = [];
let busy = false;

function post(msg: FromWorker, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

function errorMessage(err: unknown): string {
  return String((err as Error)?.message ?? err);
}

function counted(n: number): void {
  loaded += n;
  post({ type: "progress", loaded });
}

function concat(parts: Uint8Array[], size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size);
  let at = 0;

  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }

  return bytes;
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Cache Storage first: a returning reader on the same site starts in a second, not a download.
async function fetchCached(url: string): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);

  if (hit) {
    const buf = await hit.arrayBuffer();

    counted(buf.byteLength);

    return buf;
  }

  const res = await fetch(url);

  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);

  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) break;

    parts.push(value);
    size += value.length;
    counted(value.length);
  }

  const bytes = concat(parts, size);

  await cache?.put(url, new Response(bytes)).catch(() => undefined);

  return bytes.buffer;
}

async function load(src: Sources): Promise<Runtime> {
  const [ort, ph, model, wasm, voices, config] = await Promise.all([
    import(/* @vite-ignore */ src.ort) as Promise<Ort>,
    import(/* @vite-ignore */ src.phonemizer) as Promise<Phonemizer>,
    fetchCached(src.model),
    fetchCached(src.ortWasm),
    fetchCached(src.voices).then(readNpz),
    fetch(src.config).then((r) => r.json() as Promise<KittenConfig>),
  ]);

  // Handing over the binary we already cached stops the runtime downloading it a second time.
  ort.env.wasm.wasmBinary = wasm;
  ort.env.wasm.wasmPaths = src.ortWasm.slice(0, src.ortWasm.lastIndexOf("/") + 1);
  // Threads need cross-origin isolation, which publisher pages rarely have.
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

  const session = await ort.InferenceSession.create(model, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
  // Runs of words repeat (and prev/seek replays them); espeak is cheap but not free.
  const seen = new Map<string, string>();

  async function phonemize(run: string): Promise<string> {
    const hit = seen.get(run);

    if (hit !== undefined) return hit;

    const out = (await ph.phonemize(run, "en-us")).join(" ").replace(/_/g, "").replace(/\n/g, " ");

    if (seen.size > PHONEME_CACHE) seen.clear();
    seen.set(run, out);

    return out;
  }

  return { ort, session, phonemize, voices, config };
}

async function synth(rt: Runtime, text: string, voice: string, speed: number): Promise<Synthesized> {
  const style = rt.voices.get(rt.config.voice_aliases?.[voice] ?? voice);

  if (!style) throw new Error(`Unknown voice ${voice}`);

  const { ids, words } = await encode(text, rt.phonemize);
  // The voice table holds one style vector per text length (as KittenTTS indexes it); longer
  // texts share the last.
  const row = Math.min(text.length, style.rows - 1);
  const { Tensor } = rt.ort;
  const out = await rt.session.run({
    input_ids: new Tensor("int64", BigInt64Array.from(ids, BigInt), [1, ids.length]),
    style: new Tensor("float32", style.data.slice(row * style.cols, (row + 1) * style.cols), [1, style.cols]),
    speed: new Tensor("float32", new Float32Array([speed]), [1]),
  });
  const audio = out.waveform?.data;
  const durations = out.duration?.data;

  if (!audio || !durations) throw new Error("Model returned no audio");

  // The leading pad token is ~0.65 s of silence on every clip; between sentences it read as a
  // hesitation. Keep a short breath of it.
  const lead = Math.max(0, Number(durations[0] ?? 0) * HOP - LEAD_KEEP_SAMPLES);
  const starts = wordStarts(words, durations, HOP / SAMPLE_RATE).map((t) => Math.max(0, t - lead / SAMPLE_RATE));
  const voiced = audio.subarray(lead, Math.max(lead, audio.length - TRIM_SAMPLES));

  return { samples: level(denoise(voiced, SAMPLE_RATE), SAMPLE_RATE), starts };
}

async function run(job: SynthJob): Promise<void> {
  try {
    const rt = await (runtime as Promise<Runtime>);
    const started = performance.now();
    const { samples, starts } = await synth(rt, job.text, job.voice, job.speed);

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
    post({ type: "error", id: job.id, message: errorMessage(err) });
  }
}

async function pump(): Promise<void> {
  if (busy || !runtime) return;

  busy = true;

  try {
    let job = queue.shift();

    while (job) {
      await run(job);
      // Yield between jobs: synthesis blocks this thread, so without a macrotask break a "drop"
      // sent during a job would only be read once the whole queue had run.
      await nextTask();
      job = queue.shift();
    }
  } finally {
    busy = false;
  }
}

function onMessage(e: MessageEvent<ToWorker>): void {
  const msg = e.data;

  switch (msg.type) {
    case "load":
      runtime ??= load(msg.sources);
      runtime.then(
        () => post({ type: "ready" }),
        (err: unknown) => post({ type: "error", message: errorMessage(err) }),
      );
      pump();
      return;

    case "synth":
      queue.push(msg);
      pump();
      return;

    case "drop": {
      // The engine has already forgotten these; just do not spend time on them.
      const keep = new Set(msg.keep);

      queue = queue.filter((job) => keep.has(job.id));
    }
  }
}

self.onmessage = onMessage;
