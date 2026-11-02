// The comfortable reading band, as fractions of viewport height. Targeting 30% from the top keeps
// text clear of the sticky headers most news portals use.
export const BAND_TOP = 0.15;
export const BAND_BOTTOM = 0.85;
export const TARGET = 0.3;

export const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
export const FIELDS = /^(INPUT|TEXTAREA|SELECT)$/;
export const LISTENER: AddEventListenerOptions = { passive: true, capture: true };

// How long auto-scroll stays off after the reader scrolls by hand .
export const PAUSE_MS = 5000;
