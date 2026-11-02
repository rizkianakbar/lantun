import type { Voice } from "../speech/speech.types";
import { GOOGLE, LEGACY, NEURAL, NOVELTY, ROBOTIC, SAPI } from "./voices.constants";
import type { VoiceLabel, VoiceTip } from "./voices.types";

function normalize(tag: string): string {
  const [primary = "", ...rest] = tag.toLowerCase().replace(/_/g, "-").split("-");

  return [LEGACY.get(primary) ?? primary, ...rest].join("-");
}

export function primaryLang(tag: string): string {
  return normalize(tag).split("-")[0] ?? "";
}

// How natural a voice sounds, 0–6. Network voices rank above robotic local ones on purpose.
export function voiceQuality(v: Voice): number {
  if (v.engine) return 6;
  if (NEURAL.test(v.name)) return 5;
  if (GOOGLE.test(v.name)) return 4;
  if (ROBOTIC.test(v.name)) return 0;
  if (SAPI.test(v.name)) return 1;

  return v.local ? 3 : 2;
}

// The right accent outweighs one quality step.
function score(v: Voice, wanted: string): number {
  return voiceQuality(v) * 10 + (normalize(v.lang) === wanted ? 12 : 0) + (v.local ? 1 : 0) + (v.isDefault ? 1 : 0);
}

export function voicesFor(voices: readonly Voice[], lang: string): Voice[] {
  const primary = primaryLang(lang);

  return voices.filter((v) => primaryLang(v.lang) === primary);
}

// Voices for the page language, best first, novelty voices removed.
export function listVoices(voices: readonly Voice[], lang: string): Voice[] {
  const wanted = normalize(lang);
  // Scored once each: the comparator would otherwise re-run the regexes on every comparison.
  const scores = new Map<Voice, number>();

  for (const v of voicesFor(voices, lang)) {
    if (!NOVELTY.test(v.name)) scores.set(v, score(v, wanted));
  }

  return Array.from(scores.keys()).sort(
    (a, b) => (scores.get(b) as number) - (scores.get(a) as number) || a.name.localeCompare(b.name),
  );
}

// Add-on voices download tens of megabytes, so they are only picked when chosen or when nothing else
// speaks the language.
export function pickVoice(voices: readonly Voice[], lang: string, preferredId?: string | null): Voice | null {
  const ranked = listVoices(voices, lang);
  const preferred = preferredId ? ranked.find((v) => v.id === preferredId) : undefined;

  return preferred ?? ranked.find((v) => !v.engine) ?? ranked[0] ?? null;
}

const regionNames = new Map<string, Intl.DisplayNames | null>();

function displayNames(uiLang: string): Intl.DisplayNames | null {
  if (!regionNames.has(uiLang)) {
    let names: Intl.DisplayNames | null = null;

    try {
      names = new Intl.DisplayNames([uiLang], { type: "region" });
    } catch {
      // Unknown locale or no Intl.DisplayNames: the region code is shown instead.
    }

    regionNames.set(uiLang, names);
  }

  return regionNames.get(uiLang) ?? null;
}

function regionName(code: string, uiLang: string): string {
  try {
    return displayNames(uiLang)?.of(code) ?? code;
  } catch {
    return code;
  }
}

function shortName(name: string): string {
  const short = name
    .replace(/^Microsoft\s+/, "")
    .replace(/\s+Online\b/, "")
    .replace(/\s*\((Natural|Neural|Premium|Enhanced)\)/i, "")
    .replace(/\s+-\s+.*$/, "")
    // Chrome on macOS: "Eddy (English (US))".
    .replace(/\s*\([^)]*\([^)]*\)\)$/, "")
    .trim();

  return short || name;
}

function kindOf(v: Voice): VoiceLabel["kind"] {
  if (v.engine) return "hd";
  if (NEURAL.test(v.name)) return "natural";

  return v.local ? "device" : "online";
}

// "Microsoft Ardi Online (Natural) - Indonesian (Indonesia)"
//   -> { name: "Ardi", region: "Indonesia", kind: "natural" }
export function describeVoice(v: Voice, uiLang: string): VoiceLabel {
  const region = normalize(v.lang).split("-")[1]?.toUpperCase();

  return {
    name: v.engine ? v.name : shortName(v.name),
    region: region ? regionName(region, uiLang) : "",
    kind: kindOf(v),
  };
}

// Where a reader stuck with robotic voices can get a natural one (Android has no reliable path).
export function voiceTip(voices: readonly Voice[], ua: string, touchPoints: number): VoiceTip | null {
  if (!voices.length || voices.some((v) => v.engine || NEURAL.test(v.name))) {
    return null;
  }

  const apple = /Macintosh|iPhone|iPad/.test(ua);

  if (/iPhone|iPad/.test(ua) || (apple && touchPoints > 1)) return "ios";
  if (/Edg\/|Android/.test(ua)) return null;
  if (apple && !/Chrome\/|Firefox\//.test(ua)) return "mac";

  return "edge";
}
