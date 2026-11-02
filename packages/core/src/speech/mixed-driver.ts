import type { SpeechDriver, Voice, VoiceEngine } from "./speech.types";

export interface MixedDriver extends SpeechDriver {
  add(engine: VoiceEngine): void;
}

function noVoices(): Voice[] {
  return [];
}

// Routes each utterance to the engine that owns its voice, everything else to the built-in driver.
export function createMixedDriver(base: SpeechDriver | null): MixedDriver {
  const engines = new Map<string, VoiceEngine>();
  let active: SpeechDriver | null = base;

  function target(voice: Voice | null): SpeechDriver | null {
    return (voice?.engine ? engines.get(voice.engine) : undefined) ?? base;
  }

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
        base ? base.getVoices().catch(noVoices) : [],
        ...Array.from(engines.values(), (e) => e.getVoices().catch(noVoices)),
      ]);

      return lists.flat();
    },

    speak(req, handlers) {
      const next = target(req.voice);

      if (active && active !== next) active.cancel();
      active = next;

      if (next) {
        next.speak(req, handlers);
        return;
      }

      handlers.onError({
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
      for (const engine of engines.values()) engine.cancel();
    },

    add(engine) {
      engines.set(engine.id, engine);
    },
  };
}
