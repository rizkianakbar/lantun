import type { Store } from "../lib/store";
import type { PlayerStatus } from "../player/player.types";
import type { Sentence } from "../segment/segment.types";
import type { EngineStatus, SpeechDriver, Voice, VoiceEngine } from "../speech/speech.types";
import type { TextMap } from "../textmap/textmap";

export type ReaderIssue = "unsupported" | "no-content" | "not-allowed" | null;

// An add-on voice the reader picked could not be used, and a built-in voice took over.
export interface VoiceFallback {
  reason: "slow" | "failed";
  voice: Voice | null;
}

export interface ReaderState {
  status: PlayerStatus;
  index: number;
  total: number;
  // 0–1 by characters read, at the start of the current sentence.
  progress: number;
  // Seconds, at the current rate.
  duration: number;
  remaining: number;
  // Time left once the current sentence is done; lower bound for the live countdown.
  remainingAfter: number;
  rate: number;
  voices: Voice[];
  voice: Voice | null;
  voicesLoaded: boolean;
  // Offered "continue from" position, cleared once playback starts.
  resume: { index: number; progress: number } | null;
  issue: ReaderIssue;
  // Status of the add-on engine behind the selected voice; null for built-in voices.
  engine: EngineStatus | null;
  fallback: VoiceFallback | null;
}

export type Timing = Pick<ReaderState, "progress" | "duration" | "remaining" | "remainingAfter">;

export interface SentenceHit {
  index: number;
  rect: DOMRect;
}

export interface Reader {
  store: Store<ReaderState>;
  play(from?: number): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(index: number): void;
  // Fraction of the article (0–1), measured in characters like `progress`.
  seekTo(fraction: number): void;
  setRate(rate: number): void;
  setVoice(id: string): void;
  addEngine(engine: VoiceEngine): void;
  // For "play from here": the sentence under a viewport point, with its first line box.
  sentenceAtPoint(x: number, y: number): SentenceHit | null;
  selectionSentence(): number | null;
  destroy(): void;
}

export interface ReaderDeps {
  doc?: Document;
  win?: Window;
  // null forces the "unsupported" path; omitted picks Web Speech when available.
  driver?: SpeechDriver | null;
}

export interface Prepared {
  root: Element;
  map: TextMap;
  sentences: Sentence[];
}

export interface ReaderSettings {
  rate: number;
  // Chosen voice id per primary language ("en", "id").
  voices: Record<string, string>;
}

export interface SavedPosition {
  index: number;
  sentenceCount: number;
  fingerprint: string;
  timestamp: number;
}

export type CaretDocument = Document & {
  caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?(x: number, y: number): Range | null;
};

export type IdleWindow = Window & {
  requestIdleCallback?(cb: () => void, opts?: { timeout: number }): number;
};
