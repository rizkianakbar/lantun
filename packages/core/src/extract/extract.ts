import { warn } from "../lib/log";
import { ANCESTOR_DIVIDERS, BUILTIN_SKIP, FOOTNOTES, MIN_HINTED_BODY, MIN_PARAGRAPH } from "./extract.constants";
import {
  initialScore,
  isFloatedTable,
  isHidden,
  isReadAlso,
  isValidSelector,
  linkDensity,
  paragraphScore,
  paragraphs,
  supportsHas,
} from "./extract.lib";

export type SkipMatcher = (el: Element) => boolean;

export function createSkipMatcher(exclude: readonly string[] = [], doc: Document = document): SkipMatcher {
  const custom = exclude.map((s) => s.trim()).filter((s) => s && isValidSelector(doc, s));
  const selector = [BUILTIN_SKIP, ...(supportsHas() ? [FOOTNOTES] : []), ...custom].join(",");

  // Cheapest checks first: the computed-style ones force style resolution.
  return function skip(el) {
    return el.matches(selector) || isReadAlso(el) || isFloatedTable(el) || isHidden(el);
  };
}

export function isInsideSkipped(el: Element, skip: SkipMatcher, stopAt: Element): boolean {
  for (let n: Element | null = el; n && n !== stopAt; n = n.parentElement) {
    if (skip(n)) return true;
  }

  return false;
}

export function detectArticleRoot(doc: Document, skip: SkipMatcher): Element | null {
  const body = doc.body;

  if (!body) return null;

  const hinted = body.querySelector('[itemprop="articleBody"]');

  if (hinted && (hinted.textContent ?? "").trim().length >= MIN_HINTED_BODY) return hinted;

  const scores = new Map<Element, number>();

  for (const p of paragraphs(body)) {
    const text = (p.textContent ?? "").trim();

    if (text.length < MIN_PARAGRAPH || isInsideSkipped(p, skip, body)) continue;

    const score = paragraphScore(text);
    // A div holding bare text is itself the container, not a paragraph inside one.
    let el = p.localName === "p" ? p.parentElement : p;

    for (const divider of ANCESTOR_DIVIDERS) {
      if (!el || el === doc.documentElement) break;

      scores.set(el, (scores.get(el) ?? initialScore(el)) + score / divider);
      el = el.parentElement;
    }
  }

  let best: Element | null = null;
  let bestScore = 0;

  for (const [el, score] of scores) {
    // Link density only lowers a score, so candidates that cannot win skip measuring it.
    if (score <= bestScore) continue;

    const adjusted = score * (1 - linkDensity(el));

    if (adjusted > bestScore) {
      best = el;
      bestScore = adjusted;
    }
  }

  return best ?? doc.querySelector("article") ?? doc.querySelector('main,[role="main"]') ?? body;
}

export function findArticleRoot(doc: Document, contentSelector: string | null, skip: SkipMatcher): Element | null {
  if (contentSelector) {
    try {
      const el = doc.querySelector(contentSelector);

      if (el) return el;

      warn(`contentSelector "${contentSelector}" matched nothing; falling back to auto-detect.`);
    } catch {
      warn(`contentSelector "${contentSelector}" is not a valid selector; falling back to auto-detect.`);
    }
  }

  return detectArticleRoot(doc, skip);
}
