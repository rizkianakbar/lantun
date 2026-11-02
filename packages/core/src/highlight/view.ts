import { rangeFor, type TextMap } from '../textmap/textmap'
import { createAutoScroll, type AutoScroll } from './autoscroll'
import { backgroundOf, resolveColor, type RGB } from './colors'
import { createPainter, type Painter } from './painter'

export interface ReadingViewOptions {
  doc: Document
  win: Window
  map: TextMap
  root: Element
  color: string
  zIndex: number
  nonce: string | null
}

export interface ReadingView {
  sentence(start: number, end: number): void
  word(start: number, end: number): void
  clear(): void
  destroy(): void
}

// The default brand colour (options.ts), for a `color` the browser cannot parse.
const FALLBACK_COLOR: RGB = [245, 184, 65]

// Glue between player positions (text offsets) and what the reader sees: highlights + scrolling.
export const createReadingView = (o: ReadingViewOptions): ReadingView => {
  const painter: Painter = createPainter(o.doc, o.win, {
    color: resolveColor(o.color, o.doc) ?? FALLBACK_COLOR,
    background: backgroundOf(o.root),
    zIndex: o.zIndex,
    nonce: o.nonce,
  })
  const scroller: AutoScroll = createAutoScroll(o.win)

  return {
    sentence(start, end) {
      const range = rangeFor(o.map, start, end)
      painter.word(null)
      painter.sentence(range)
      if (range) scroller.follow(range)
    },
    word(start, end) {
      const range = rangeFor(o.map, start, end)
      painter.word(range)
      // Long sentences can run past the fold, so the word can need scrolling to as well.
      if (range) scroller.follow(range)
    },
    clear() {
      painter.sentence(null)
      painter.word(null)
    },
    destroy() {
      painter.destroy()
      scroller.destroy()
    },
  }
}
