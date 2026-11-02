import { ENDS_WITH_ABBREVIATION } from "./abbreviations";

export interface Word {
  start: number;
  end: number;
}

// Offsets are into the TextMap string; slice it to get the text to speak.
export interface Sentence {
  start: number;
  end: number;
  words: Word[];
}

export interface SegmentOptions {
  // Longer sentences are split at clause punctuation: Chrome's network voices are reported to stop
  // after ~15 s of continuous speech, and 200 characters is roughly 13 s at 1x.
  maxLength?: number;
  native?: boolean;
}

type Span = [start: number, end: number];

const hasSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";

function toLocale(lang: string): string {
  try {
    return Intl.getCanonicalLocales(lang)[0] ?? "en";
  } catch {
    return "en";
  }
}

// Fallbacks for engines without Intl.Segmenter (Firefox < 125). Good enough for id/en.
// A terminator directly followed by a letter or digit is not a break: "12.00", "Rp90.000", "e.g".
const FALLBACK_SENTENCE =
  /(?:[^.!?…\n]|[.!?…](?=[\p{L}\p{N}]))+(?:[.!?…]+["'”’)\]]*)?/gu;
const FALLBACK_WORD =
  /[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}]|['’.-](?=[\p{L}\p{N}]))*/gu;
const CLAUSE = /[,;:–—]/;

function regexSpans(re: RegExp, text: string, offset = 0): Span[] {
  return Array.from(text.matchAll(re), (m) => [
    offset + (m.index ?? 0),
    offset + (m.index ?? 0) + m[0].length,
  ]);
}

function trim(text: string, [s, e]: Span): Span {
  while (s < e && /\s/.test(text[s] as string)) s++;
  while (e > s && /\s/.test(text[e - 1] as string)) e--;

  return [s, e];
}

function mergeAbbreviations(text: string, spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    const prev = out[out.length - 1];
    if (
      prev &&
      ENDS_WITH_ABBREVIATION.test(text.slice(prev[0], prev[1])) &&
      !text.slice(prev[1], span[0]).includes("\n")
    ) {
      prev[1] = span[1];
    } else {
      out.push(span);
    }
  }
  return out;
}

// Splits an over-long sentence into balanced pieces: as many as needed, each close to an equal
// share, cutting at clause punctuation when one is near. Greedy splitting would leave a lone
// trailing word ("course.") that sounds robotic as its own utterance.
function splitLong(
  text: string,
  [start, end]: Span,
  words: Word[],
  max: number,
): Sentence[] {
  if (end - start <= max || words.length < 2) return [{ start, end, words }];
  const ideal = start + (end - start) / Math.ceil((end - start) / max);
  let cut = 0;
  let best = Infinity;
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i] as Word;
    if (w.end - start > max) break;
    const clause = CLAUSE.test(text.slice(w.end, (words[i + 1] as Word).start));
    const score = Math.abs(w.end - ideal) - (clause ? max * 0.25 : 0);
    if (score < best) {
      best = score;
      cut = i;
    }
  }
  const last = words[cut] as Word;
  const next = words[cut + 1] as Word;
  // Keep the comma (or dash) with the piece it ends, so the voice pauses naturally there.
  const pieceEnd = last.end + text.slice(last.end, next.start).trimEnd().length;
  return [
    { start, end: pieceEnd, words: words.slice(0, cut + 1) },
    ...splitLong(text, [next.start, end], words.slice(cut + 1), max),
  ];
}

export function segment(
  text: string,
  lang: string,
  options: SegmentOptions = {},
): Sentence[] {
  const { maxLength = 200, native = hasSegmenter } = options;
  const locale = toLocale(lang);
  const sentenceSeg = native
    ? new Intl.Segmenter(locale, { granularity: "sentence" })
    : null;
  const wordSeg = native
    ? new Intl.Segmenter(locale, { granularity: "word" })
    : null;

  const raw: Span[] = sentenceSeg
    ? Array.from(sentenceSeg.segment(text), (s) => [
        s.index,
        s.index + s.segment.length,
      ])
    : regexSpans(FALLBACK_SENTENCE, text);

  const spans = mergeAbbreviations(
    text,
    raw.map((s) => trim(text, s)).filter(([s, e]) => e > s),
  );

  const wordsIn = ([s, e]: Span): Word[] => {
    const slice = text.slice(s, e);
    if (!wordSeg)
      return regexSpans(FALLBACK_WORD, slice, s).map(([start, end]) => ({
        start,
        end,
      }));
    const out: Word[] = [];
    for (const w of wordSeg.segment(slice)) {
      if (w.isWordLike)
        out.push({ start: s + w.index, end: s + w.index + w.segment.length });
    }
    return out;
  };

  // Sentences with no word-like content ("—", "***", a lone emoji) have nothing to speak.
  return spans.flatMap((span) => {
    const words = wordsIn(span);
    return words.length ? splitLong(text, span, words, maxLength) : [];
  });
}

// Index of the sentence containing or following text index `i`, for "play from here".
export function sentenceIndexAt(
  sentences: readonly Sentence[],
  i: number,
): number {
  let lo = 0;
  let hi = sentences.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sentences[mid] as Sentence).end <= i) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, sentences.length - 1);
}
