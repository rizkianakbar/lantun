export type Side = "right" | "left";
// The bottom-* values from the original spec still work and pick the matching edge.
export type Position = Side | "bottom-right" | "bottom-left";

export interface ReaderOptions {
  contentSelector?: string;
  excludeSelectors?: string[];
  position?: Position;
  color?: string;
  lang?: string;
  features?: { tts?: boolean; a11y?: boolean };
  zIndex?: number;
  // For pages with a strict Content-Security-Policy: the nonce our <style> elements carry. The
  // script-tag install picks it up from its own tag.
  nonce?: string;
}

export interface ResolvedOptions {
  contentSelector: string | null;
  excludeSelectors: string[];
  position: Side;
  color: string;
  lang: string;
  features: { tts: boolean; a11y: boolean };
  zIndex: number;
  nonce: string | null;
}

export type ReaderEvent = "word" | "sentence" | "end" | "error";
