import type { Matrix } from "../npz/npz.types";

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

export type SynthJob = Extract<ToWorker, { type: "synth" }>;

// The runtime libraries are fetched from a CDN at run time; only what the worker calls is typed.
export interface Tensor<T = Float32Array<ArrayBuffer>> {
  data: T;
}

export interface Session {
  run(feeds: Record<string, unknown>): Promise<{ waveform?: Tensor; duration?: Tensor<BigInt64Array> }>;
}

export interface Ort {
  env: {
    wasm: { wasmPaths?: string; wasmBinary?: ArrayBuffer; numThreads?: number };
  };
  Tensor: new (type: string, data: unknown, dims: number[]) => unknown;
  InferenceSession: {
    create(model: ArrayBuffer, opts: object): Promise<Session>;
  };
}

export interface Phonemizer {
  phonemize: (text: string, lang: string) => Promise<string[]>;
}

export interface KittenConfig {
  voice_aliases?: Record<string, string>;
}

export interface Runtime {
  ort: Ort;
  session: Session;
  phonemize: (text: string) => Promise<string>;
  voices: Map<string, Matrix>;
  config: KittenConfig;
}

export interface Synthesized {
  samples: Float32Array<ArrayBuffer>;
  starts: Float32Array<ArrayBuffer>;
}
