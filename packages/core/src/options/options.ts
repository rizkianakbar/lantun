import { DEFAULT_COLOR, DEFAULT_Z_INDEX, POSITIONS } from "./options.constants";
import type { Position, ReaderOptions, ResolvedOptions, Side } from "./options.types";

function sideOf(position: Position | undefined): Side {
  return position && POSITIONS.includes(position) && position.endsWith("left") ? "left" : "right";
}

function flag(value: string | undefined): boolean | undefined {
  return value === undefined ? undefined : value !== "false" && value !== "0";
}

export function resolveOptions(opts: ReaderOptions = {}, doc: Document = document): ResolvedOptions {
  return {
    contentSelector: opts.contentSelector?.trim() || null,
    excludeSelectors: Array.isArray(opts.excludeSelectors) ? opts.excludeSelectors : [],
    position: sideOf(opts.position),
    color: opts.color?.trim() || DEFAULT_COLOR,
    lang: opts.lang?.trim() || doc.documentElement.lang.trim() || "en",
    features: { tts: opts.features?.tts ?? true, a11y: opts.features?.a11y ?? true },
    zIndex: Number.isFinite(opts.zIndex) ? (opts.zIndex as number) : DEFAULT_Z_INDEX,
    nonce: opts.nonce?.trim() || null,
  };
}

// Options from the script tag's data-* attributes; unknown attributes are ignored.
export function optionsFromDataset(ds: DOMStringMap): ReaderOptions {
  const opts: ReaderOptions = {};
  const tts = flag(ds.tts);
  const a11y = flag(ds.a11y);
  const zIndex = Number(ds.zIndex);

  if (ds.contentSelector) opts.contentSelector = ds.contentSelector;
  if (ds.excludeSelectors) {
    opts.excludeSelectors = ds.excludeSelectors
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (ds.position) opts.position = ds.position as Position;
  if (ds.color) opts.color = ds.color;
  if (ds.lang) opts.lang = ds.lang;
  if (tts !== undefined || a11y !== undefined) opts.features = { tts, a11y };
  if (ds.zIndex && Number.isFinite(zIndex)) opts.zIndex = zIndex;

  return opts;
}
