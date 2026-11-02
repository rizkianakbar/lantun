export const SAMPLE_RATE = 24000;
// Samples per frame of the model's duration output.
export const HOP = 600;

export const CACHE = "lantun-voice-kitten-v1";
// The model pads every clip with a tail of silence (KittenTTS trims the same amount).
export const TRIM_SAMPLES = 5000;
export const LEAD_KEEP_SAMPLES = 1200;
// Phonemised runs kept before the cache starts over.
export const PHONEME_CACHE = 5000;
