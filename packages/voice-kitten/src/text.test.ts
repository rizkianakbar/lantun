import { describe, expect, it } from "vitest";
import {
  assign,
  encode,
  ensureEnding,
  normalize,
  tokenIds,
  wordStarts,
} from "./text";

// Stand-in for espeak: lowercases, and spells numbers out as two words like espeak would.
const phonemize = async (run: string) =>
  run
    .split(" ")
    .map((w) => (w === "42" ? "fɔːɹɾi tuː" : w.toLowerCase()))
    .join(" ");

describe("text", () => {
  it("normalises typographic punctuation the model never saw", () => {
    expect(normalize("It’s  a “test” – really")).toBe(
      'It\'s a "test" — really',
    );
  });

  it("closes unterminated text so the ending is not rushed", () => {
    expect(ensureEnding("Hello there")).toBe("Hello there,");
    expect(ensureEnding("Done.")).toBe("Done.");
  });

  it("encodes word by word into the same tokens as phonemising the whole text", async () => {
    const { ids } = await encode("Hello, “big” world. 42 cats", phonemize);
    expect(ids).toEqual([
      0,
      ...tokenIds('hello, "big" world. fɔːɹɾi tuː cats,'),
      10,
      0,
    ]);
  });

  it("phonemises each run of words between punctuation in one call, for natural weak forms", async () => {
    const calls: string[] = [];
    await encode("The cat sat, on the mat.", async (run) => {
      calls.push(run);
      return run.toLowerCase();
    });
    expect(calls).toEqual(["The cat sat", "on the mat"]);
  });

  it("shares out phonemes when espeak returns more words than the text has", () => {
    expect(assign(["a", "b", "c"], 3)).toEqual([0, 1, 2]);
    // "in 2026 we" -> "in twenty twenty six we": the number keeps its three phoneme words.
    expect(assign(["in", "2026", "we"], 5)).toEqual([0, 1, 1, 1, 2]);
  });

  it("records where each word starts in the token sequence", async () => {
    const { ids, words } = await encode("Hi, you.", phonemize);
    // [pad] h i ␣ , ␣ y o u ␣ . [end] [pad]: punctuation is its own token, spaced like the reference.
    expect(words).toEqual([1, 6]);
    expect(ids).toHaveLength(13);
  });

  it("keeps a slot for words with nothing to pronounce", async () => {
    const { words } = await encode("Wait — what", phonemize);
    expect(words).toHaveLength(3);
  });

  it("turns per-token durations into word start times", () => {
    // Durations in frames for [pad, a, b, ␣, c, d, end, pad]; words start at tokens 1 and 4,
    // so after 2 and after 2+3+3+1 frames.
    const starts = wordStarts([1, 4], [2n, 3n, 3n, 1n, 4n, 4n, 2n, 0n], 0.025);
    expect(Array.from(starts, (s) => +s.toFixed(3))).toEqual([0.05, 0.225]);
  });
});
