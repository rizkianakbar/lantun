import { AFTER_CANCEL_DELAY_MS, VOICES_TIMEOUT_MS } from "./speech.constants";
import type { SpeakHandlers, SpeakRequest, SpeechDriver, SpeechWindow, Voice } from "./speech.types";

export function isWebSpeechSupported(win: Window = window): boolean {
  return "speechSynthesis" in win && typeof (win as SpeechWindow).SpeechSynthesisUtterance === "function";
}

function voiceId(v: SpeechSynthesisVoice): string {
  return v.voiceURI || v.name;
}

function toVoice(v: SpeechSynthesisVoice): Voice {
  return {
    id: voiceId(v),
    name: v.name,
    lang: v.lang,
    local: v.localService,
    isDefault: v.default,
  };
}

export function loadVoices(synth: SpeechSynthesis, timeoutMs = VOICES_TIMEOUT_MS): Promise<Voice[]> {
  return new Promise((resolve) => {
    const now = synth.getVoices();

    if (now.length) {
      resolve(now.map(toVoice));
      return;
    }

    // Chrome fills the list asynchronously; some Safari versions never fire voiceschanged at all.
    function done(): void {
      clearTimeout(timer);
      synth.removeEventListener("voiceschanged", done);
      resolve(synth.getVoices().map(toVoice));
    }

    const timer = setTimeout(done, timeoutMs);

    synth.addEventListener("voiceschanged", done);
  });
}

export function createWebSpeechDriver(win: Window = window): SpeechDriver {
  const synth = win.speechSynthesis;
  const Utterance = (win as SpeechWindow).SpeechSynthesisUtterance ?? SpeechSynthesisUtterance;
  // Strong reference: Chrome garbage-collects in-flight utterances and then never fires onend.
  let current: SpeechSynthesisUtterance | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;

  // Returns whether anything was speaking or queued.
  function stop(): boolean {
    clearTimeout(pending);
    pending = undefined;

    const busy = current !== null || synth.speaking || synth.pending;

    current = null;
    if (busy) synth.cancel();

    return busy;
  }

  function start(req: SpeakRequest, handlers: SpeakHandlers): void {
    const u = new Utterance(req.text);
    const native = req.voice ? synth.getVoices().find((v) => voiceId(v) === req.voice?.id) : undefined;

    u.lang = req.voice?.lang ?? req.lang;
    u.rate = req.rate;
    if (native) u.voice = native;

    // Cancelled utterances still fire end/error in some browsers; only the current one may report.
    function live(): boolean {
      return current === u;
    }

    u.onstart = () => {
      if (live()) handlers.onStart?.();
    };
    u.onboundary = (e) => {
      if (live() && e.name !== "sentence") handlers.onWord(e.charIndex);
    };
    u.onend = () => {
      if (!live()) return;

      current = null;
      handlers.onEnd();
    };
    u.onerror = (e) => {
      if (!live()) return;

      current = null;
      handlers.onError({ code: e.error, message: `Speech failed: ${e.error}` });
    };

    current = u;
    // A paused synth (left over from another script) silently queues new utterances forever.
    if (synth.paused) synth.resume();
    synth.speak(u);
  }

  return {
    id: "webspeech",
    reliablePause: false,

    getVoices() {
      return loadVoices(synth);
    },

    speak(req, handlers) {
      if (stop()) {
        pending = setTimeout(() => start(req, handlers), AFTER_CANCEL_DELAY_MS);
      } else {
        start(req, handlers);
      }
    },

    pause() {
      synth.pause();
    },

    resume() {
      synth.resume();
    },

    cancel() {
      stop();
    },
  };
}
