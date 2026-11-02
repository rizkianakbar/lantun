import type {
  EngineStatus,
  SpeakHandlers,
  SpeakRequest,
  Voice,
  VoiceEngine,
} from "@lantun/core";
import {
  SAMPLE_RATE,
  type FromWorker,
  type Sources,
  type ToWorker,
} from "./protocol";
import { encodeWav, SILENCE } from "./wav";

// Bella is hidden for now: she sounds off at her calibrated pace (see PACE).
export const VOICE_NAMES = [
  // 'Bella',
  "Jasper",
  "Luna",
  "Bruno",
  "Rosie",
  "Hugo",
  // 'Kiki',
  "Leo",
] as const;
export type KittenVoiceName = (typeof VOICE_NAMES)[number];
// From the model's config.json: the names alias expr-voice-2-f, -2-m, -3-f, … in this order.
const GENDER: Record<KittenVoiceName, "female" | "male"> = {
  // Bella: 'female',
  Jasper: "male",
  Luna: "female",
  Bruno: "male",
  Rosie: "female",
  Hugo: "male",
  // Kiki: 'female',
  Leo: "male",
};

// Model speed that makes each voice read at 15 characters a second, the pace core assumes for
// time estimates. Natural paces range from 14 (Bella) to 19.5 (Kiki) characters a second, so
// without this "1×" meant something different for every voice. Measured on a news sentence.
const PACE: Record<KittenVoiceName, number> = {
  // Bella: 1.06,
  Jasper: 0.78,
  Luna: 0.87,
  Bruno: 0.85,
  Rosie: 0.9,
  Hugo: 0.87,
  // Kiki: 0.77,
  Leo: 0.98,
};

const HF =
  "https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main";
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist";

export const DEFAULT_SOURCES: Sources = {
  model: `${HF}/kitten_tts_nano_v0_8.onnx`,
  voices: `${HF}/voices.npz`,
  config: `${HF}/config.json`,
  ort: `${ORT}/ort.wasm.min.mjs`,
  ortWasm: `${ORT}/ort-wasm-simd-threaded.wasm`,
  phonemizer:
    "https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js",
};

// Bytes read while loading (model, voices, runtime) and what crosses the network once compressed.
const LOAD_BYTES = 24_370_000 + 3_280_000 + 12_300_000;
const DOWNLOAD_BYTES = 31_000_000;

// Synthesis time over listening time. Above this the reader would hear gaps between sentences.
const MAX_REALTIME_FACTOR = 0.85;
// Clips measured before judging; the first is skipped because it includes warm-up.
const JUDGE_AFTER = 3;
// Clips kept for prefetch and for replaying after prev/seek.
const CACHE_CLIPS = 10;
// Sentences shorter than this are never split.
const SPLIT_MIN = 90;
const MIN_PIECE = 25;
const CLAUSE = /[,;:—](?=\s)/g;
const WORD_TICK_MS = 30;

export interface KittenOptions {
  // Self-host the model and runtime by overriding any of these URLs.
  sources?: Partial<Sources>;
  // Voices to offer; all eight by default.
  voices?: readonly KittenVoiceName[];
}

interface Clip {
  url: string;
  seconds: number;
  // Seconds from clip start to each word of the clip's text, from the model's own durations.
  starts: Float32Array;
}

export interface Part {
  text: string;
  // Where this part's text starts within the utterance.
  offset: number;
}

// Same switch as core: localStorage.setItem('lantun:debug', '1').
const debug = (...args: unknown[]): void => {
  try {
    if (localStorage.getItem("lantun:debug"))
      console.info("[Lantun] kitten:", ...args);
  } catch {
    // Storage blocked: no logging.
  }
};

// Globals looked up on the passed window so tests and iframes can supply their own.
type EngineWindow = Window & { Worker?: typeof Worker; Audio?: typeof Audio };

// Worth offering only where it can run well: WASM, workers, audio, and a reader who has not
// asked the browser to save data.
export const canRun = (win: EngineWindow = window): boolean => {
  const nav = win.navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return (
    typeof WebAssembly === "object" &&
    typeof win.Worker === "function" &&
    typeof win.Audio === "function" &&
    typeof DecompressionStream === "function" &&
    !nav.connection?.saveData &&
    (nav.deviceMemory ?? 4) >= 2
  );
};

// Whole sentences sound best: the model shapes intonation over everything it is given. Only a
// long sentence that is not ready yet (a cold start or a skip) is split, after its first comma,
// colon or dash, so its first words play sooner. A pause belongs there anyway.
export const splitFirstClause = (text: string): Part[] => {
  if (text.length < SPLIT_MIN) return [{ text, offset: 0 }];
  for (const m of text.matchAll(CLAUSE)) {
    const end = (m.index ?? 0) + 1;
    if (end < MIN_PIECE) continue;
    if (end > text.length - MIN_PIECE) break;
    const rest = text.slice(end).trimStart();
    return [
      { text: text.slice(0, end), offset: 0 },
      { text: rest, offset: text.length - rest.length },
    ];
  }
  return [{ text, offset: 0 }];
};

export const createKittenEngine = (
  createWorker: () => Worker,
  o: KittenOptions = {},
  win: EngineWindow = window,
): VoiceEngine => {
  const sources = { ...DEFAULT_SOURCES, ...o.sources };
  const voices: Voice[] = canRun(win)
    ? (o.voices ?? VOICE_NAMES).map((name) => ({
        id: `kitten:${name}`,
        name,
        lang: "en-US",
        local: true,
        isDefault: false,
        engine: "kitten",
        downloadBytes: DOWNLOAD_BYTES,
        gender: GENDER[name],
      }))
    : [];

  let status: EngineStatus = { state: "idle", progress: 0 };
  const listeners = new Set<(s: EngineStatus) => void>();
  const setStatus = (next: EngineStatus): void => {
    status = next;
    listeners.forEach((cb) => cb(next));
  };

  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (clip: Clip) => void; reject: (err: Error) => void }
  >();
  const clips = new Map<string, { id: number; clip: Promise<Clip> }>();
  const factors: number[] = [];

  let audio: HTMLAudioElement | null = null;
  let rate = 1;
  let paused = false;
  // Bumped by every speak() and cancel(): callbacks from an older utterance check it and bail.
  let token = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;
  // When the last clip finished, to log how long the reader waited for the next one.
  let endedAt = 0;
  // Clips the current utterance still wants: its own parts, plus what prepare() asks for right
  // after speak() (the player prefetches the next sentences in the same task).
  let wanted: Set<number> | null = null;
  let startWhenResumed: (() => void) | null = null;

  const fail = (): void => {
    worker?.terminate();
    worker = null;
    pending.forEach((p) => p.reject(new Error("Voice engine failed to load")));
    pending.clear();
    for (const { clip } of clips.values())
      void clip.then(
        (c) => URL.revokeObjectURL(c.url),
        () => undefined,
      );
    clips.clear();
    setStatus({ state: "error", progress: 0, error: "failed" });
  };

  // A device that cannot synthesise faster than the reader listens would stutter: say so, and
  // the reader switches to a built-in voice.
  const judge = (ms: number, seconds: number): void => {
    if (seconds < 0.5) return;
    factors.push((ms / 1000 / seconds) * rate);
    if (factors.length < JUDGE_AFTER + 1) return;
    const recent = factors.slice(1).slice(-JUDGE_AFTER);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (mean > MAX_REALTIME_FACTOR) {
      debug(`too slow: synthesis takes ${mean.toFixed(2)}× the listening time`);
      setStatus({ state: "error", progress: 0, error: "slow" });
    }
  };

  const onMessage = (msg: FromWorker): void => {
    if (msg.type === "progress") {
      if (status.state === "loading")
        setStatus({
          state: "loading",
          progress: Math.min(0.99, msg.loaded / LOAD_BYTES),
        });
    } else if (msg.type === "ready") {
      setStatus({ state: "ready", progress: 1 });
    } else if (msg.type === "audio") {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (!p) return;
      const seconds = msg.samples.length / SAMPLE_RATE;
      debug(
        `clip ${msg.id}: ${Math.round(msg.ms)} ms for ${seconds.toFixed(1)} s of audio`,
      );
      judge(msg.ms, seconds);
      const url = URL.createObjectURL(
        new Blob([encodeWav(msg.samples, SAMPLE_RATE)], { type: "audio/wav" }),
      );
      p.resolve({ url, seconds, starts: msg.starts });
    } else if (msg.id === undefined) {
      debug("load failed:", msg.message);
      fail();
    } else {
      debug(`clip ${msg.id} failed:`, msg.message);
      pending.get(msg.id)?.reject(new Error(msg.message));
      pending.delete(msg.id);
    }
  };

  const send = (msg: ToWorker): void => worker?.postMessage(msg);

  const ensureWorker = (): Worker | null => {
    if (worker) return worker;
    try {
      worker = createWorker();
    } catch {
      // A strict Content-Security-Policy can forbid blob: workers.
      fail();
      return null;
    }
    worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
    worker.onerror = fail;
    setStatus({ state: "loading", progress: 0 });
    send({ type: "load", sources });
    return worker;
  };

  const nameOf = (voice: Voice | null): KittenVoiceName =>
    (VOICE_NAMES as readonly string[]).includes(voice?.name ?? "")
      ? (voice?.name as KittenVoiceName)
      : VOICE_NAMES[0];
  // Clips are made at the voice's 1× pace; the reader's speed is applied at playback.
  const keyOf = (voice: Voice | null, text: string): string =>
    `${nameOf(voice)}|${text}`;

  const evict = (): void => {
    while (clips.size > CACHE_CLIPS) {
      const [key, entry] = clips.entries().next().value as [
        string,
        { clip: Promise<Clip> },
      ];
      clips.delete(key);
      void entry.clip.then(
        (c) => URL.revokeObjectURL(c.url),
        () => undefined,
      );
    }
  };

  const clipFor = (
    voice: Voice | null,
    text: string,
  ): { id: number; clip: Promise<Clip> } => {
    const key = keyOf(voice, text);
    const hit = clips.get(key);
    if (hit) {
      // Re-insert so the Map's order stays least-recently-used first.
      clips.delete(key);
      clips.set(key, hit);
      return hit;
    }
    const id = nextId++;
    const name = nameOf(voice);
    const clip = new Promise<Clip>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      debug(`queue clip ${id}: "${text.slice(0, 40)}"`);
      send({ type: "synth", id, text, voice: name, speed: PACE[name] });
    });
    // A failed clip must not stay cached, or a retry would get the same failure.
    clip.catch(() => clips.get(key)?.id === id && clips.delete(key));
    const entry = { id, clip };
    clips.set(key, entry);
    evict();
    return entry;
  };

  // The reader moved on: forget unfinished clips for anything else, here and now, so nothing can
  // pick up a clip that is about to be cancelled, and tell the worker to skip them.
  const dropAllBut = (keep: Set<number>): void => {
    for (const [key, entry] of clips) {
      const p = pending.get(entry.id);
      if (!p || keep.has(entry.id)) continue;
      clips.delete(key);
      pending.delete(entry.id);
      p.reject(new Error("dropped"));
    }
    send({ type: "drop", keep: [...keep] });
  };

  const stop = (): void => {
    clearInterval(ticker);
    ticker = undefined;
    startWhenResumed = null;
    if (audio) {
      audio.onended = null;
      audio.pause();
    }
  };

  const element = (): HTMLAudioElement => {
    if (audio) return audio;
    const Ctor = win.Audio ?? Audio;
    const el = new Ctor();
    el.preload = "auto";
    // Speed changes keep the voice's pitch (the default in browsers, stated for clarity).
    el.preservesPitch = true;
    audio = el;
    return el;
  };

  // Plays the utterance's parts back to back, mapping each part's words to utterance offsets.
  const playParts = (
    parts: { part: Part; clip: Promise<Clip> }[],
    req: SpeakRequest,
    h: SpeakHandlers,
    mine: number,
  ): void => {
    const el = element();
    let i = 0;
    let started = false;

    const playNext = (): void => {
      const item = parts[i];
      if (!item) {
        h.onEnd();
        return;
      }
      item.clip.then(
        (clip) => {
          if (mine !== token) return;
          const offsets = Array.from(
            item.part.text.matchAll(/\S+/g),
            (m) => item.part.offset + (m.index ?? 0),
          );
          let next = 0;
          // Word events follow the media clock, which already accounts for speed and pauses.
          const tick = (): void => {
            while (
              next < offsets.length &&
              (clip.starts[next] ?? Infinity) <= el.currentTime
            )
              h.onWord(offsets[next++] ?? 0, false);
          };
          const start = (): void => {
            el.onended = () => {
              endedAt = performance.now();
              if (mine !== token) return;
              clearInterval(ticker);
              tick();
              i++;
              playNext();
            };
            el.src = clip.url;
            el.playbackRate = rate;
            el.play().then(
              () => {
                if (mine !== token) return;
                if (!started) {
                  started = true;
                  h.onStart?.();
                }
                if (endedAt)
                  debug(
                    `silence before "${item.part.text.slice(0, 30)}": ${Math.round(performance.now() - endedAt)} ms`,
                  );
                endedAt = 0;
                clearInterval(ticker);
                ticker = setInterval(tick, WORD_TICK_MS);
                tick();
              },
              (err: Error) =>
                mine === token &&
                h.onError({
                  code:
                    err.name === "NotAllowedError"
                      ? "not-allowed"
                      : "audio-failed",
                  message: err.message,
                }),
            );
          };
          // Paused while the clip was still being made: start when the reader resumes.
          if (paused) startWhenResumed = start;
          else start();
        },
        (err: Error) =>
          mine === token &&
          err.message !== "dropped" &&
          h.onError({ code: "synthesis-failed", message: err.message }),
      );
    };
    playNext();
  };

  const engine: VoiceEngine = {
    id: "kitten",
    reliablePause: true,
    slowStart: true,
    liveRate: true,
    status: () => status,
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getVoices: () => Promise.resolve(voices),
    speak(req, h) {
      stop();
      const mine = ++token;
      paused = false;
      rate = req.rate;
      const el = element();
      // Inside the reader's click: playing anything now lets this element play later.
      if (!el.src) {
        el.src = SILENCE;
        void el.play().catch(() => undefined);
      }
      if (status.state === "error") {
        factors.length = 0;
        setStatus({ state: "idle", progress: 0 });
      }
      if (!ensureWorker()) {
        h.onError({
          code: "engine-failed",
          message: "HD voice is unavailable on this page.",
        });
        return;
      }
      const whole = clips.get(keyOf(req.voice, req.text));
      const parts = whole
        ? [{ part: { text: req.text, offset: 0 }, ...whole }]
        : splitFirstClause(req.text).map((part) => ({
            part,
            ...clipFor(req.voice, part.text),
          }));
      // Drop stale work once the player has also named the sentences it wants next. Dropping at
      // once threw away the next sentence mid-synthesis on every ordinary sentence change, and
      // the reader then waited while it was made again from scratch.
      const keep = new Set(parts.map((p) => p.id));
      wanted = keep;
      queueMicrotask(() => {
        if (wanted === keep) dropAllBut(keep);
      });
      playParts(parts, req, h, mine);
    },
    // Only ever called for this engine's voices, so for a reader who chose one: loading is wanted.
    prepare(req) {
      if (status.state === "error" || !ensureWorker()) return;
      const entry = clipFor(req.voice, req.text);
      wanted?.add(entry.id);
      void entry.clip.catch(() => undefined);
    },
    setRate(next) {
      rate = next;
      if (audio) audio.playbackRate = next;
    },
    pause() {
      paused = true;
      audio?.pause();
    },
    resume() {
      paused = false;
      const start = startWhenResumed;
      startWhenResumed = null;
      if (start) start();
      else void audio?.play().catch(() => undefined);
    },
    cancel() {
      token++;
      stop();
    },
  };
  return engine;
};
