import { isRecord, readJson, writeJson } from "./storage";

interface Saved {
  index: number;
  sentenceCount: number;
  fingerprint: string;
  timestamp: number;
}

const KEY = "position";
const MAX_ENTRIES = 40;
const TRACKING = /^(utm_|fbclid$|gclid$|mc_|ref$|_ga$)/;

export function articleKey(
  loc: Pick<Location, "origin" | "pathname" | "search">,
): string {
  const params = new URLSearchParams(loc.search);
  for (const key of Array.from(params.keys())) {
    if (TRACKING.test(key)) {
      params.delete(key);
    }
  }

  const query = params.toString;
  return `${loc.origin}${loc.pathname}${query ? `?${query}` : ""}`;
}

export function fingerprint(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 48).toLowerCase();
}

function loadAll(): Record<string, Saved> {
  const raw = readJson(KEY);
  const out: Record<string, Saved> = {};

  if (!isRecord(raw)) return out;

  for (const [key, value] of Object.entries(raw)) {
    if (
      isRecord(value) &&
      typeof value.index === "number" &&
      typeof value.sentenceCount === "number" &&
      typeof value.fingerprint === "string" &&
      typeof value.timestamp === "number"
    ) {
      out[key] = {
        index: value.index,
        sentenceCount: value.sentenceCount,
        fingerprint: value.fingerprint,
        timestamp: value.timestamp,
      };
    }
  }

  return out;
}

export function savePosition(
  key: string,
  index: number,
  count: number,
  sentenceText: string,
): void {
  const all = loadAll();

  all[key] = {
    index,
    sentenceCount: count,
    fingerprint: sentenceText,
    timestamp: Date.now(),
  };

  const kept = Object.entries(all)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, MAX_ENTRIES);

  writeJson(KEY, Object.fromEntries(kept));
}

export function clearPosition(key: string): void {
  const all = loadAll();

  if (!(key in all)) return;

  delete all[key];

  writeJson(KEY, all);
}

export function findSavedPosition(
  key: string,
  sentenceTexts: (index: number) => string,
  count: number,
): number | null {
  const saved = loadAll()[key];

  if (!saved) return null;

  if (
    saved.index < count &&
    fingerprint(sentenceTexts(saved.index)) === saved.fingerprint
  ) {
    return saved.index;
  }

  for (let i = 0; i < count; i++) {
    if (fingerprint(sentenceTexts(i)) === saved.fingerprint) return i;
  }

  return null;
}
