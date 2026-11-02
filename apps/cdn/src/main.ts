import { applySavedAx, init, optionsFromDataset, registerVoices, type VoiceEngine } from "@lantun/core";

export { destroy, init, on, pause, play, registerVoices } from "@lantun/core";

type HostWindow = Window & { __lantunVoices?: VoiceEngine[] };

// Voice add-ons loaded before this file queue themselves here (voice-kitten.js and friends).
(window as HostWindow).__lantunVoices?.splice(0).forEach(registerVoices);

// currentScript is only set while this file is executing, so read it before deferring.
const script = document.currentScript as HTMLScriptElement | null;
const options = script ? optionsFromDataset(script.dataset) : {};

// A page with a strict CSP has to give this tag a nonce; our <style> elements reuse it.
if (script?.nonce) options.nonce = script.nonce;

// Returning readers get their accessibility settings now, not after DOMContentLoaded. With the
// tag in <head> (no defer) this lands before first paint.
try {
  if (options.features?.a11y !== false) {
    applySavedAx(document, options.nonce ?? null);
  }
} catch (err) {
  console.warn("[Lantun]", err);
}

function start(): void {
  init(options);
}

// Publishers who call LantunReader.init() themselves opt out of auto-init.
if (script?.dataset.autoInit !== "false") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
