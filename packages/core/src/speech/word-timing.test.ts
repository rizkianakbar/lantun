import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDriver } from "./speech.mocks";
import type { SpeakHandlers, Voice } from "./speech.types";
import { withWordTiming } from "./word-timing";

const voice = (id: string): Voice => ({
  id,
  name: id,
  lang: "en",
  local: false,
  isDefault: false,
});
const req = (text: string, v: Voice | null = voice("net"), rate = 1) => ({
  text,
  lang: "en",
  rate,
  voice: v,
});
const handlers = () => {
  const words: [number, boolean | undefined][] = [];
  const h: SpeakHandlers = {
    onWord: (i, est) => words.push([i, est]),
    onEnd: vi.fn(),
    onError: vi.fn(),
  };
  return { h, words };
};

// 28 chars: word starts at 0, 4, 10, 16, 21
const TEXT = "One two three four five six.";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withWordTiming", () => {
  it("passes real boundaries through untouched", () => {
    const d = withWordTiming(createFakeDriver());
    const { h, words } = handlers();
    d.speak(req(TEXT), h);
    vi.runAllTimers();
    expect(words.every(([, est]) => est === undefined)).toBe(true);
    expect(words.map(([i]) => i)).toEqual([0, 4, 8, 14, 19, 24]);
  });

  it("estimates words after 500 ms without a boundary and reports the voice once", () => {
    const onFallback = vi.fn();
    const d = withWordTiming(createFakeDriver({ boundaries: false, wordMs: 1000 }), { onFallback });
    const { h, words } = handlers();
    d.speak(req(TEXT), h);
    vi.advanceTimersByTime(499);
    expect(words).toHaveLength(0);
    vi.advanceTimersByTime(1);
    // Late detection catches up straight to the word that should be playing now.
    expect(words).toEqual([[4, true]]);
    vi.runAllTimers();
    expect(words.map(([i]) => i)).toEqual([4, 8, 14, 19, 24]);
    expect(words.every(([, est]) => est === true)).toBe(true);
    expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({ id: "net" }), "en");

    // Known voice: estimation starts immediately, no second report.
    const second = handlers();
    d.speak(req(TEXT), second.h);
    vi.advanceTimersByTime(0);
    expect(second.words[0]).toEqual([0, true]);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });

  it("learns the speaking speed from finished utterances", () => {
    // 6 words at 2 s each = 12 s for 28 chars, far slower than the 14 chars/s default.
    const d = withWordTiming(createFakeDriver({ boundaries: false, wordMs: 2000 }));
    d.speak(req(TEXT), handlers().h);
    vi.runAllTimers();
    const { h, words } = handlers();
    d.speak(req(TEXT), h);
    vi.advanceTimersByTime(1000);
    expect(words.map(([i]) => i)).toEqual([0]); // "two" at 4 chars ≈ 1.7 s, not yet
    vi.advanceTimersByTime(1000);
    expect(words.map(([i]) => i)).toEqual([0, 4]);
  });

  it("scales estimates with the speaking rate", () => {
    // Train both on the same 1x utterance, then compare 0.5x against 2x over the same window.
    const a = withWordTiming(createFakeDriver({ boundaries: false }));
    const b = withWordTiming(createFakeDriver({ boundaries: false }));
    a.speak(req(TEXT), handlers().h);
    b.speak(req(TEXT), handlers().h);
    vi.runAllTimers();
    const slow = handlers();
    const fast = handlers();
    a.speak(req(TEXT, voice("net"), 0.5), slow.h);
    b.speak(req(TEXT, voice("net"), 2), fast.h);
    vi.advanceTimersByTime(300);
    expect(fast.words.length).toBeGreaterThan(slow.words.length);
  });

  it("tracks boundary support per voice", () => {
    const d = withWordTiming(createFakeDriver({ boundaries: false }));
    d.speak(req(TEXT, voice("a")), handlers().h);
    vi.runAllTimers();
    const onFallback = vi.fn();
    const d2 = withWordTiming(createFakeDriver(), { onFallback });
    d2.speak(req(TEXT, voice("b")), handlers().h);
    vi.runAllTimers();
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("stops estimated words on cancel", () => {
    const d = withWordTiming(createFakeDriver({ boundaries: false, wordMs: 1000 }));
    const { h, words } = handlers();
    d.speak(req(TEXT), h);
    vi.advanceTimersByTime(600);
    const count = words.length;
    d.cancel();
    vi.runAllTimers();
    expect(words).toHaveLength(count);
  });

  it("freezes estimated timing during a native pause", () => {
    const d = withWordTiming(
      createFakeDriver({
        boundaries: false,
        wordMs: 1000,
        reliablePause: true,
      }),
    );
    const { h, words } = handlers();
    d.speak(req(TEXT), h);
    vi.advanceTimersByTime(600);
    d.pause();
    const count = words.length;
    vi.advanceTimersByTime(10_000);
    expect(words).toHaveLength(count);
    d.resume();
    vi.advanceTimersByTime(2000);
    expect(words.length).toBeGreaterThan(count);
  });
});
