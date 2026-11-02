import { createSkipMatcher, findArticleRoot } from "../extract/extract";
import type { ResolvedOptions } from "../options/options.types";
import { segment } from "../segment/segment";
import type { SpeechDriver } from "../speech/speech.types";
import { createWebSpeechDriver, isWebSpeechSupported } from "../speech/web-speech";
import { buildTextMap } from "../textmap/textmap";
import type { CaretDocument, Prepared } from "./reader.types";

export function prepare(
  doc: Document,
  opts: Pick<ResolvedOptions, "contentSelector" | "excludeSelectors" | "lang">,
): Prepared | null {
  const skip = createSkipMatcher(opts.excludeSelectors, doc);
  const root = findArticleRoot(doc, opts.contentSelector, skip);

  if (!root) return null;

  const map = buildTextMap(root, skip);

  return { root, map, sentences: segment(map.text, opts.lang) };
}

export function defaultDriver(win: Window): SpeechDriver | null {
  return isWebSpeechSupported(win) ? createWebSpeechDriver(win) : null;
}

export function caretAt(doc: CaretDocument, x: number, y: number): { node: Node; offset: number } | null {
  const pos = doc.caretPositionFromPoint?.(x, y);

  if (pos) return { node: pos.offsetNode, offset: pos.offset };

  // Older Safari only has the deprecated caretRangeFromPoint.
  const range = doc.caretRangeFromPoint?.(x, y);

  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

// Index of the last entry at or before `target` in an ascending list.
export function lastAtOrBefore(sorted: readonly number[], target: number): number {
  let lo = 0;
  let hi = sorted.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;

    if ((sorted[mid] as number) <= target) lo = mid;
    else hi = mid - 1;
  }

  return lo;
}
