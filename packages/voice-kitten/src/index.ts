import type { VoiceEngine } from "@lantun/core";
import { createKittenEngine } from "./engine/engine";
import type { KittenOptions } from "./engine/engine.types";
import { source } from "./worker/worker?worker-source";

export { VOICE_NAMES } from "./engine/engine.constants";
export type { KittenOptions, KittenVoiceName } from "./engine/engine.types";

function createWorker(): Worker {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));

  return new Worker(url, { type: "module" });
}

// Natural English voices that run on the reader's device after a one-time ~31 MB download.
// Nothing downloads until a reader picks one of these voices.
export function kittenVoices(options?: KittenOptions): VoiceEngine {
  return createKittenEngine(createWorker, options);
}
