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
  // Longer sentences are split at clause punctuation.
  maxLength?: number;
  native?: boolean;
}

export type Span = [start: number, end: number];
