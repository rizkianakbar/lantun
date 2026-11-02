export interface AutoScrollOptions {
  // How long auto-scroll stays off after the reader scrolls by hand (spec: 5 s).
  pauseMs?: number
}

export interface AutoScroll {
  follow(range: Range): void
  destroy(): void
}

// The comfortable reading band, as fractions of viewport height. Targeting 30% from the top
// also keeps text clear of the sticky headers most news portals use.
const BAND_TOP = 0.15
const BAND_BOTTOM = 0.85
const TARGET = 0.3

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

export const createAutoScroll = (win: Window, o: AutoScrollOptions = {}): AutoScroll => {
  const pauseMs = o.pauseMs ?? 5000
  const doc = win.document
  let suspendedUntil = 0

  // Only real user input counts: our own smooth scrolling fires `scroll` events too.
  const suspend = (): void => {
    suspendedUntil = Date.now() + pauseMs
  }
  const onKey = (e: KeyboardEvent): void => {
    // Keys typed into a field, or pressed inside our own (shadow-hosted) UI, are not page scrolling.
    const t = e.target as HTMLElement | null
    if (SCROLL_KEYS.has(e.key) && !t?.isContentEditable && !/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '') && !t?.shadowRoot) {
      suspend()
    }
  }
  // A pointerdown on <html> itself is a click on the page scrollbar.
  const onPointer = (e: PointerEvent): void => {
    if (e.target === doc.documentElement) suspend()
  }
  const opts: AddEventListenerOptions = { passive: true, capture: true }
  win.addEventListener('wheel', suspend, opts)
  win.addEventListener('touchmove', suspend, opts)
  win.addEventListener('keydown', onKey, opts)
  win.addEventListener('pointerdown', onPointer, opts)

  const reducedMotion = (): boolean => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  return {
    follow(range) {
      if (Date.now() < suspendedUntil || doc.hidden || typeof range.getBoundingClientRect !== 'function') return
      const rect = range.getBoundingClientRect()
      if (!rect.height) return
      const vh = win.innerHeight
      const tall = rect.height > vh * (BAND_BOTTOM - BAND_TOP)
      const outside = rect.top < vh * BAND_TOP || rect.top > vh * BAND_BOTTOM || (!tall && rect.bottom > vh * BAND_BOTTOM)
      if (!outside) return
      win.scrollBy({ top: rect.top - vh * TARGET, behavior: reducedMotion() ? 'auto' : 'smooth' })
    },
    destroy() {
      win.removeEventListener('wheel', suspend, opts)
      win.removeEventListener('touchmove', suspend, opts)
      win.removeEventListener('keydown', onKey, opts)
      win.removeEventListener('pointerdown', onPointer, opts)
    },
  }
}
