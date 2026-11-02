// everything we persist lives under one prefix, and every access is guarded: storage can be
// disabled, full, or throw in private modes, and none of that may reach the host page.
const PREFIX = "lantun:";

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    //quota or privacy mode: settings simply do not presist.
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
