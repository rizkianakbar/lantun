import type { SpeechErrorInfo } from "../speech/speech.types";

// Speaking speed used for time estimates at 1x; close to measured rates for id/en voices.
export const CHARS_PER_SECOND = 15;

export const ERRORS: Record<"unsupported" | "no-content", SpeechErrorInfo> = {
  unsupported: { code: "unsupported", message: "This browser cannot read text aloud." },
  "no-content": { code: "no-content", message: "No readable article text found." },
};

export const POSITIONS_KEY = "positions";
export const SETTINGS_KEY = "settings";
export const MAX_SAVED_POSITIONS = 40;
export const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_|ref$|_ga$)/;
