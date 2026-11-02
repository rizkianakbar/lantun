import { DEFAULT_CPS, DETECT_BOUNDARIES_MS, LEARN_WEIGHT, MIN_LEARN_CHARS, MIN_LEARN_MS } from "./speech.constants";
import type { SpeechDriver, WordTimingOptions } from "./speech.types";

function wordStarts(text: string): number[] {
  return Array.from(text.matchAll(/\S+/g), (m) => m.index ?? 0);
}

// Voices that fire no word boundaries get estimated word events from a learned speaking speed.
export function withWordTiming(driver: SpeechDriver, o: WordTimingOptions = {}): SpeechDriver {
  const detectMs = o.detectMs ?? DETECT_BOUNDARIES_MS;
  const hasBoundaries = new Map<string, boolean>();
  const cps = new Map<string, number>();
  let timers: ReturnType<typeof setTimeout>[] = [];
  // Estimated timers must pause and resume with the audio.
  let onPause: (() => void) | null = null;
  let onResume: (() => void) | null = null;

  function clear(): void {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function learn(key: string, chars: number, ms: number, rate: number): void {
    const measured = chars / (ms / 1000) / rate;
    const prev = cps.get(key);

    cps.set(key, prev === undefined ? measured : prev + (measured - prev) * LEARN_WEIGHT);
  }

  return {
    id: driver.id,

    // Getters: the wrapped driver may switch engines between utterances (mixed-driver.ts).
    get reliablePause() {
      return driver.reliablePause;
    },

    get slowStart() {
      return driver.slowStart;
    },

    getVoices() {
      return driver.getVoices();
    },

    prepare(req) {
      driver.prepare?.(req);
    },

    speak(req, handlers) {
      clear();
      onPause = onResume = null;

      const key = req.voice?.id ?? `default:${req.lang}`;
      const starts = wordStarts(req.text);
      let startedAt = 0;
      let elapsedAtPause = 0;
      let estimating = false;
      let sawBoundary = false;

      function estimate(elapsed: number): void {
        estimating = true;

        const perMs = ((cps.get(key) ?? DEFAULT_CPS) * req.rate) / 1000;
        let caughtUp = -1;

        for (const i of starts) {
          const delay = i / perMs - elapsed;

          if (delay > 0) {
            timers.push(setTimeout(() => handlers.onWord(i, true), delay));
          } else {
            caughtUp = i;
          }
        }

        // Already past some words (late detection or resume): jump straight to the current one.
        if (caughtUp >= 0) handlers.onWord(caughtUp, true);
      }

      function detect(): void {
        if (sawBoundary) return;

        hasBoundaries.set(key, false);
        o.onFallback?.(req.voice, req.lang);
        estimate(Date.now() - startedAt);
      }

      onPause = () => {
        elapsedAtPause = Date.now() - startedAt;
        clear();
      };
      onResume = () => {
        startedAt = Date.now() - elapsedAtPause;
        if (estimating) estimate(elapsedAtPause);
      };

      driver.speak(req, {
        onStart() {
          startedAt = Date.now();
          handlers.onStart?.();

          const known = hasBoundaries.get(key);

          if (known === false) estimate(0);
          else if (known === undefined) timers.push(setTimeout(detect, detectMs));
        },

        onWord(i) {
          if (estimating) return;

          sawBoundary = true;
          hasBoundaries.set(key, true);
          handlers.onWord(i);
        },

        onEnd() {
          clear();

          const elapsed = Date.now() - startedAt;

          if (estimating && startedAt && elapsed > MIN_LEARN_MS && req.text.length > MIN_LEARN_CHARS) {
            learn(key, req.text.length, elapsed, req.rate);
          }

          handlers.onEnd();
        },

        onError(err) {
          clear();
          handlers.onError(err);
        },
      });
    },

    pause() {
      onPause?.();
      driver.pause();
    },

    resume() {
      onResume?.();
      driver.resume();
    },

    cancel() {
      clear();
      onPause = onResume = null;
      driver.cancel();
    },
  };
}
