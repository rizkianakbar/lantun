export const SIZE = 512;
export const HALF = SIZE / 2;
export const HOP = SIZE / 4;
export const BINS = HALF + 1;
// Hiss is random, so a bin's level swings well above its average. Bins under the noise mean plus
// this many standard deviations are noise; twice that threshold or more passes untouched.
export const STD_ABOVE = 1.5;
export const PASS = 2;
// How far noise is turned down, not to zero: a little left keeps speech tails natural.
export const FLOOR = 0.06;
// Share of frames treated as noise when learning the profile.
export const QUIET_SHARE = 0.15;
// Fade at clip edges so a trimmed edge cannot click.
export const FADE_SAMPLES = 120;
// Below the lowest speaking voice (male fundamentals start around 85 Hz).
export const HIGH_PASS_HZ = 75;

// Voices and sentences come out of the model at different levels; a steady level sounds like
// one speaker in one room. Measured on the loud end of the speech (90th-percentile 20 ms window),
// with headroom kept so peaks never clip.
export const TARGET_RMS = 0.2;
export const MAX_PEAK = 0.95;
export const GAIN_RANGE = 2;

// Size of a canonical WAV header.
export const HEADER_BYTES = 44;
