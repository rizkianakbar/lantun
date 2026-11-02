import type { Voice } from "@lantun/core";
import { CLAUSE, DOWNLOAD_BYTES, GENDER, MIN_PIECE, SPLIT_MIN, VOICE_NAMES } from "./engine.constants";
import type { ClipEntry, EngineNavigator, EngineWindow, KittenVoiceName, Part } from "./engine.types";

// Same switch as core: localStorage.setItem('lantun:debug', '1').
export function debug(...args: unknown[]): void {
  try {
    if (localStorage.getItem("lantun:debug")) {
      console.info("[Lantun] kitten:", ...args);
    }
  } catch {
    // Storage blocked: no logging.
  }
}

export function ignore(): undefined {
  return undefined;
}

export function revoke(entry: ClipEntry): void {
  entry.clip.then((c) => URL.revokeObjectURL(c.url), ignore);
}

export function nameOf(voice: Voice | null): KittenVoiceName {
  const name = voice?.name ?? "";

  return (VOICE_NAMES as readonly string[]).includes(name) ? (name as KittenVoiceName) : VOICE_NAMES[0];
}

// Clips are made at the voice's 1× pace; the reader's speed is applied at playback.
export function keyOf(voice: Voice | null, text: string): string {
  return `${nameOf(voice)}|${text}`;
}

export function toVoice(name: KittenVoiceName): Voice {
  return {
    id: `kitten:${name}`,
    name,
    lang: "en-US",
    local: true,
    isDefault: false,
    engine: "kitten",
    downloadBytes: DOWNLOAD_BYTES,
    gender: GENDER[name],
  };
}

// Text offsets of each whitespace-separated word, shifted to the utterance.
export function wordOffsets(part: Part): number[] {
  return Array.from(part.text.matchAll(/\S+/g), (m) => part.offset + (m.index ?? 0));
}

// Offered only where it can run well, and not to readers who asked the browser to save data.
export function canRun(win: EngineWindow = window): boolean {
  const nav = win.navigator as EngineNavigator;

  return (
    typeof WebAssembly === "object" &&
    typeof win.Worker === "function" &&
    typeof win.Audio === "function" &&
    typeof DecompressionStream === "function" &&
    !nav.connection?.saveData &&
    (nav.deviceMemory ?? 4) >= 2
  );
}

// Whole sentences sound best, so only a long sentence that is not ready yet is split, after its
// first clause, so its first words play sooner.
export function splitFirstClause(text: string): Part[] {
  if (text.length < SPLIT_MIN) return [{ text, offset: 0 }];

  for (const m of text.matchAll(CLAUSE)) {
    const end = (m.index ?? 0) + 1;

    if (end < MIN_PIECE) continue;
    if (end > text.length - MIN_PIECE) break;

    const rest = text.slice(end).trimStart();

    return [
      { text: text.slice(0, end), offset: 0 },
      { text: rest, offset: text.length - rest.length },
    ];
  }

  return [{ text, offset: 0 }];
}
