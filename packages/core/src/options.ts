import type { Position, ReaderOptions, ResolvedOptions, Side } from "./types";

// Marigold: reads as a highlighter pen on the page, and is nobody else's blue.
export const DEFAULT_COLOR = "#f5b841";
export const DEFAULT_Z_INDEX = 2147483000;

const POSITIONS: readonly Position[] = [
  "right",
  "left",
  "bottom-right",
  "bottom-left",
];

const sideOf = (p: Position | undefined): Side =>
  p && POSITIONS.includes(p) && p.endsWith("left") ? "left" : "right";

export const resolveOptions = (
  opts: ReaderOptions = {},
  doc: Document = document,
): ResolvedOptions => ({
  contentSelector: opts.contentSelector?.trim() || null,
  excludeSelectors: Array.isArray(opts.excludeSelectors)
    ? opts.excludeSelectors
    : [],
  position: sideOf(opts.position),
  color: opts.color?.trim() || DEFAULT_COLOR,
  lang: opts.lang?.trim() || doc.documentElement.lang.trim() || "en",
  features: {
    tts: opts.features?.tts ?? true,
    a11y: opts.features?.a11y ?? true,
  },
  zIndex: Number.isFinite(opts.zIndex)
    ? (opts.zIndex as number)
    : DEFAULT_Z_INDEX,
  nonce: opts.nonce?.trim() || null,
});
