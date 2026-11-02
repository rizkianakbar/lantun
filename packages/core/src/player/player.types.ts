import type { Sentence } from "../segment/segment.types";
import type { SpeechDriver, SpeechErrorInfo, Voice } from "../speech/speech.types";

export type PlayerStatus = "idle" | "playing" | "paused" | "ended";

export interface SentenceEvent {
  index: number;
  start: number;
  end: number;
  text: string;
}

export interface WordEvent {
  sentence: number;
  start: number;
  end: number;
  text: string;
  estimated: boolean;
}

export interface PlayerEventMap {
  state: PlayerStatus;
  sentence: SentenceEvent;
  word: WordEvent;
  end: undefined;
  error: SpeechErrorInfo;
}

export type PlayerEmit = <K extends keyof PlayerEventMap>(type: K, payload: PlayerEventMap[K]) => void;

export interface PlayerOptions {
  driver: SpeechDriver;
  text: string;
  sentences: readonly Sentence[];
  lang: string;
  rate?: number;
  voice?: Voice | null;
  emit: PlayerEmit;
}

export interface PlayerState {
  status: PlayerStatus;
  index: number;
  rate: number;
  voice: Voice | null;
}

export interface Player {
  play(from?: number): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(index: number): void;
  setRate(rate: number): void;
  setVoice(voice: Voice | null): void;
  getState(): PlayerState;
  destroy(): void;
}
