import { isRecord, readJson, writeJson } from "./storage";

export interface ReaderSettings {
  rate: number;
  // chosen voice id per primary language ("en", "id")
  voices: Record<string, string>;
}

const KEY = "settings";

export function loadSettings(): ReaderSettings {
  const raw = readJson(KEY);

  const rate =
    isRecord(raw) && typeof raw.rate === "number" ? clampRate(raw.rate) : 1;
  const voices: Record<string, string> = {};

  if (isRecord(raw) && isRecord(raw.voices)) {
    for (const [key, value] of Object.entries(raw.voices)) {
      if (typeof value === "string") {
        voices[key] = value;
      }
    }
  }

  return { rate, voices };
}

export function saveSettings(data: ReaderSettings): void {
  return writeJson(KEY, data);
}
