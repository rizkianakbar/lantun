// Test doubles (jsdom has no speechSynthesis): one word every `wordMs / rate` milliseconds.
import type { EngineStatus, SpeakRequest, SpeechDriver, Voice, VoiceEngine } from "./speech.types";

export interface FakeDriverOptions {
  wordMs?: number;
  boundaries?: boolean;
  reliablePause?: boolean;
  voices?: Voice[];
  // Error codes returned by the next speak() calls, in order.
  failures?: string[];
  // Number of upcoming utterances that go silent after `stallAfterWords` words and never end.
  stalls?: number;
  stallAfterWords?: number;
}

export interface FakeDriver extends SpeechDriver {
  spoken: SpeakRequest[];
}

export function createFakeDriver(o: FakeDriverOptions = {}): FakeDriver {
  const wordMs = o.wordMs ?? 100;
  const failures = [...(o.failures ?? [])];
  let stalls = o.stalls ?? 0;
  let timers: ReturnType<typeof setTimeout>[] = [];

  function clear(): void {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function later(fn: () => void, ms: number): void {
    timers.push(setTimeout(fn, ms));
  }

  function nextStall(wordCount: number): number {
    if (stalls <= 0) return -1;

    stalls--;

    return Math.min(o.stallAfterWords ?? 1, wordCount);
  }

  return {
    id: "fake",
    reliablePause: o.reliablePause ?? false,
    spoken: [],

    getVoices() {
      return Promise.resolve(o.voices ?? []);
    },

    speak(req, handlers) {
      clear();
      this.spoken.push(req);

      const failure = failures.shift();

      if (failure) {
        later(() => handlers.onError({ code: failure, message: failure }), 0);
        return;
      }

      const words = Array.from(req.text.matchAll(/\S+/g), (m) => m.index ?? 0);
      const stallAt = nextStall(words.length);
      const step = wordMs / req.rate;

      later(() => handlers.onStart?.(), 0);

      words.forEach((charIndex, i) => {
        if (stallAt >= 0 && i >= stallAt) return;
        if (o.boundaries !== false) {
          later(() => handlers.onWord(charIndex), i * step);
        }
      });

      if (stallAt < 0) later(handlers.onEnd, words.length * step);
    },

    pause() {},
    resume() {},
    cancel: clear,
  };
}

export interface FakeEngine extends VoiceEngine, FakeDriver {
  prepared: SpeakRequest[];
  setStatus(status: EngineStatus): void;
}

// Test double for an add-on engine: a fake driver with status reporting and prefetch tracking.
export function createFakeEngine(id: string, o: FakeDriverOptions = {}): FakeEngine {
  const base = createFakeDriver({
    reliablePause: true,
    ...o,
    voices: (o.voices ?? []).map((v) => ({ ...v, engine: id })),
  });
  const listeners = new Set<(s: EngineStatus) => void>();
  let status: EngineStatus = { state: "idle", progress: 0 };

  return Object.assign(base, {
    id,
    slowStart: true,
    prepared: [] as SpeakRequest[],

    prepare(req: SpeakRequest) {
      this.prepared.push(req);
    },

    status() {
      return status;
    },

    subscribe(listener: (s: EngineStatus) => void) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },

    setStatus(next: EngineStatus) {
      status = next;
      for (const listener of listeners) listener(next);
    },
  });
}
