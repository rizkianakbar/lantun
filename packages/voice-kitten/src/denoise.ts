// The model's vocoder leaves a noise bed about 35 dB under the voice (-49 dBFS), clearly audible
// in pauses on headphones: mostly a low rumble under 150 Hz, plus hiss around 4–8 kHz. Removed in
// two steps: a high-pass under the lowest voices, then spectral gating (learn the noise from the
// clip's quietest frames, turn down each frequency bin that is not clearly above it).
// Runs in the worker, about 6 ms per second of audio.

const SIZE = 512;
const HOP = SIZE / 4;
// Hiss is random, so a bin's level swings well above its average. Bins under the noise mean plus
// this many standard deviations are noise; twice that threshold or more passes untouched.
const STD_ABOVE = 1.5;
const PASS = 2;
// How far noise is turned down, not to zero: a little left keeps speech tails natural.
const FLOOR = 0.06;
// Share of frames treated as noise when learning the profile.
const QUIET_SHARE = 0.15;
// Fade at clip edges so a trimmed edge cannot click.
const FADE_SAMPLES = 120;

// Below the lowest speaking voice (male fundamentals start around 85 Hz).
const HIGH_PASS_HZ = 75;

// Second-order Butterworth high-pass (RBJ biquad), applied in place.
export const highPass = (
  x: Float32Array,
  sampleRate: number,
  hz = HIGH_PASS_HZ,
): void => {
  const w = (2 * Math.PI * hz) / sampleRate;
  const alpha = Math.sin(w) / Math.SQRT2;
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] ?? 0;
    const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
};

const HANN = Float32Array.from(
  { length: SIZE },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SIZE),
);

// In-place iterative radix-2 FFT; `inverse` without the 1/N scaling.
const fft = (re: Float32Array, im: Float32Array, inverse: boolean): void => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = (re[b] as number) * cr - (im[b] as number) * ci;
        const xi = (re[b] as number) * ci + (im[b] as number) * cr;
        re[b] = (re[a] as number) - xr;
        im[b] = (im[a] as number) - xi;
        re[a] = (re[a] as number) + xr;
        im[a] = (im[a] as number) + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
};

export const denoise = (
  samples: Float32Array,
  sampleRate: number,
): Float32Array<ArrayBuffer> => {
  const input = Float32Array.from(samples);
  highPass(input, sampleRate);
  const bins = SIZE / 2 + 1;
  const frames = Math.max(1, Math.ceil((input.length + SIZE) / HOP));
  // Pad half a window on each side so the edges are covered by full overlaps.
  const padded = new Float32Array(frames * HOP + SIZE);
  padded.set(input, SIZE / 2);

  const mags: Float32Array[] = [];
  const spectra: { re: Float32Array; im: Float32Array }[] = [];
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const re = new Float32Array(SIZE);
    const im = new Float32Array(SIZE);
    for (let i = 0; i < SIZE; i++)
      re[i] = (padded[f * HOP + i] ?? 0) * (HANN[i] ?? 0);
    fft(re, im, false);
    const mag = new Float32Array(bins);
    let e = 0;
    for (let k = 0; k < bins; k++) {
      mag[k] = Math.hypot(re[k] ?? 0, im[k] ?? 0);
      e += (mag[k] ?? 0) ** 2;
    }
    mags.push(mag);
    spectra.push({ re, im });
    energy[f] = e;
  }

  // Noise profile per bin from the quietest frames (pauses between words): mean + spread.
  const order = Array.from(energy.keys()).sort(
    (a, b) => (energy[a] ?? 0) - (energy[b] ?? 0),
  );
  const quiet = order.slice(0, Math.max(4, Math.floor(frames * QUIET_SHARE)));
  const threshold = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    let sum = 0;
    let sq = 0;
    for (const f of quiet) {
      const m = mags[f]?.[k] ?? 0;
      sum += m;
      sq += m * m;
    }
    const mean = sum / quiet.length;
    threshold[k] =
      mean +
      STD_ABOVE * Math.sqrt(Math.max(0, sq / quiet.length - mean * mean));
  }

  // Soft mask per bin, smoothed across neighbouring bins and over time: hard per-bin decisions
  // leave "musical noise" (random chirps) that is worse than the hiss.
  const out = new Float32Array(padded.length);
  const norm = new Float32Array(padded.length);
  let prev = new Float32Array(bins).fill(1);
  for (let f = 0; f < frames; f++) {
    const mag = mags[f] as Float32Array;
    const raw = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      // At or under the threshold: FLOOR. PASS times above it or more: untouched. Smooth between.
      const snr = (mag[k] ?? 0) / ((threshold[k] ?? 0) + 1e-9);
      const t = Math.min(1, Math.max(0, (snr - 1) / (PASS - 1)));
      raw[k] = FLOOR + (1 - FLOOR) * t * t * (3 - 2 * t);
    }
    const gain = new Float32Array(bins);
    for (let k = 0; k < bins; k++) {
      const smooth =
        ((raw[k - 1] ?? raw[k] ?? 0) +
          2 * (raw[k] ?? 0) +
          (raw[k + 1] ?? raw[k] ?? 0)) /
        4;
      // Open instantly for speech onsets, close gently over a few frames.
      gain[k] = Math.max(smooth, (prev[k] ?? 0) * 0.5);
    }
    prev = gain;
    const { re, im } = spectra[f] as { re: Float32Array; im: Float32Array };
    for (let k = 0; k < bins; k++) {
      const g = gain[k] ?? 1;
      re[k] = (re[k] ?? 0) * g;
      im[k] = (im[k] ?? 0) * g;
      // Mirror for the real-valued inverse.
      if (k > 0 && k < SIZE / 2) {
        re[SIZE - k] = re[k] ?? 0;
        im[SIZE - k] = -(im[k] ?? 0);
      }
    }
    fft(re, im, true);
    for (let i = 0; i < SIZE; i++) {
      const w = HANN[i] ?? 0;
      out[f * HOP + i] = (out[f * HOP + i] ?? 0) + ((re[i] ?? 0) / SIZE) * w;
      norm[f * HOP + i] = (norm[f * HOP + i] ?? 0) + w * w;
    }
  }

  const result = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const n = norm[i + SIZE / 2] ?? 0;
    result[i] = n > 1e-6 ? (out[i + SIZE / 2] ?? 0) / n : 0;
  }
  const fade = Math.min(FADE_SAMPLES, result.length >> 1);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    result[i] = (result[i] ?? 0) * g;
    result[result.length - 1 - i] = (result[result.length - 1 - i] ?? 0) * g;
  }
  return result;
};

// Voices and sentences come out of the model at different levels; a steady level sounds like
// one speaker in one room. Measured on the loud end of the speech (90th-percentile 20 ms window),
// with headroom kept so peaks never clip.
const TARGET_RMS = 0.2;
const MAX_PEAK = 0.95;
const GAIN_RANGE = 2;

export const level = (
  x: Float32Array<ArrayBuffer>,
  sampleRate: number,
): Float32Array<ArrayBuffer> => {
  const win = Math.round(sampleRate * 0.02);
  const windows: number[] = [];
  let peak = 0;
  for (let i = 0; i + win <= x.length; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) {
      const v = x[j] ?? 0;
      s += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    windows.push(Math.sqrt(s / win));
  }
  if (!windows.length || peak === 0) return x;
  windows.sort((a, b) => a - b);
  const loud = windows[Math.floor(windows.length * 0.9)] ?? 0;
  const gain = Math.min(
    GAIN_RANGE,
    Math.max(1 / GAIN_RANGE, TARGET_RMS / (loud || 1)),
    MAX_PEAK / peak,
  );
  for (let i = 0; i < x.length; i++) x[i] = (x[i] ?? 0) * gain;
  return x;
};
