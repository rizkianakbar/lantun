import { createAutoScroll } from "../autoscroll/autoscroll";
import { backgroundOf, css, resolveColor } from "../lib/color";
import { createStyle, setImportant } from "../lib/dom";
import { DEFAULT_RGB } from "../options/options.constants";
import { rangeFor } from "../textmap/textmap";
import { HIGHLIGHT_STYLE_ID, OVERLAY_WORD_ALPHA, SENTENCE_HIGHLIGHT, WORD_HIGHLIGHT } from "./highlight.constants";
import { highlightCss, sentenceAlpha, supportsHighlightApi } from "./highlight.lib";
import type { HighlightWindow, Painter, PainterOptions, ReadingView, ReadingViewOptions } from "./highlight.types";

function createApiPainter(doc: Document, win: Window, o: PainterOptions): Painter {
  const w = win as HighlightWindow;
  // Both exist: createPainter only picks this path after supportsHighlightApi().
  const registry = w.CSS?.highlights as HighlightRegistry;
  const HighlightCtor = w.Highlight as typeof Highlight;
  const sentence = new HighlightCtor();
  const word = new HighlightCtor();
  const style = createStyle(doc, highlightCss(o), o.nonce, HIGHLIGHT_STYLE_ID);

  word.priority = 1;
  registry.set(SENTENCE_HIGHLIGHT, sentence);
  registry.set(WORD_HIGHLIGHT, word);
  doc.head.append(style);

  function set(highlight: Highlight, range: Range | null): void {
    highlight.clear();
    if (range) highlight.add(range);
  }

  return {
    sentence(range) {
      set(sentence, range);
    },

    word(range) {
      set(word, range);
    },

    destroy() {
      registry.delete(SENTENCE_HIGHLIGHT);
      registry.delete(WORD_HIGHLIGHT);
      style.remove();
    },
  };
}

// Without the Highlight API: boxes in our own overlay, so the article markup is never touched.
function createOverlayPainter(doc: Document, win: Window, o: PainterOptions): Painter {
  const host = doc.createElement("lantun-overlay");
  const shadow = host.attachShadow({ mode: "open" });
  const ranges: Record<"s" | "w", Range | null> = { s: null, w: null };

  // Inline !important survives hostile host CSS such as `* { all: unset !important }`.
  setImportant(
    host,
    `all:initial;position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:${o.zIndex - 1}`,
  );
  host.setAttribute("aria-hidden", "true");
  shadow.append(
    createStyle(
      doc,
      `div{position:absolute;pointer-events:none;mix-blend-mode:multiply;border-radius:2px}@media print{div{display:none}}` +
        `.s{background:${css(o.color, sentenceAlpha(o.background, o.color))}}.w{background:${css(o.color, OVERLAY_WORD_ALPHA)}}`,
      o.nonce,
    ),
  );
  // Appended to <html>, not <body>, so a positioned body cannot shift the coordinates.
  doc.documentElement.append(host);

  function paint(): void {
    for (const box of Array.from(shadow.querySelectorAll("div"))) box.remove();

    const boxes = doc.createDocumentFragment();

    for (const kind of ["s", "w"] as const) {
      const range = ranges[kind];

      if (!range || typeof range.getClientRects !== "function") continue;

      for (const r of Array.from(range.getClientRects())) {
        if (!r.width || !r.height) continue;

        const box = doc.createElement("div");

        box.className = kind;
        box.style.cssText = `left:${r.left + win.scrollX}px;top:${r.top + win.scrollY}px;width:${r.width}px;height:${r.height}px`;
        boxes.append(box);
      }
    }

    // One insertion per paint instead of one per line box.
    shadow.append(boxes);
  }

  win.addEventListener("resize", paint);

  return {
    sentence(range) {
      ranges.s = range;
      paint();
    },

    word(range) {
      ranges.w = range;
      paint();
    },

    destroy() {
      win.removeEventListener("resize", paint);
      host.remove();
    },
  };
}

export function createPainter(doc: Document, win: Window, o: PainterOptions): Painter {
  return supportsHighlightApi(win) ? createApiPainter(doc, win, o) : createOverlayPainter(doc, win, o);
}

// Glue between player positions (text offsets) and what the reader sees: highlights + scrolling.
export function createReadingView(o: ReadingViewOptions): ReadingView {
  const painter = createPainter(o.doc, o.win, {
    color: resolveColor(o.color, o.doc) ?? DEFAULT_RGB,
    background: backgroundOf(o.root),
    zIndex: o.zIndex,
    nonce: o.nonce,
  });
  const scroller = createAutoScroll(o.win);

  return {
    sentence(start, end) {
      const range = rangeFor(o.map, start, end);

      painter.word(null);
      painter.sentence(range);
      if (range) scroller.follow(range);
    },

    word(start, end) {
      const range = rangeFor(o.map, start, end);

      painter.word(range);
      // Long sentences can run past the fold, so the word can need scrolling to as well.
      if (range) scroller.follow(range);
    },

    clear() {
      painter.sentence(null);
      painter.word(null);
    },

    destroy() {
      painter.destroy();
      scroller.destroy();
    },
  };
}
