import type { VoiceEngine } from "@lantun/core";
import { createKittenEngine, type KittenOptions } from "./engine";
import { source } from "./worker?worker-source";

export type { KittenOptions, KittenVoiceName } from "./engine";
export { VOICE_NAMES } from "./engine";

// Eight natural English voices that run on the reader's device after a one-time ~31 MB download.
// Nothing downloads until a reader picks one of these voices.
export const kittenVoices = (options?: KittenOptions): VoiceEngine =>
  createKittenEngine(
    () =>
      new Worker(
        URL.createObjectURL(new Blob([source], { type: "text/javascript" })),
        { type: "module" },
      ),
    options,
  );
