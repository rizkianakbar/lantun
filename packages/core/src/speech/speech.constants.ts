export const VOICES_TIMEOUT_MS = 1500;
// Chrome can drop a speak() issued straight after cancel(); a short gap avoids it.
export const AFTER_CANCEL_DELAY_MS = 50;

// Starting guess for speaking speed at rate 1, refined per voice from measured utterances.
export const DEFAULT_CPS = 14;
// Weight of the newest measurement; smooths out sentences with long pauses in them.
export const LEARN_WEIGHT = 0.4;
// Utterances shorter than this are dominated by start-up latency, so they teach nothing.
export const MIN_LEARN_MS = 500;
export const MIN_LEARN_CHARS = 20;
// How long to wait for a first boundary event before deciding a voice has none.
export const DETECT_BOUNDARIES_MS = 500;
