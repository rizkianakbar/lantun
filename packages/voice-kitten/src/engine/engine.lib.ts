import type { Voice } from "@lantun/core";
import { CLAUSE, CLAUSE_REACH, DOWNLOAD_BYTES, GENDER, GROWTH, OPENING_CHARS, VOICE_NAMES } from "./engine.constants";
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

// Where a piece of up to `size` characters from `start` ends: the last natural pause within reach,
// else the last space, else (one very long word) the next space. -1 when the text runs out first.
function cutAt(text: string, start: number, size: number): number {
  const half = start + size / 2;
  const reach = text.slice(start, start + Math.round(size * CLAUSE_REACH) + 1);
  let pause = -1;

  for (const m of reach.matchAll(CLAUSE)) {
    const end = start + (m.index ?? 0) + 1;

    if (end > half) pause = end;
  }

  if (pause > 0) return pause;

  const space = text.lastIndexOf(" ", start + size);

  return space > half ? space : text.indexOf(" ", start + size);
}

// Whole sentences sound best, but waiting for a long one to be made is the slowest part of pressing
// play. A sentence that is not ready yet therefore starts with a short opening, and each later
// piece grows, so it is made while the one before it plays.
export function rampParts(text: string): Part[] {
  const parts: Part[] = [];
  let start = 0;
  let size = OPENING_CHARS;

  while (text.length - start > size * GROWTH) {
    const end = cutAt(text, start, size);

    if (end <= start) break;

    parts.push({ text: text.slice(start, end).trimEnd(), offset: start });
    start = end;
    while (/\s/.test(text[start] ?? "")) start++;
    size = Math.round(size * GROWTH);
  }

  parts.push({ text: text.slice(start), offset: start });

  return parts;
}
