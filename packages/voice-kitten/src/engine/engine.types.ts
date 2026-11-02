import type { Sources } from "../worker/worker.types";
import type { VOICE_NAMES } from "./engine.constants";

export type KittenVoiceName = (typeof VOICE_NAMES)[number];

export interface KittenOptions {
  // Self-host the model and runtime by overriding any of these URLs.
  sources?: Partial<Sources>;
  // Voices to offer; every voice in VOICE_NAMES by default.
  voices?: readonly KittenVoiceName[];
}

export interface Part {
  text: string;
  // Where this part's text starts within the utterance.
  offset: number;
}

export interface Clip {
  url: string;
  seconds: number;
  // Seconds from clip start to each word of the clip's text, from the model's own durations.
  starts: Float32Array;
}

export interface ClipEntry {
  id: number;
  clip: Promise<Clip>;
}

export interface PartClip extends ClipEntry {
  part: Part;
}

export interface Pending {
  resolve: (clip: Clip) => void;
  reject: (err: Error) => void;
}

// Globals looked up on the passed window so tests and iframes can supply their own.
export type EngineWindow = Window & { Worker?: typeof Worker; Audio?: typeof Audio };

export type EngineNavigator = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};
