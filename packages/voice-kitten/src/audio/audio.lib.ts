import {
  BINS,
  FADE_SAMPLES,
  FLOOR,
  GAIN_RANGE,
  HALF,
  HEADER_BYTES,
  HIGH_PASS_HZ,
  HOP,
  MAX_PEAK,
  PASS,
  QUIET_SHARE,
  SIZE,
  STD_ABOVE,
  TARGET_RMS,
} from "./audio.constants";

// The model's vocoder leaves rumble and hiss about 35 dB under the voice, audible in pauses. Removed
// by a high-pass, then spectral gating learned from the clip's quietest frames.

const HANN = Float32Array.from({ length: SIZE }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SIZE));

// FFT tables, computed once: the transform runs twice per frame, hundreds of frames per clip.
const COS = Float64Array.from({ length: HALF }, (_, i) => Math.cos((2 * Math.PI * i) / SIZE));
const SIN = Float64Array.from({ length: HALF }, (_, i) => Math.sin((2 * Math.PI * i) / SIZE));
const BIT_REVERSED = bitReversal(SIZE);

function bitReversal(n: number): Uint16Array {
  const out = new Uint16Array(n);
  const bits = Math.log2(n);

  for (let i = 0; i < n; i++) {
    let r = 0;

    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);

    out[i] = r;
  }

  return out;
}

// Second-order Butterworth high-pass (RBJ biquad), applied in place.
export function highPass(x: Float32Array, sampleRate: number, hz = HIGH_PASS_HZ): void {
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
    const v = x[i] as number;
    const y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;

    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

// In-place iterative radix-2 FFT of SIZE points; `inverse` without the 1/N scaling.
function fft(re: Float32Array, im: Float32Array, inverse: boolean): void {
  for (let i = 0; i < SIZE; i++) {
    const j = BIT_REVERSED[i] as number;

    if (i < j) {
      const tr = re[i] as number;
      const ti = im[i] as number;

      re[i] = re[j] as number;
      im[i] = im[j] as number;
      re[j] = tr;
      im[j] = ti;
    }
  }

  const sign = inverse ? 1 : -1;

  for (let len = 2; len <= SIZE; len <<= 1) {
    const half = len >> 1;
    const step = SIZE / len;

    for (let i = 0; i < SIZE; i += len) {
      for (let k = 0; k < half; k++) {
        const cr = COS[k * step] as number;
        const ci = sign * (SIN[k * step] as number);
        const a = i + k;
        const b = a + half;
        const br = re[b] as number;
        const bi = im[b] as number;
        const xr = br * cr - bi * ci;
        const xi = br * ci + bi * cr;
        const ar = re[a] as number;
        const ai = im[a] as number;

        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
      }
    }
  }
}

// Per bin: mean plus STD_ABOVE standard deviations of the magnitude over the quietest frames.
function noiseThreshold(mags: Float32Array, frames: number): Float32Array {
  const energy = new Float64Array(frames);

  for (let f = 0; f < frames; f++) {
    let e = 0;

    for (let k = 0; k < BINS; k++) e += (mags[f * BINS + k] as number) ** 2;

    energy[f] = e;
  }

  const order = Array.from({ length: frames }, (_, f) => f).sort(
    (a, b) => (energy[a] as number) - (energy[b] as number),
  );
  const quiet = order.slice(0, Math.max(4, Math.floor(frames * QUIET_SHARE)));
  const threshold = new Float32Array(BINS);

  for (let k = 0; k < BINS; k++) {
    let sum = 0;
    let sq = 0;

    for (const f of quiet) {
      // Fewer than 4 frames exist only for tiny clips; missing frames count as silence.
      const m = mags[f * BINS + k] ?? 0;

      sum += m;
      sq += m * m;
    }

    const mean = sum / quiet.length;
    const variance = Math.max(0, sq / quiet.length - mean * mean);

    threshold[k] = mean + STD_ABOVE * Math.sqrt(variance);
  }

  return threshold;
}

function fadeEdges(x: Float32Array): void {
  const fade = Math.min(FADE_SAMPLES, x.length >> 1);

  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    const end = x.length - 1 - i;

    x[i] = (x[i] as number) * g;
    x[end] = (x[end] as number) * g;
  }
}

export function denoise(samples: Float32Array, sampleRate: number): Float32Array<ArrayBuffer> {
  const input = Float32Array.from(samples);

  highPass(input, sampleRate);

  const frames = Math.max(1, Math.ceil((input.length + SIZE) / HOP));
  // Pad half a window on each side so the edges are covered by full overlaps.
  const padded = new Float32Array(frames * HOP + SIZE);

  padded.set(input, HALF);

  // Every frame's spectrum, flat: frame f's values start at f * SIZE (f * BINS for magnitudes).
  const specRe = new Float32Array(frames * SIZE);
  const specIm = new Float32Array(frames * SIZE);
  const mags = new Float32Array(frames * BINS);

  for (let f = 0; f < frames; f++) {
    const re = specRe.subarray(f * SIZE, (f + 1) * SIZE);
    const im = specIm.subarray(f * SIZE, (f + 1) * SIZE);

    for (let i = 0; i < SIZE; i++) {
      re[i] = (padded[f * HOP + i] as number) * (HANN[i] as number);
    }

    fft(re, im, false);

    for (let k = 0; k < BINS; k++) {
      const r = re[k] as number;
      const i = im[k] as number;

      // Not Math.hypot: it is several times slower, and these values cannot overflow.
      mags[f * BINS + k] = Math.sqrt(r * r + i * i);
    }
  }

  const threshold = noiseThreshold(mags, frames);

  // Soft mask per bin, smoothed across neighbouring bins and over time: hard per-bin decisions
  // leave "musical noise" (random chirps) that is worse than the hiss.
  const out = new Float32Array(padded.length);
  const norm = new Float32Array(padded.length);
  const raw = new Float32Array(BINS);
  const gain = new Float32Array(BINS).fill(1);

  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < BINS; k++) {
      // At or under the threshold: FLOOR. PASS times above it or more: untouched. Smooth between.
      const snr = (mags[f * BINS + k] as number) / ((threshold[k] as number) + 1e-9);
      const t = Math.min(1, Math.max(0, (snr - 1) / (PASS - 1)));

      raw[k] = FLOOR + (1 - FLOOR) * t * t * (3 - 2 * t);
    }

    for (let k = 0; k < BINS; k++) {
      const here = raw[k] as number;
      const smooth = ((raw[k - 1] ?? here) + 2 * here + (raw[k + 1] ?? here)) / 4;

      // Open instantly for speech onsets, close gently over a few frames.
      gain[k] = Math.max(smooth, (gain[k] as number) * 0.5);
    }

    const re = specRe.subarray(f * SIZE, (f + 1) * SIZE);
    const im = specIm.subarray(f * SIZE, (f + 1) * SIZE);

    for (let k = 0; k < BINS; k++) {
      const g = gain[k] as number;

      re[k] = (re[k] as number) * g;
      im[k] = (im[k] as number) * g;

      // Mirror for the real-valued inverse.
      if (k > 0 && k < HALF) {
        re[SIZE - k] = re[k] as number;
        im[SIZE - k] = -(im[k] as number);
      }
    }

    fft(re, im, true);

    for (let i = 0; i < SIZE; i++) {
      const w = HANN[i] as number;
      const at = f * HOP + i;

      out[at] = (out[at] as number) + ((re[i] as number) / SIZE) * w;
      norm[at] = (norm[at] as number) + w * w;
    }
  }

  const result = new Float32Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const n = norm[i + HALF] as number;

    result[i] = n > 1e-6 ? (out[i + HALF] as number) / n : 0;
  }

  fadeEdges(result);

  return result;
}

export function level(x: Float32Array<ArrayBuffer>, sampleRate: number): Float32Array<ArrayBuffer> {
  const win = Math.round(sampleRate * 0.02);
  const windows: number[] = [];
  let peak = 0;

  for (let i = 0; i + win <= x.length; i += win) {
    let s = 0;

    for (let j = i; j < i + win; j++) {
      const v = x[j] as number;

      s += v * v;
      peak = Math.max(peak, Math.abs(v));
    }

    windows.push(Math.sqrt(s / win));
  }

  if (!windows.length || peak === 0) return x;

  windows.sort((a, b) => a - b);

  const loud = windows[Math.floor(windows.length * 0.9)] ?? 0;
  const gain = Math.min(GAIN_RANGE, Math.max(1 / GAIN_RANGE, TARGET_RMS / (loud || 1)), MAX_PEAK / peak);

  for (let i = 0; i < x.length; i++) x[i] = (x[i] as number) * gain;

  return x;
}

// 16-bit mono WAV, so clips play through an <audio> element, which changes speed without changing
// pitch (Web Audio buffers cannot).
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const v = new DataView(buf);

  function ascii(at: number, s: string): void {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  }

  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] as number));

    v.setInt16(HEADER_BYTES + i * 2, s * 0x7fff, true);
  }

  return buf;
}

// A few milliseconds of silence, played inside the reader's click so the <audio> element is
// allowed to play later, when synthesis finishes (Safari's autoplay rule is per element).
export const SILENCE = `data:audio/wav;base64,${btoa(
  String.fromCharCode(...new Uint8Array(encodeWav(new Float32Array(240), 24000))),
)}`;
