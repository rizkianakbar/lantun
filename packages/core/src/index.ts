import { applySavedAx, createAx, type AxController } from "./a11y/controller";
import { createEmitter } from "./emitter";
import { guard, warn } from "./log";
import { resolveOptions } from "./options";
import { createReader, type Reader } from "./reader";
import type { VoiceEngine } from "./speech/types";
import type { ReaderEvent, ReaderOptions, ResolvedOptions } from "./types";
import { mountUI, type MountedUI } from "./ui/mount";

export type {
  EngineStatus,
  SpeakHandlers,
  SpeakRequest,
  SpeechDriver,
  SpeechErrorInfo,
  Voice,
  VoiceEngine,
} from "./speech/types";
export { resolveOptions } from "./options";
export { optionsFromDataset } from "./dataset";
export { applySavedAx } from "./a11y/controller";

let current: ResolvedOptions | null = null;
let reader: Reader | null = null;
let ax: AxController | null = null;
let ui: MountedUI | null = null;
const emitter = createEmitter<ReaderEvent>();
// Add-on voice engines outlive init()/destroy(): register once, every later reader gets them.
const engines: VoiceEngine[] = [];

export const registerVoices = guard(
  "registerVoices",
  (engine: VoiceEngine): void => {
    if (engines.some((e) => e.id === engine.id)) return;
    engines.push(engine);
    reader?.addEngine(engine);
  },
);

export const init = guard("init", (options?: ReaderOptions): void => {
  if (current) {
    warn("init() called twice; call destroy() first. Ignoring.");
    return;
  }
  const opts = resolveOptions(options);
  current = opts;
  try {
    if (opts.features.a11y) {
      applySavedAx(document, opts.nonce);
      ax = createAx(document, opts.nonce);
    }
    if (opts.features.tts) {
      const r = createReader(opts, emitter.emit);
      reader = r;
      engines.forEach((e) => r.addEngine(e));
    }
    if (reader || ax) ui = mountUI(document, opts, reader, ax);
  } catch (err) {
    // Half an init is worse than none: roll back so the page is untouched and init() can retry.
    teardown();
    throw err;
  }
});

const teardown = (): void => {
  ui?.destroy();
  reader?.destroy();
  ax?.destroy();
  ui = reader = ax = null;
  current = null;
};

export const destroy = guard("destroy", (): void => {
  teardown();
  emitter.clear();
});

export const play = guard("play", (): void => {
  if (!current) warn("play() called before init().");
  else if (!reader) warn("play() ignored: the tts feature is disabled.");
  else reader.play();
});

export const pause = guard("pause", (): void => {
  reader?.pause();
});

export const on = guard(
  "on",
  (event: ReaderEvent, cb: (payload: unknown) => void) => emitter.on(event, cb),
);

export const isInitialized = (): boolean => current !== null;
