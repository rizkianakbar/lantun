import {
  CLAUSE,
  ENDS_WITH_ABBREVIATION,
  FALLBACK_SENTENCE,
  FALLBACK_WORD,
  MAX_SENTENCE_LENGTH,
} from "./segment.constants";
import type { SegmentOptions, Sentence, Span, Word } from "./segment.types";

const hasSegmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";

function toLocale(lang: string): string {
  try {
    return Intl.getCanonicalLocales(lang)[0] ?? "en";
  } catch {
    return "en";
  }
}

function regexSpans(re: RegExp, text: string, offset = 0): Span[] {
  return Array.from(text.matchAll(re), (m) => [offset + (m.index ?? 0), offset + (m.index ?? 0) + m[0].length]);
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

// Balanced pieces, cut at clause punctuation when near: greedy splitting leaves a lone trailing word.
function splitLong(text: string, [start, end]: Span, words: Word[], max: number): Sentence[] {
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

export function segment(text: string, lang: string, options: SegmentOptions = {}): Sentence[] {
  const { maxLength = MAX_SENTENCE_LENGTH, native = hasSegmenter } = options;
  const locale = toLocale(lang);
  const sentenceSeg = native ? new Intl.Segmenter(locale, { granularity: "sentence" }) : null;
  const wordSeg = native ? new Intl.Segmenter(locale, { granularity: "word" }) : null;

  const raw: Span[] = sentenceSeg
    ? Array.from(sentenceSeg.segment(text), (s) => [s.index, s.index + s.segment.length])
    : regexSpans(FALLBACK_SENTENCE, text);

  const spans = mergeAbbreviations(
    text,
    raw.map((s) => trim(text, s)).filter(([s, e]) => e > s),
  );

  function wordsIn([s, e]: Span): Word[] {
    const slice = text.slice(s, e);

    if (!wordSeg) {
      return regexSpans(FALLBACK_WORD, slice, s).map(([start, end]) => ({
        start,
        end,
      }));
    }

    const out: Word[] = [];

    for (const w of wordSeg.segment(slice)) {
      if (w.isWordLike) {
        out.push({ start: s + w.index, end: s + w.index + w.segment.length });
      }
    }

    return out;
  }

  // Sentences with no word-like content ("—", "***", a lone emoji) have nothing to speak.
  return spans.flatMap((span) => {
    const words = wordsIn(span);
    return words.length ? splitLong(text, span, words, maxLength) : [];
  });
}

// Index of the sentence containing or following text index `i`, for "play from here".
export function sentenceIndexAt(sentences: readonly Sentence[], i: number): number {
  let lo = 0;
  let hi = sentences.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sentences[mid] as Sentence).end <= i) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, sentences.length - 1);
}
