import { applySavedAx, createAx } from "./a11y/a11y";
import type { AxController } from "./a11y/a11y.types";
import { createEmitter } from "./lib/emitter";
import { guard, warn } from "./lib/log";
import { resolveOptions } from "./options/options";
import type { ReaderEvent, ReaderOptions, ResolvedOptions } from "./options/options.types";
import { createReader } from "./reader/reader";
import type { Reader } from "./reader/reader.types";
import type { VoiceEngine } from "./speech/speech.types";
import { type MountedUI, mountUI } from "./ui/mount";

export { applySavedAx } from "./a11y/a11y";
export { optionsFromDataset, resolveOptions } from "./options/options";
export type { Position, ReaderEvent, ReaderOptions, Side } from "./options/options.types";
export type {
  EngineStatus,
  SpeakHandlers,
  SpeakRequest,
  SpeechDriver,
  SpeechErrorInfo,
  Voice,
  VoiceEngine,
} from "./speech/speech.types";

let current: ResolvedOptions | null = null;
let reader: Reader | null = null;
let ax: AxController | null = null;
let ui: MountedUI | null = null;

const emitter = createEmitter<ReaderEvent>();
// Add-on voice engines outlive init()/destroy(): register once, every later reader gets them.
const engines: VoiceEngine[] = [];

function teardown(): void {
  ui?.destroy();
  reader?.destroy();
  ax?.destroy();
  ui = reader = ax = null;
  current = null;
}

export const registerVoices = guard("registerVoices", function registerVoices(engine: VoiceEngine): void {
  if (engines.some((e) => e.id === engine.id)) return;

  engines.push(engine);
  reader?.addEngine(engine);
});

export const init = guard("init", function init(options?: ReaderOptions) {
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
      const created = createReader(opts, emitter.emit);

      reader = created;
      for (const engine of engines) created.addEngine(engine);
    }

    if (reader || ax) ui = mountUI(document, opts, reader, ax);
  } catch (err) {
    // Half an init is worse than none: roll back so the page is untouched and init() can retry.
    teardown();
    throw err;
  }
});

export const destroy = guard("destroy", function destroy() {
  teardown();
  emitter.clear();
});

export const play = guard("play", function play() {
  if (!current) warn("play() called before init().");
  else if (!reader) warn("play() ignored: the tts feature is disabled.");
  else reader.play();
});

export const pause = guard("pause", function pause() {
  reader?.pause();
});

export const on = guard("on", function on(event: ReaderEvent, handler: (payload: unknown) => void) {
  return emitter.on(event, handler);
});

export function isInitialized(): boolean {
  return current !== null;
}
