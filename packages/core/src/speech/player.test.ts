import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { segment } from "../segment/segment";
import {
  createFakeDriver,
  createFakeEngine,
  type FakeDriverOptions,
} from "./fake-driver";
import { createPlayer } from "./player";
import type { PlayerEventMap } from "./player.types";
import { clampRate } from "./player.lib";

type Log = { [K in keyof PlayerEventMap]: PlayerEventMap[K][] };

const TEXT = "First sentence here. Second one is a bit longer. Third and last.";

const setup = (driverOpts: FakeDriverOptions = {}, text = TEXT) => {
  const driver = createFakeDriver(driverOpts);
  const log: Log = { state: [], sentence: [], word: [], end: [], error: [] };
  const player = createPlayer({
    driver,
    text,
    sentences: segment(text, "en"),
    lang: "en",
    emit: (type, payload) => {
      log[type].push(payload);
    },
  });
  const of = <K extends keyof PlayerEventMap>(k: K): PlayerEventMap[K][] =>
    log[k];
  return { driver, player, of };
};

beforeEach(() => vi.useFakeTimers({ loopLimit: 100_000 }));
afterEach(() => vi.useRealTimers());

describe("createPlayer", () => {
  it("speaks one utterance per sentence, in order, then ends", () => {
    const { driver, player, of } = setup();
    player.play();
    vi.runAllTimers();
    expect(driver.spoken.map((r) => r.text)).toEqual([
      "First sentence here.",
      "Second one is a bit longer.",
      "Third and last.",
    ]);
    expect(of("sentence").map((s) => s.index)).toEqual([0, 1, 2]);
    expect(of("end")).toHaveLength(1);
    expect(of("state")).toEqual(["playing", "ended"]);
  });

  it("emits words with absolute offsets into the article text", () => {
    const { player, of } = setup();
    player.play();
    vi.runAllTimers();
    const words = of("word");
    expect(words.map((w) => w.text).slice(0, 4)).toEqual([
      "First",
      "sentence",
      "here",
      "Second",
    ]);
    for (const w of words) expect(TEXT.slice(w.start, w.end)).toBe(w.text);
    expect(words.find((w) => w.text === "longer")?.sentence).toBe(1);
  });

  it("pauses by cancelling and resumes from the last spoken word", () => {
    const { driver, player, of } = setup({ wordMs: 100 });
    player.play();
    vi.advanceTimersByTime(150); // "First", "sentence" spoken
    player.pause();
    expect(player.getState().status).toBe("paused");
    vi.advanceTimersByTime(10_000);
    expect(of("end")).toHaveLength(0);
    player.play();
    expect(driver.spoken.at(-1)?.text).toBe("sentence here.");
    vi.runAllTimers();
    // Offsets stay absolute after resuming mid-sentence.
    for (const w of of("word")) expect(TEXT.slice(w.start, w.end)).toBe(w.text);
    expect(of("end")).toHaveLength(1);
  });

  it("uses native pause/resume when the driver supports it", () => {
    const { driver, player } = setup({ reliablePause: true });
    const pause = vi.spyOn(driver, "pause");
    const resume = vi.spyOn(driver, "resume");
    const cancel = vi.spyOn(driver, "cancel");
    player.play();
    player.pause();
    player.play();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("jumps with next/prev and ignores the cancelled utterance", () => {
    const { driver, player, of } = setup();
    player.play();
    vi.advanceTimersByTime(50);
    player.next();
    expect(driver.spoken.at(-1)?.text).toBe("Second one is a bit longer.");
    player.prev();
    player.prev(); // clamps at 0
    expect(driver.spoken.at(-1)?.text).toBe("First sentence here.");
    vi.runAllTimers();
    expect(of("sentence").map((s) => s.index)).toEqual([0, 1, 0, 0, 1, 2]);
    expect(of("end")).toHaveLength(1);
  });

  it("rewinds to the start of a long sentence before stepping back a sentence", () => {
    const long =
      "Short one. This sentence goes on for quite a while before it ends.";
    const { driver, player, of } = setup({}, long);
    player.play(1);
    // Let the words run past the rewind threshold, then press back twice.
    while ((of("word").at(-1)?.start ?? 0) - 11 <= 30)
      vi.advanceTimersByTime(50);
    player.prev();
    expect(of("sentence").at(-1)?.index).toBe(1);
    expect(driver.spoken.at(-1)?.text).toBe(long.slice(11));
    player.prev();
    expect(of("sentence").at(-1)?.index).toBe(0);
  });

  it("moves position without speaking while paused", () => {
    const { driver, player, of } = setup();
    player.seek(2);
    expect(driver.spoken).toHaveLength(0);
    expect(of("sentence").at(-1)?.index).toBe(2);
    player.play();
    expect(driver.spoken[0]?.text).toBe("Third and last.");
  });

  it("next on the last sentence ends playback; play afterwards restarts", () => {
    const { driver, player, of } = setup();
    player.play(2);
    player.next();
    expect(of("end")).toHaveLength(1);
    player.play();
    expect(driver.spoken.at(-1)?.text).toBe("First sentence here.");
  });

  it("applies a rate change by re-speaking from the current word", () => {
    const { driver, player } = setup({ wordMs: 100 });
    player.play();
    vi.advanceTimersByTime(150);
    player.setRate(2);
    expect(driver.spoken.at(-1)).toMatchObject({
      text: "sentence here.",
      rate: 2,
    });
  });

  it("clamps rate to 0.5–3 in 0.25 steps", () => {
    expect([0.1, 0.6, 1.1, 2.9, 9, Number.NaN].map(clampRate)).toEqual([
      0.5, 0.5, 1, 3, 3, 1,
    ]);
  });

  it("treats an outside interruption as a pause", () => {
    const { player } = setup({ failures: ["interrupted"] });
    player.play();
    vi.runAllTimers();
    expect(player.getState().status).toBe("paused");
  });

  it("stops on not-allowed (autoplay policy) and reports it", () => {
    const { player, of } = setup({ failures: ["not-allowed"] });
    player.play();
    vi.runAllTimers();
    expect(player.getState().status).toBe("idle");
    expect(of("error").map((e) => e.code)).toEqual(["not-allowed"]);
  });

  it("retries a failing sentence, then skips it with an error", () => {
    const { driver, player, of } = setup({
      failures: ["synthesis-failed", "synthesis-failed", "synthesis-failed"],
    });
    player.play();
    vi.runAllTimers();
    expect(driver.spoken.slice(0, 4).map((r) => r.text)).toEqual([
      "First sentence here.",
      "First sentence here.",
      "First sentence here.",
      "Second one is a bit longer.",
    ]);
    expect(of("error").map((e) => e.code)).toEqual(["synthesis-failed"]);
    expect(of("end")).toHaveLength(1);
  });

  it("recovers from a stalled utterance by re-speaking from the last word", () => {
    const { driver, player, of } = setup({ stalls: 1, stallAfterWords: 2 });
    player.play();
    vi.runAllTimers();
    expect(driver.spoken[1]?.text).toBe("sentence here.");
    expect(of("error")).toHaveLength(0);
    expect(of("end")).toHaveLength(1);
  });

  it("skips a sentence that keeps stalling", () => {
    const { player, of } = setup({ stalls: 3, stallAfterWords: 0 });
    player.play();
    vi.runAllTimers();
    expect(of("error").map((e) => e.code)).toEqual(["stalled"]);
    expect(of("sentence").map((s) => s.index)).toEqual([0, 0, 0, 1, 2]);
    expect(of("end")).toHaveLength(1);
  });

  it("reads a 5,000+ word article to the end", () => {
    const sentence =
      "This is sentence number %, and it carries a handful of perfectly ordinary words.";
    const text = Array.from({ length: 400 }, (_, i) =>
      sentence.replace("%", String(i + 1)),
    ).join(" ");
    const { driver, player, of } = setup({ wordMs: 10 }, text);
    expect(text.split(/\s+/).length).toBeGreaterThan(5000);
    player.play();
    vi.runAllTimers();
    expect(driver.spoken).toHaveLength(400);
    expect(of("word").length).toBeGreaterThan(5000);
    expect(of("error")).toHaveLength(0);
    expect(of("end")).toHaveLength(1);
  });

  it("breathes between paragraphs but not between sentences", () => {
    const text = "One here. Two here.\nThree here.";
    const { driver, player } = setup({ wordMs: 100 }, text);
    player.play();
    vi.advanceTimersByTime(200); // "One here." ends
    expect(driver.spoken).toHaveLength(2);
    vi.advanceTimersByTime(200); // "Two here." ends at a paragraph break
    expect(driver.spoken).toHaveLength(2);
    vi.advanceTimersByTime(350);
    expect(driver.spoken.at(-1)?.text).toBe("Three here.");
  });

  it("pausing during a paragraph break resumes at the next paragraph", () => {
    const text = "One here.\nTwo here.";
    const { driver, player } = setup({ wordMs: 100 }, text);
    player.play();
    vi.advanceTimersByTime(250);
    player.pause();
    vi.advanceTimersByTime(1000);
    expect(driver.spoken).toHaveLength(1);
    player.play();
    expect(driver.spoken.at(-1)?.text).toBe("Two here.");
  });

  it("stops speaking on destroy", () => {
    const { player, of } = setup();
    player.play();
    player.destroy();
    vi.runAllTimers();
    expect(of("end")).toHaveLength(0);
  });
});

describe("engines that synthesise first", () => {
  it("starts the stall watchdog only once audio starts", async () => {
    const engine = createFakeEngine("slow", { wordMs: 100 });
    // Audio takes far longer than the watchdog allows before it starts: no stall must be reported.
    const speak = engine.speak.bind(engine);
    engine.speak = (req, h) => {
      setTimeout(() => speak(req, h), 60_000);
    };
    const emit = vi.fn();
    const p = createPlayer({
      driver: engine,
      text: TEXT,
      sentences: segment(TEXT, "en"),
      lang: "en",
      emit,
    });
    p.play();
    await vi.advanceTimersByTimeAsync(61_000);
    expect(emit).not.toHaveBeenCalledWith("error", expect.anything());
    p.destroy();
  });
});

describe("engines that change speed live", () => {
  it("passes a new rate straight to the engine instead of re-speaking", () => {
    const engine = Object.assign(createFakeEngine("live", { wordMs: 100 }), {
      liveRate: true,
      setRate: vi.fn(),
    });
    const p = createPlayer({
      driver: engine,
      text: TEXT,
      sentences: segment(TEXT, "en"),
      lang: "en",
      emit: () => {},
    });
    p.play();
    p.setRate(1.5);
    expect(engine.setRate).toHaveBeenCalledWith(1.5);
    expect(engine.spoken).toHaveLength(1);
    p.destroy();
  });
});
