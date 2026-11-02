import type { RGB } from "../lib/color";
import type { TextMap } from "../textmap/textmap";

export interface ReadingViewOptions {
  doc: Document;
  win: Window;
  map: TextMap;
  root: Element;
  color: string;
  zIndex: number;
  nonce: string | null;
}

export interface ReadingView {
  sentence(start: number, end: number): void;
  word(start: number, end: number): void;
  clear(): void;
  destroy(): void;
}

export interface PainterOptions {
  color: RGB;
  // Background behind the article; a dark page needs a stronger sentence tint to stay visible.
  background: RGB;
  zIndex: number;
  nonce: string | null;
}

export interface Painter {
  sentence(range: Range | null): void;
  word(range: Range | null): void;
  destroy(): void;
}

// lib.dom only types these as globals, not as members of an arbitrary Window.
export type HighlightWindow = Window & {
  CSS?: { highlights?: HighlightRegistry };
  Highlight?: typeof Highlight;
};
