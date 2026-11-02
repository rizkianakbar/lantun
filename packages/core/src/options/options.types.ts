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
  // Nonce for our <style> elements on pages with a strict CSP.
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
