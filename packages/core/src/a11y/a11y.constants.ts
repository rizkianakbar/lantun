import type { AxSettings, ProfileId } from "./a11y.types";

export const AX_STYLE_ID = "lantun-ax";
export const AX_STORAGE_KEY = "ax";
// Marks our own view transitions, which styles.ts times and makes click-through.
export const MORPH_CLASS = "ax-morph";

export const AX_DEFAULTS: Readonly<AxSettings> = {
  text: 0,
  line: 0,
  spacing: 0,
  font: "default",
  contrast: "default",
  desaturate: false,
  links: false,
  cursor: false,
  guide: false,
  mask: false,
  still: false,
  noImages: false,
};

export const TEXT_SIZES = [100, 115, 130, 150] as const;
export const STEPS: readonly unknown[] = [0, 1, 2, 3];
export const FONTS: readonly unknown[] = ["default", "readable", "dyslexic"];
export const CONTRASTS: readonly unknown[] = ["default", "dark", "light", "high", "invert"];

export const PROFILES = {
  lowVision: { text: 2, contrast: "high", cursor: true, links: true },
  dyslexia: { font: "dyslexic", line: 1, spacing: 1, guide: true },
  adhd: { mask: true, still: true },
  seizure: { still: true, desaturate: true },
  elderly: { text: 2, font: "readable", cursor: true },
} satisfies Record<string, Partial<AxSettings>>;

export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];

// On/off settings and the class each one puts on <html>.
export const SWITCHES = {
  desaturate: "ax-desaturate",
  links: "ax-links",
  cursor: "ax-cursor",
  guide: "ax-guide",
  mask: "ax-mask",
  still: "ax-still",
  noImages: "ax-no-images",
} as const;

export const SWITCH_KEYS = Object.keys(SWITCHES) as (keyof typeof SWITCHES)[];

export const ALL_AX_CLASSES: readonly string[] = [
  ...TEXT_SIZES.slice(1).map((size) => `ax-text-${size}`),
  ...[1, 2, 3].map((n) => `ax-line-${n}`),
  ...[1, 2, 3].map((n) => `ax-spacing-${n}`),
  "ax-font-readable",
  "ax-font-dyslexic",
  ...CONTRASTS.slice(1).map((mode) => `ax-contrast-${mode as string}`),
  ...Object.values(SWITCHES),
];
