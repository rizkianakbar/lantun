import type { Sentence, Word } from "../segment/segment.types";
import { MAX_RATE, MIN_RATE, RATE_STEP } from "./player.constants";

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;

  const stepped = Math.round(rate / RATE_STEP) * RATE_STEP;

  return Math.min(MAX_RATE, Math.max(MIN_RATE, stepped));
}

// Some engines report the boundary on the space before a word.
export function wordAt(sentence: Sentence, abs: number): Word | undefined {
  return sentence.words.find((word) => word.end > abs);
}
