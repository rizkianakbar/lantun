import { describe, expect, it } from "vitest";
import { segment, sentenceIndexAt } from "./segment";
import type { Sentence } from "./segment.types";

const texts = (text: string, sentences: Sentence[]) => sentences.map((s) => text.slice(s.start, s.end));

describe.each([
  ["Intl.Segmenter", true],
  ["regex fallback", false],
])("segment (%s)", (_, native) => {
  const run = (text: string, lang = "en", maxLength?: number) =>
    texts(text, segment(text, lang, { native, maxLength }));

  it("splits sentences and trims whitespace", () => {
    expect(run("One sentence. Another one!  A third?")).toEqual(["One sentence.", "Another one!", "A third?"]);
  });

  it("treats newlines as hard breaks", () => {
    expect(run("Heading without a stop\nBody text.")).toEqual(["Heading without a stop", "Body text."]);
  });

  it("does not split after titles and initials", () => {
    const text = "Mr. Okafor called it boring. Dr. Andini agreed with J. Mensah. Then it ended.";
    expect(run(text)).toEqual(["Mr. Okafor called it boring.", "Dr. Andini agreed with J. Mensah.", "Then it ended."]);
  });

  it("handles Indonesian abbreviations", () => {
    const text = "Rapat dihadiri Prof. Budi dan dr. Sari di Jl. Merdeka. Acara selesai pukul 12.00 WIB.";
    expect(run(text, "id")).toEqual([
      "Rapat dihadiri Prof. Budi dan dr. Sari di Jl. Merdeka.",
      "Acara selesai pukul 12.00 WIB.",
    ]);
  });

  it("never merges an abbreviation across a paragraph break", () => {
    expect(run("Ask Dr.\nNew paragraph.")).toEqual(["Ask Dr.", "New paragraph."]);
  });

  it("keeps decimal and thousand separators inside one sentence", () => {
    expect(run("Harganya Rp90.000 per kg. Naik 2.5 persen.", "id")).toEqual([
      "Harganya Rp90.000 per kg.",
      "Naik 2.5 persen.",
    ]);
  });

  it("drops sentences with nothing to speak", () => {
    expect(run("First.\n***\n— \nLast.")).toEqual(["First.", "Last."]);
  });

  it("returns word offsets that slice to the words", () => {
    const text = "Harga cabai naik, kata Cucu.";
    const [s] = segment(text, "id", { native });
    expect(s?.words.map((w) => text.slice(w.start, w.end))).toEqual(["Harga", "cabai", "naik", "kata", "Cucu"]);
  });

  it("splits long sentences at clause punctuation, keeping the comma", () => {
    const clause = "the quick brown fox jumps over the lazy dog";
    const text = `${clause}, ${clause}, ${clause}, ${clause}.`;
    const pieces = run(text, "en", 100);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(100);
    expect(pieces[0]?.endsWith(",")).toBe(true);
    expect(pieces.join(" ")).toBe(text);
  });

  it("balances pieces instead of leaving a lone trailing word", () => {
    const text = `Voters turned out in their highest numbers in decades in a tense national election on Tuesday to decide whether to stick with the prime minister, who has led for years, or change course.`;
    const pieces = run(text, "en", 120);
    expect(pieces).toHaveLength(2);
    for (const p of pieces) expect(p.length).toBeGreaterThan(50);
    expect(pieces.join(" ")).toBe(text);
  });

  it("splits at a word boundary when there is no punctuation", () => {
    const text = `${"word ".repeat(80).trim()}.`;
    const pieces = run(text, "en", 100);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(100);
    expect(pieces.join(" ")).toBe(text);
  });
});

describe("segment locale handling", () => {
  it("falls back to en for an invalid language tag", () => {
    expect(() => segment("Hello there. Bye.", "not a tag!!")).not.toThrow();
    expect(segment("Hello there. Bye.", "not a tag!!")).toHaveLength(2);
  });
});

describe("sentenceIndexAt", () => {
  const text = "One. Two. Three.";
  const sentences = segment(text, "en");

  it("finds the sentence containing an index", () => {
    expect(sentenceIndexAt(sentences, text.indexOf("Two") + 1)).toBe(1);
  });

  it("maps the gap between sentences to the next one", () => {
    expect(sentenceIndexAt(sentences, text.indexOf(" Two"))).toBe(1);
  });

  it("clamps past the end to the last sentence", () => {
    expect(sentenceIndexAt(sentences, 999)).toBe(2);
  });
});
