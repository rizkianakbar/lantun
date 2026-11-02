import { isRecord, readJson, writeJson } from "../lib/storage";
import { clampRate } from "../player/player.lib";
import { MAX_SAVED_POSITIONS, POSITIONS_KEY, SETTINGS_KEY, TRACKING_PARAMS } from "./reader.constants";
import type { ReaderSettings, SavedPosition } from "./reader.types";

export function loadSettings(): ReaderSettings {
  const raw = readJson(SETTINGS_KEY);
  const settings: ReaderSettings = { rate: 1, voices: {} };

  if (!isRecord(raw)) return settings;

  if (typeof raw.rate === "number") settings.rate = clampRate(raw.rate);

  if (isRecord(raw.voices)) {
    for (const [lang, id] of Object.entries(raw.voices)) {
      if (typeof id === "string") settings.voices[lang] = id;
    }
  }

  return settings;
}

export function saveSettings(settings: ReaderSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function articleKey(loc: Pick<Location, "origin" | "pathname" | "search">): string {
  const params = new URLSearchParams(loc.search);

  for (const key of Array.from(params.keys())) {
    if (TRACKING_PARAMS.test(key)) params.delete(key);
  }

  const query = params.toString();

  return `${loc.origin}${loc.pathname}${query ? `?${query}` : ""}`;
}

export function fingerprint(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 48).toLowerCase();
}

function isSaved(value: unknown): value is SavedPosition {
  return (
    isRecord(value) &&
    typeof value.index === "number" &&
    typeof value.sentenceCount === "number" &&
    typeof value.fingerprint === "string" &&
    typeof value.timestamp === "number"
  );
}

function loadPositions(): Record<string, SavedPosition> {
  const raw = readJson(POSITIONS_KEY);
  const out: Record<string, SavedPosition> = {};

  if (!isRecord(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    if (isSaved(value)) out[key] = value;
  }

  return out;
}

export function savePosition(key: string, index: number, count: number, sentenceText: string): void {
  const all = loadPositions();

  all[key] = { index, sentenceCount: count, fingerprint: fingerprint(sentenceText), timestamp: Date.now() };

  const newest = Object.entries(all)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, MAX_SAVED_POSITIONS);

  writeJson(POSITIONS_KEY, Object.fromEntries(newest));
}

export function clearPosition(key: string): void {
  const all = loadPositions();

  if (!(key in all)) return;

  delete all[key];
  writeJson(POSITIONS_KEY, all);
}

// The saved index when its sentence is still there, otherwise wherever that sentence moved to.
export function findSavedPosition(key: string, sentenceText: (index: number) => string, count: number): number | null {
  const saved = loadPositions()[key];

  if (!saved) return null;

  if (saved.index < count && fingerprint(sentenceText(saved.index)) === saved.fingerprint) return saved.index;

  for (let i = 0; i < count; i++) {
    if (fingerprint(sentenceText(i)) === saved.fingerprint) return i;
  }

  return null;
}
