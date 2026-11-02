import { isRecord } from "../lib/storage";
import {
  AX_DEFAULTS,
  CONTRASTS,
  FONTS,
  PROFILE_IDS,
  PROFILES,
  STEPS,
  SWITCH_KEYS,
  SWITCHES,
  TEXT_SIZES,
} from "./a11y.constants";
import type { AxSettings, ContrastMode, FontMode, ProfileId, Step } from "./a11y.types";

const KEYS = Object.keys(AX_DEFAULTS) as (keyof AxSettings)[];

export function profileSettings(id: ProfileId): AxSettings {
  return { ...AX_DEFAULTS, ...PROFILES[id] };
}

function same(a: AxSettings, b: AxSettings): boolean {
  return KEYS.every((k) => a[k] === b[k]);
}

export function activeProfile(s: AxSettings): ProfileId | null {
  return PROFILE_IDS.find((id) => same(profileSettings(id), s)) ?? null;
}

export function isDefault(s: AxSettings): boolean {
  return same(s, AX_DEFAULTS);
}

// Stored settings are untrusted input: keep only well-formed values.
export function sanitizeAx(raw: unknown): AxSettings {
  const s: AxSettings = { ...AX_DEFAULTS };

  if (!isRecord(raw)) return s;

  if (STEPS.includes(raw.text)) s.text = raw.text as Step;
  if (STEPS.includes(raw.line)) s.line = raw.line as Step;
  if (STEPS.includes(raw.spacing)) s.spacing = raw.spacing as Step;
  if (FONTS.includes(raw.font)) s.font = raw.font as FontMode;
  if (CONTRASTS.includes(raw.contrast)) s.contrast = raw.contrast as ContrastMode;

  for (const k of SWITCH_KEYS) {
    const value = raw[k];

    if (typeof value === "boolean") s[k] = value;
  }

  return s;
}

export function axClasses(s: AxSettings): string[] {
  const out: string[] = [];

  if (s.text) out.push(`ax-text-${TEXT_SIZES[s.text]}`);
  if (s.line) out.push(`ax-line-${s.line}`);
  if (s.spacing) out.push(`ax-spacing-${s.spacing}`);
  if (s.font !== "default") out.push(`ax-font-${s.font}`);
  if (s.contrast !== "default") out.push(`ax-contrast-${s.contrast}`);

  for (const k of SWITCH_KEYS) {
    if (s[k]) out.push(SWITCHES[k]);
  }

  return out;
}
