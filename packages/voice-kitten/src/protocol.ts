// Messages between the engine (main thread) and its worker.

export interface Sources {
  // Kitten TTS nano 0.8, int8 (Apache-2.0).
  model: string;
  voices: string;
  config: string;
  // ONNX Runtime Web, WASM backend only: no WebGPU code to download.
  ort: string;
  ortWasm: string;
  // espeak-ng compiled to WASM, for English grapheme-to-phoneme.
  phonemizer: string;
}

export type ToWorker =
  | { type: "load"; sources: Sources }
  // speed is the model's own speed input: 1 is the voice's natural pace.
  | { type: "synth"; id: number; text: string; voice: string; speed: number }
  // Skip queued jobs that are no longer wanted (the reader skipped ahead). The engine settles
  // their promises itself, so nothing is sent back for them.
  | { type: "drop"; keep: number[] };

export type FromWorker =
  | { type: "progress"; loaded: number }
  | { type: "ready" }
  // starts: seconds from clip start to each whitespace-separated word of the text.
  | {
      type: "audio";
      id: number;
      samples: Float32Array<ArrayBuffer>;
      starts: Float32Array<ArrayBuffer>;
      ms: number;
    }
  | { type: "error"; id?: number; message: string };

export const SAMPLE_RATE = 24000;
// Samples per frame of the model's duration output.
export const HOP = 600;
