import { describe, expect, it } from "vitest";
import { denoise, highPass, level } from "./audio.lib";

const RATE = 24000;
// Deterministic hiss, so the test does not flake.
const hiss = (n: number, level: number): Float32Array => {
  let seed = 7;
  return Float32Array.from({ length: n }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return (seed / 2147483648 - 0.5) * 2 * level;
  });
};
const rms = (x: Float32Array, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] ?? 0) ** 2;
  return Math.sqrt(s / (to - from));
};
const db = (v: number) => 20 * Math.log10(v);

describe("denoise", () => {
  // One second: a 220 Hz "voiced" tone in the middle half, hiss throughout.
  const n = RATE;
  const signal = hiss(n, 0.006);
  for (let i = n / 4; i < (3 * n) / 4; i++)
    signal[i] = (signal[i] ?? 0) + 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  const out = denoise(signal, RATE);

  it("keeps the length", () => {
    expect(out.length).toBe(signal.length);
  });

  it("turns hiss in the pauses down by at least 15 dB", () => {
    const before = db(rms(signal, 1000, n / 4 - 1000));
    const after = db(rms(out, 1000, n / 4 - 1000));
    expect(before - after).toBeGreaterThan(15);
  });

  it("leaves the voice level within half a decibel", () => {
    const before = db(rms(signal, n / 4 + 2000, (3 * n) / 4 - 2000));
    const after = db(rms(out, n / 4 + 2000, (3 * n) / 4 - 2000));
    expect(Math.abs(before - after)).toBeLessThan(0.5);
  });

  it("removes rumble below the voice but keeps a low voice", () => {
    const tone = (hz: number) => Float32Array.from({ length: RATE }, (_, i) => Math.sin((2 * Math.PI * hz * i) / RATE));
    const rumble = tone(30);
    const voice = tone(120);
    highPass(rumble, RATE);
    highPass(voice, RATE);
    expect(db(rms(rumble, RATE / 2))).toBeLessThan(-12);
    expect(db(rms(voice, RATE / 2))).toBeGreaterThan(-4);
  });

  it("fades the clip edges so a trim cannot click", () => {
    expect(out[0]).toBe(0);
  });
});

describe("level", () => {
  const tone = (amp: number) =>
    Float32Array.from({ length: RATE }, (_, i) => amp * Math.sin((2 * Math.PI * 200 * i) / RATE));

  it("brings quiet and loud clips to the same level", () => {
    const quiet = level(tone(0.15), RATE);
    const loud = level(tone(0.4), RATE);
    expect(Math.abs(db(rms(quiet)) - db(rms(loud)))).toBeLessThan(0.1);
  });

  it("never pushes peaks into clipping", () => {
    const spiky = tone(0.05);
    spiky[100] = 0.9;
    level(spiky, RATE);
    expect(Math.max(...Array.from(spiky, Math.abs))).toBeLessThanOrEqual(0.95);
  });
});
