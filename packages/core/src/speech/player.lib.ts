import type { Sentence, Word } from "../segment/segment";
import { MAX_RATE, MIN_RATE, RATE_STEP } from "./player.constants";

export function clampRate(rate: number): number {
  return Number.isFinite(rate)
    ? Math.min(
        MAX_RATE,
        Math.max(MIN_RATE, Math.round(rate / RATE_STEP) * RATE_STEP),
      )
    : 1;
}

// some engines report a boundary on the space before a word, so take the first word ending after it.
export function wordAt(sentence: Sentence, abs: number): Word | undefined {
  return sentence.words.find((word) => word.end > abs);
}
