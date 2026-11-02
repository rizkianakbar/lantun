import type { SpeechDriver, Voice, VoiceEngine } from "./types";

export interface MixedDriver extends SpeechDriver {
  add(engine: VoiceEngine): void;
}

// Routes each utterance to the engine that owns its voice, and everything else to the built-in
// driver. Engines can be added at any time; their voices appear on the next getVoices().
export function createMixedDriver(base: SpeechDriver | null): MixedDriver {
  const engines = new Map<string, VoiceEngine>();
  let active: SpeechDriver | null = base;

  const target = (voice: Voice | null): SpeechDriver | null =>
    (voice?.engine ? engines.get(voice.engine) : undefined) ?? base;

  return {
    id: "mixed",
    // Read by the player at pause and speak time, so they follow whichever engine is speaking.
    get reliablePause() {
      return active?.reliablePause ?? false;
    },
    get slowStart() {
      return active?.slowStart ?? false;
    },
    get liveRate() {
      return active?.liveRate ?? false;
    },
    setRate(rate) {
      active?.setRate?.(rate);
    },
    async getVoices() {
      const lists = await Promise.all([
        base?.getVoices().catch(() => []) ?? [],
        ...Array.from(engines.values(), (e) => e.getVoices().catch(() => [])),
      ]);
      return lists.flat();
    },
    speak(req, h) {
      const next = target(req.voice);
      if (active && active !== next) active.cancel();
      active = next;
      if (next) next.speak(req, h);
      else
        h.onError({
          code: "unsupported",
          message: "No speech engine for this voice.",
        });
    },
    prepare(req) {
      target(req.voice)?.prepare?.(req);
    },
    pause() {
      active?.pause();
    },
    resume() {
      active?.resume();
    },
    cancel() {
      base?.cancel();
      engines.forEach((e) => e.cancel());
    },
    add(engine) {
      engines.set(engine.id, engine);
    },
  };
}
