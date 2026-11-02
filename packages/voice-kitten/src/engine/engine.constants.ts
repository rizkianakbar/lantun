import type { Sources } from "../worker/worker.types";
import type { KittenVoiceName } from "./engine.types";

// Bella and Kiki are hidden for now: they sound off at their calibrated pace (see PACE).
export const VOICE_NAMES = [
  // "Bella",
  "Jasper",
  "Luna",
  "Bruno",
  "Rosie",
  "Hugo",
  // "Kiki",
  "Leo",
] as const;

// From the model's config.json: the names alias expr-voice-2-f, -2-m, -3-f, … in this order.
export const GENDER: Record<KittenVoiceName, "female" | "male"> = {
  // Bella: "female",
  Jasper: "male",
  Luna: "female",
  Bruno: "male",
  Rosie: "female",
  Hugo: "male",
  // Kiki: "female",
  Leo: "male",
};

// Model speed that makes each voice read at 15 characters a second, the pace core's time estimates
// assume, so "1×" means the same for every voice.
export const PACE: Record<KittenVoiceName, number> = {
  // Bella: 1.06,
  Jasper: 0.78,
  Luna: 0.87,
  Bruno: 0.85,
  Rosie: 0.9,
  Hugo: 0.87,
  // Kiki: 0.77,
  Leo: 0.98,
};

const HF = "https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8/resolve/main";
const ORT = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist";

export const DEFAULT_SOURCES: Sources = {
  model: `${HF}/kitten_tts_nano_v0_8.onnx`,
  voices: `${HF}/voices.npz`,
  config: `${HF}/config.json`,
  ort: `${ORT}/ort.wasm.min.mjs`,
  ortWasm: `${ORT}/ort-wasm-simd-threaded.wasm`,
  phonemizer: "https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/dist/phonemizer.js",
};

// Bytes read while loading (model, voices, runtime), and what crosses the network compressed.
export const LOAD_BYTES = 24_370_000 + 3_280_000 + 12_300_000;
export const DOWNLOAD_BYTES = 31_000_000;

// Synthesis time over listening time. Above this the reader would hear gaps between sentences.
export const MAX_REALTIME_FACTOR = 0.85;
// Clips measured before judging; the first is skipped because it includes warm-up.
export const JUDGE_AFTER = 3;
// Clips shorter than this are dominated by fixed costs, so they say nothing about speed.
export const MIN_JUDGED_SECONDS = 0.5;
// Clips kept for prefetch and for replaying after prev/seek.
export const CACHE_CLIPS = 10;
// Sentences shorter than this are never split.
export const SPLIT_MIN = 90;
export const MIN_PIECE = 25;
export const CLAUSE = /[,;:—](?=\s)/g;
export const WORD_TICK_MS = 30;
