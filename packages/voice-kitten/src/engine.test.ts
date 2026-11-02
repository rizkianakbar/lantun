import type { SpeakHandlers, SpeakRequest } from "@lantun/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKittenEngine, splitFirstClause } from "./engine";
import type { FromWorker, ToWorker } from "./protocol";

// Just enough of HTMLAudioElement: a media clock the test moves, and an end it can trigger.
class FakeAudio {
  static last: FakeAudio;
  src = "";
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = true;
  preload = "";
  onended: (() => void) | null = null;
  played: string[] = [];
  refuse = false;
  constructor() {
    FakeAudio.last = this;
  }
  play() {
    this.played.push(this.src);
    return this.refuse
      ? Promise.reject(
          Object.assign(new Error("blocked"), { name: "NotAllowedError" }),
        )
      : Promise.resolve();
  }
  pause = vi.fn();
  end() {
    this.onended?.();
  }
}

class FakeWorker {
  sent: ToWorker[] = [];
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(msg: ToWorker) {
    this.sent.push(msg);
  }
  terminate() {}
  reply(msg: FromWorker) {
    this.onmessage?.({ data: msg } as MessageEvent<FromWorker>);
  }
  synths() {
    return this.sent.filter(
      (m): m is Extract<ToWorker, { type: "synth" }> => m.type === "synth",
    );
  }
}

const win = (extra: Record<string, unknown> = {}) =>
  ({
    navigator: { ...extra },
    Worker: FakeWorker,
    Audio: FakeAudio,
  }) as unknown as Window;
const handlers = (): SpeakHandlers & { words: number[] } => {
  const words: number[] = [];
  return {
    words,
    onStart: vi.fn(),
    onWord: (i) => words.push(i),
    onEnd: vi.fn(),
    onError: vi.fn(),
  };
};

let worker: FakeWorker;
const setup = (w = win()) => {
  worker = new FakeWorker();
  return createKittenEngine(() => worker as unknown as Worker, {}, w);
};
const jasper = {
  id: "kitten:Jasper",
  name: "Jasper",
  lang: "en-US",
  local: true,
  isDefault: false,
  engine: "kitten",
};
const req = (text: string, rate = 1): SpeakRequest => ({
  text,
  lang: "en",
  rate,
  voice: jasper,
});
// Word starts spread evenly over the clip unless given.
const audio = (
  id: number,
  seconds: number,
  ms = 300,
  starts = [0, seconds / 3, (2 * seconds) / 3],
) =>
  worker.reply({
    type: "audio",
    id,
    samples: new Float32Array(seconds * 24000),
    starts: new Float32Array(starts),
    ms,
  });
const flush = () => vi.advanceTimersByTimeAsync(0);
const LONG =
  "The council met on Tuesday evening, and after a long debate it voted to rebuild the old bridge next spring.";

beforeEach(() => {
  vi.useFakeTimers();
  let n = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(Object.create(URL), {
      createObjectURL: () => `blob:${++n}`,
      revokeObjectURL: vi.fn(),
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("splitFirstClause", () => {
  const texts = (t: string) => splitFirstClause(t).map((p) => p.text);

  it("splits a long sentence after its first clause", () => {
    const parts = splitFirstClause(LONG);
    expect(parts.map((p) => p.text)).toEqual([
      "The council met on Tuesday evening,",
      "and after a long debate it voted to rebuild the old bridge next spring.",
    ]);
    expect(LONG.slice(parts[1]?.offset)).toBe(parts[1]?.text);
  });

  it("never cuts where the sentence has no pause of its own", () => {
    const text =
      "A sourdough starter is nothing more than flour and water that has been left alone long enough for wild yeast to move in.";
    expect(texts(text)).toEqual([text]);
    expect(texts("Short, sweet.")).toEqual(["Short, sweet."]);
  });
});

describe("kitten engine", () => {
  it("offers eight English voices without downloading anything", async () => {
    const engine = setup();
    const voices = await engine.getVoices();
    expect(voices.map((v) => v.name)).toEqual([
      "Jasper",
      "Luna",
      "Bruno",
      "Rosie",
      "Hugo",
      "Kiki",
      "Leo",
    ]);
    expect(voices.every((v) => v.engine === "kitten" && v.downloadBytes)).toBe(
      true,
    );
    expect(worker.sent).toEqual([]);
  });

  it("offers nothing to readers who asked to save data", async () => {
    expect(
      await setup(win({ connection: { saveData: true } })).getVoices(),
    ).toEqual([]);
  });

  it("loads on first use, reporting progress, then plays words when the model says they start", async () => {
    const engine = setup();
    const states: string[] = [];
    engine.subscribe((s) => states.push(`${s.state}:${s.progress.toFixed(1)}`));
    const h = handlers();
    engine.speak(req("Hello there, world."), h);
    expect(worker.sent[0]?.type).toBe("load");
    worker.reply({ type: "progress", loaded: 20_000_000 });
    worker.reply({ type: "ready" });
    expect(states).toEqual(["loading:0.0", "loading:0.5", "ready:1.0"]);

    audio(worker.synths()[0]?.id ?? 0, 2, 300, [0.1, 0.5, 1.4]);
    await flush();
    expect(h.onStart).toHaveBeenCalled();
    expect(h.words).toEqual([]);
    FakeAudio.last.currentTime = 0.6;
    await vi.advanceTimersByTimeAsync(40);
    expect(h.words).toEqual([0, 6]);
    FakeAudio.last.currentTime = 1.5;
    await vi.advanceTimersByTimeAsync(40);
    expect(h.words).toEqual([0, 6, 13]);
    FakeAudio.last.end();
    expect(h.onEnd).toHaveBeenCalled();
  });

  it("makes clips at each voice's calibrated pace and applies the reader's speed at playback", async () => {
    const engine = setup();
    engine.speak(req("Hi.", 1.5), handlers());
    engine.speak(
      { ...req("Hi."), voice: { ...jasper, id: "kitten:Kiki", name: "Kiki" } },
      handlers(),
    );
    expect(worker.synths().map((m) => [m.voice, m.speed])).toEqual([
      ["Jasper", 0.78],
      ["Kiki", 0.77],
    ]);
  });

  it("changes speed live, without making the clip again", async () => {
    const engine = setup();
    engine.speak(req("Hello."), handlers());
    audio(worker.synths()[0]?.id ?? 0, 1);
    await flush();
    engine.setRate?.(2);
    expect(FakeAudio.last.playbackRate).toBe(2);
    expect(worker.synths()).toHaveLength(1);
    expect(engine.liveRate).toBe(true);
  });

  it("starts a long sentence that is not ready at its first comma, reporting words at their place in it", async () => {
    const engine = setup();
    const h = handlers();
    engine.speak(req(LONG), h);
    const [head, tail] = worker.synths();
    expect([head?.text, tail?.text]).toEqual(
      splitFirstClause(LONG).map((p) => p.text),
    );
    audio(head?.id ?? 0, 2, 300, [0, 0.4, 0.8, 1.2, 1.6, 1.9]);
    await flush();
    expect(h.onStart).toHaveBeenCalled();
    FakeAudio.last.currentTime = 2;
    FakeAudio.last.end();
    audio(tail?.id ?? 0, 2, 300, [0.05]);
    await flush();
    FakeAudio.last.currentTime = 0.1;
    await vi.advanceTimersByTimeAsync(40);
    // The tail's first word is reported at its offset in the whole sentence.
    expect(h.words.at(-1)).toBe(LONG.indexOf("and after"));
  });

  it("prefetches whole sentences and plays them from cache, without making them again", async () => {
    const engine = setup();
    engine.speak(req("First."), handlers());
    engine.prepare?.(req(LONG));
    engine.speak(req(LONG), handlers());
    await flush();
    expect(worker.synths().map((m) => m.text)).toEqual(["First.", LONG]);
    // Skipping on drops queued work for anything but what is now wanted.
    expect(worker.sent.at(-1)).toEqual({
      type: "drop",
      keep: [worker.synths()[1]?.id],
    });
  });

  it("keeps the next sentence it is already making when playback moves on normally", async () => {
    const engine = setup();
    engine.speak(req("One."), handlers());
    engine.prepare?.(req("Two."));
    engine.prepare?.(req("Three is a long one."));
    await flush();
    // "One." ends; the player speaks "Two." and prefetches the two after it.
    engine.speak(req("Two."), handlers());
    engine.prepare?.(req("Three is a long one."));
    engine.prepare?.(req("Four."));
    await flush();
    expect(worker.synths().map((m) => m.text)).toEqual([
      "One.",
      "Two.",
      "Three is a long one.",
      "Four.",
    ]);
    const drop = worker.sent.at(-1);
    expect(drop?.type === "drop" && drop.keep.sort()).toEqual([2, 3, 4]);
  });

  it("never reuses a clip that a skip just cancelled", async () => {
    const engine = setup();
    engine.prepare?.(req("Later."));
    // The reader jumps elsewhere: the queued clip for "Later." is cancelled...
    engine.speak(req("Elsewhere."), handlers());
    await flush();
    // ...and when playback comes back to it, it is made again rather than waited on forever.
    const h = handlers();
    engine.speak(req("Later."), h);
    const later = worker.synths().filter((m) => m.text === "Later.");
    expect(later).toHaveLength(2);
    audio(later[1]?.id ?? 0, 1);
    await flush();
    expect(h.onStart).toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("starts loading and synthesising on a prefetch hint, before anything is played", () => {
    const engine = setup();
    engine.prepare?.(req("First."));
    expect(worker.sent.map((m) => m.type)).toEqual(["load", "synth"]);
    expect(engine.status().state).toBe("loading");
  });

  it("holds a clip that arrives while paused until the reader resumes", async () => {
    const engine = setup();
    const h = handlers();
    engine.speak(req("Hello."), h);
    engine.pause();
    audio(worker.synths()[0]?.id ?? 0, 1);
    await flush();
    expect(h.onStart).not.toHaveBeenCalled();
    engine.resume();
    await flush();
    expect(h.onStart).toHaveBeenCalled();
  });

  it("ignores audio for an utterance that was cancelled", async () => {
    const engine = setup();
    const h = handlers();
    engine.speak(req("Hello."), h);
    engine.cancel();
    audio(worker.synths()[0]?.id ?? 0, 1);
    await flush();
    expect(h.onStart).not.toHaveBeenCalled();
  });

  it("reports a browser that refuses to play without a click", async () => {
    const engine = setup();
    const h = handlers();
    engine.speak(req("Hello."), h);
    FakeAudio.last.refuse = true;
    audio(worker.synths()[0]?.id ?? 0, 1);
    await flush();
    expect(h.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "not-allowed" }),
    );
  });

  it("reports a device that cannot keep up with listening speed", async () => {
    const engine = setup();
    const errors: (string | undefined)[] = [];
    engine.subscribe((s) => s.state === "error" && errors.push(s.error));
    // 0.5 s of synthesis per 1 s of audio keeps up at 1×, but not when listening at 2×.
    engine.speak(req("One.", 2), handlers());
    worker.reply({ type: "ready" });
    for (const [i, text] of ["Two.", "Three.", "Four."].entries()) {
      engine.prepare?.(req(text, 2));
      audio(worker.synths()[i]?.id ?? 0, 2, 1000);
    }
    expect(errors).toEqual([]);
    audio(worker.synths()[3]?.id ?? 0, 2, 1000);
    expect(errors).toEqual(["slow"]);
  });

  it("fails cleanly when the page forbids workers", () => {
    const engine = createKittenEngine(
      () => {
        throw new Error("CSP");
      },
      {},
      win(),
    );
    const h = handlers();
    engine.speak(req("Hello."), h);
    expect(engine.status()).toEqual({
      state: "error",
      progress: 0,
      error: "failed",
    });
    expect(h.onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "engine-failed" }),
    );
  });

  it("reports a load failure from the worker", () => {
    const engine = setup();
    engine.speak(req("Hello."), handlers());
    worker.reply({ type: "error", message: "HTTP 404" });
    expect(engine.status().error).toBe("failed");
  });
});
