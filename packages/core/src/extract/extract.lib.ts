import { warn } from "../lib/log";
import { FLOATS, MIN_BARE_TEXT, NEGATIVE_HINT, POSITIVE_HINT, READ_ALSO, TAG_WEIGHTS } from "./extract.constants";

function textLength(el: Element): number {
  return (el.textContent ?? "").length;
}

function classWeight(el: Element): number {
  const hint = `${el.getAttribute("class") ?? ""} ${el.id}`;

  return (POSITIVE_HINT.test(hint) ? 25 : 0) - (NEGATIVE_HINT.test(hint) ? 25 : 0);
}

export function initialScore(el: Element): number {
  return (TAG_WEIGHTS[el.localName] ?? 0) + classWeight(el);
}

export function linkDensity(el: Element): number {
  const total = textLength(el);

  if (!total) return 1;

  let links = 0;

  for (const a of Array.from(el.getElementsByTagName("a"))) links += textLength(a);

  return Math.min(links / total, 1);
}

function bareTextLength(div: Element): number {
  let length = 0;

  for (const n of Array.from(div.childNodes)) {
    if (n.nodeType === Node.TEXT_NODE) length += (n.nodeValue ?? "").trim().length;
  }

  return length;
}

// <p> plus divs holding bare text, because some portals still separate paragraphs with <br><br>.
export function paragraphs(root: Element): Element[] {
  const out: Element[] = Array.from(root.getElementsByTagName("p"));

  for (const div of Array.from(root.getElementsByTagName("div"))) {
    if (bareTextLength(div) >= MIN_BARE_TEXT) out.push(div);
  }

  return out;
}

export function paragraphScore(text: string): number {
  const commas = text.match(/[,،，]/g)?.length ?? 0;

  return 1 + commas + Math.min(Math.floor(text.length / 100), 3);
}

export function isReadAlso(el: Element): boolean {
  return (el.localName === "p" || el.localName === "li") && READ_ALSO.test((el.textContent ?? "").slice(0, 40));
}

export function supportsHas(): boolean {
  try {
    return CSS.supports("selector(:has(*))");
  } catch {
    return false;
  }
}

// Floated tables are sidebars (Wikipedia infoboxes and the like), not running text.
export function isFloatedTable(el: Element): boolean {
  return el.localName === "table" && FLOATS.has(getComputedStyle(el).cssFloat);
}

export function isHidden(el: Element): boolean {
  // checkVisibility() is missing in older Safari and jsdom; treat those as visible.
  if (typeof el.checkVisibility !== "function" || el.checkVisibility()) return false;

  // display:contents has no box, so checkVisibility() calls it hidden though its children render.
  return getComputedStyle(el).display !== "contents";
}

export function isValidSelector(doc: Document, selector: string): boolean {
  try {
    doc.createDocumentFragment().querySelector(selector);

    return true;
  } catch {
    warn(`Ignoring invalid excludeSelectors entry: ${selector}`);

    return false;
  }
}
