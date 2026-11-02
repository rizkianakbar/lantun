export const MIN_RATE = 0.5;
export const MAX_RATE = 3;
export const RATE_STEP = 0.25;

// About two seconds of speech.
export const REWIND_CHARS = 30;

// Deliberately slow estimate of speaking speed, so the stall watchdog only fires on real stalls.
export const CHARS_PER_SECOND = 14;
export const STALL_MARGIN_MS = 4000;

// Per sentence, shared by errors and stalls, before giving up and moving on.
export const MAX_RETRIES = 2;

// A short breath between paragraphs; one utterance per sentence otherwise runs them together.
export const PARAGRAPH_PAUSE_MS = 350;

// Sentences handed to driver.prepare() ahead of the one playing.
export const PREFETCH = 2;
