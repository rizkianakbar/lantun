import { css, invert, isDark, luminance, type RGB, smartInvert, textOn } from "../lib/color";
import {
  DARK_PAGE_SENTENCE_ALPHA,
  LIGHT_COLOR_SENTENCE_ALPHA,
  SENTENCE_ALPHA,
  SENTENCE_HIGHLIGHT,
  WORD_HIGHLIGHT,
} from "./highlight.constants";
import type { HighlightWindow, PainterOptions } from "./highlight.types";

export function supportsHighlightApi(win: Window = window): boolean {
  const w = win as HighlightWindow;

  return !!w.CSS?.highlights && typeof w.Highlight === "function";
}

export function sentenceAlpha(background: RGB, color: RGB): number {
  if (isDark(background)) return DARK_PAGE_SENTENCE_ALPHA;

  return luminance(color) > 0.4 ? LIGHT_COLOR_SENTENCE_ALPHA : SENTENCE_ALPHA;
}

function same(c: RGB): RGB {
  return c;
}

// The only rules we add to the document, and they can only ever match our own named highlights.
export function highlightCss({ color, background }: PainterOptions): string {
  const alpha = sentenceAlpha(background, color);
  const ink = textOn(color);
  const sentence = `::highlight(${SENTENCE_HIGHLIGHT})`;
  const word = `::highlight(${WORD_HIGHLIGHT})`;

  function rules(prefix: string, f: (c: RGB) => RGB, a: number): string {
    return (
      `${prefix}${sentence}{background-color:${css(f(color), a)}}` +
      `${prefix}${word}{background-color:${css(f(color))};color:${css(f(ink))}}`
    );
  }

  return [
    rules("", same, alpha),
    // Under the page-wide a11y filters the page reads as dark.
    rules("html.ax-contrast-dark ", smartInvert, DARK_PAGE_SENTENCE_ALPHA),
    rules("html.ax-contrast-invert ", invert, DARK_PAGE_SENTENCE_ALPHA),
    `@media (forced-colors:active){${sentence}{background-color:transparent;text-decoration:underline}` +
      `${word}{background-color:Highlight;color:HighlightText}}`,
    // A page printed mid-listen should not carry the reading position onto paper.
    `@media print{${sentence}{background-color:transparent}${word}{background-color:transparent;color:inherit}}`,
  ].join("\n");
}
