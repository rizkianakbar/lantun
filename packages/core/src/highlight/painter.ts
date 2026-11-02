import { createStyle, setImportant } from '../dom'
import { css, invert, isDark, luminance, smartInvert, textOn, type RGB } from './colors'

export const SENTENCE_HIGHLIGHT = 'lantun-sentence'
export const WORD_HIGHLIGHT = 'lantun-word'
export const HIGHLIGHT_STYLE_ID = 'lantun-highlight'

export interface PainterOptions {
  color: RGB
  // Background behind the article; a dark page needs a stronger sentence tint to stay visible.
  background: RGB
  zIndex: number
  nonce: string | null
}

export interface Painter {
  sentence(range: Range | null): void
  word(range: Range | null): void
  destroy(): void
}

// lib.dom only types these as globals, not as members of an arbitrary Window.
type HighlightWindow = Window & { CSS?: { highlights?: HighlightRegistry }; Highlight?: typeof Highlight }

export const supportsHighlightApi = (win: Window = window): boolean => {
  const w = win as HighlightWindow
  return !!w.CSS?.highlights && typeof w.Highlight === 'function'
}

// Light brand colours (yellows) wash out at the tint that suits a saturated blue on white.
const sentenceAlpha = (bg: RGB, color: RGB): number => (isDark(bg) ? 0.35 : luminance(color) > 0.4 ? 0.28 : 0.18)

// The only rules we add to the document, and they can only ever match our own named highlights.
export const highlightCss = ({ color, background }: PainterOptions): string => {
  const alpha = sentenceAlpha(background, color)
  const ink = textOn(color)
  const rules = (prefix: string, f: (c: RGB) => RGB = (c) => c, a = alpha): string =>
    `${prefix}::highlight(${SENTENCE_HIGHLIGHT}){background-color:${css(f(color), a)}}` +
    `${prefix}::highlight(${WORD_HIGHLIGHT}){background-color:${css(f(color))};color:${css(f(ink))}}`
  return [
    rules(''),
    // Under the page-wide a11y filters, pre-transformed colours come out as the real brand colour.
    // The filtered page reads as dark, so it gets the dark-page tint strength.
    rules('html.ax-contrast-dark ', smartInvert, 0.35),
    rules('html.ax-contrast-invert ', invert, 0.35),
    `@media (forced-colors:active){::highlight(${SENTENCE_HIGHLIGHT}){background-color:transparent;text-decoration:underline}` +
      `::highlight(${WORD_HIGHLIGHT}){background-color:Highlight;color:HighlightText}}`,
    // A page printed mid-listen should not carry the reading position onto paper.
    `@media print{::highlight(${SENTENCE_HIGHLIGHT}){background-color:transparent}::highlight(${WORD_HIGHLIGHT}){background-color:transparent;color:inherit}}`,
  ].join('\n')
}

const createApiPainter = (doc: Document, win: Window, o: PainterOptions): Painter => {
  const w = win as HighlightWindow
  // Both exist: createPainter only picks this path after supportsHighlightApi().
  const registry = w.CSS?.highlights as HighlightRegistry
  const HighlightCtor = w.Highlight as typeof Highlight
  const sentence = new HighlightCtor()
  const word = new HighlightCtor()
  word.priority = 1
  registry.set(SENTENCE_HIGHLIGHT, sentence)
  registry.set(WORD_HIGHLIGHT, word)

  const style = createStyle(doc, highlightCss(o), o.nonce, HIGHLIGHT_STYLE_ID)
  doc.head.append(style)

  const set = (h: Highlight, range: Range | null): void => {
    h.clear()
    if (range) h.add(range)
  }
  return {
    sentence: (r) => set(sentence, r),
    word: (r) => set(word, r),
    destroy() {
      registry.delete(SENTENCE_HIGHLIGHT)
      registry.delete(WORD_HIGHLIGHT)
      style.remove()
    },
  }
}

// Fallback for browsers without the Highlight API: translucent boxes over the text in our own
// overlay, so the article markup is never touched.
const createOverlayPainter = (doc: Document, win: Window, o: PainterOptions): Painter => {
  const host = doc.createElement('lantun-overlay')
  // Inline !important survives hostile host CSS such as `* { all: unset !important }`.
  setImportant(
    host,
    `all:initial;position:absolute;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:${o.zIndex - 1}`,
  )
  host.setAttribute('aria-hidden', 'true')
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.append(
    createStyle(
      doc,
      `div{position:absolute;pointer-events:none;mix-blend-mode:multiply;border-radius:2px}@media print{div{display:none}}` +
        `.s{background:${css(o.color, sentenceAlpha(o.background, o.color))}}.w{background:${css(o.color, 0.45)}}`,
      o.nonce,
    ),
  )
  // Appended to <html>, not <body>, so a positioned body cannot shift the coordinates.
  doc.documentElement.append(host)

  let current: Record<'s' | 'w', Range | null> = { s: null, w: null }

  const paint = (): void => {
    for (const box of Array.from(shadow.querySelectorAll('div'))) box.remove()
    for (const kind of ['s', 'w'] as const) {
      const range = current[kind]
      if (!range || typeof range.getClientRects !== 'function') continue
      for (const r of Array.from(range.getClientRects())) {
        if (!r.width || !r.height) continue
        const box = doc.createElement('div')
        box.className = kind
        box.style.cssText = `left:${r.left + win.scrollX}px;top:${r.top + win.scrollY}px;width:${r.width}px;height:${r.height}px`
        shadow.append(box)
      }
    }
  }
  const onResize = (): void => paint()
  win.addEventListener('resize', onResize)

  return {
    sentence(r) {
      current = { ...current, s: r }
      paint()
    },
    word(r) {
      current = { ...current, w: r }
      paint()
    },
    destroy() {
      win.removeEventListener('resize', onResize)
      host.remove()
    },
  }
}

export const createPainter = (doc: Document, win: Window, o: PainterOptions): Painter =>
  supportsHighlightApi(win) ? createApiPainter(doc, win, o) : createOverlayPainter(doc, win, o)
