import { createStyle } from '../dom'
import { readJson, writeJson } from '../state/storage'
import { createStore, type Store } from '../state/store'
import { ALL_AX_CLASSES, AX_DEFAULTS, axClasses, profileSettings, sanitizeAx, type AxSettings, type ProfileId } from './settings'
import { AX_CSS } from './styles'

export const AX_STYLE_ID = 'lantun-ax'
const MORPH = 'ax-morph'
const KEY = 'ax'

export const loadAx = (): AxSettings => sanitizeAx(readJson(KEY))

const ensureStyle = (doc: Document, nonce: string | null): HTMLStyleElement => {
  const existing = doc.getElementById(AX_STYLE_ID)
  if (existing instanceof HTMLStyleElement) return existing
  const style = createStyle(doc, AX_CSS, nonce, AX_STYLE_ID)
  ;(doc.head ?? doc.documentElement).append(style)
  return style
}

const applyClasses = (doc: Document, s: AxSettings): void => {
  const wanted = new Set(axClasses(s))
  const list = doc.documentElement.classList
  // Only our known classes: a host site's own "ax-*" classes are left alone.
  for (const c of ALL_AX_CLASSES) list.toggle(c, wanted.has(c))
}

// Runs synchronously at the top of the loader so returning readers get their settings before
// the widget UI exists (and before first paint when the loader is inlined in <head>).
export const applySavedAx = (doc: Document, nonce: string | null = null): void => {
  const s = loadAx()
  if (!axClasses(s).length) return
  ensureStyle(doc, nonce)
  applyClasses(doc, s)
}

export interface AxController {
  store: Store<AxSettings>
  update(patch: Partial<AxSettings>): void
  toggleProfile(id: ProfileId, active: boolean): void
  reset(): void
  destroy(): void
}

export const createAx = (doc: Document, nonce: string | null = null): AxController => {
  const store = createStore<AxSettings>(loadAx())
  const style = ensureStyle(doc, nonce)
  // Videos we paused for "pause animations", resumed when it is turned off again.
  const paused = new Set<HTMLVideoElement>()

  const stillMedia = (still: boolean): void => {
    if (still) {
      for (const v of Array.from(doc.querySelectorAll('video'))) {
        if (!v.paused) {
          v.pause()
          paused.add(v)
        }
      }
      return
    }
    for (const v of paused) void v.play().catch(() => {})
    paused.clear()
  }
  // Catches autoplaying videos that start after the setting was turned on.
  const onPlay = (e: Event): void => {
    if (!store.get().still || !(e.target instanceof HTMLVideoElement)) return
    e.target.pause()
    paused.add(e.target)
  }
  doc.addEventListener('play', onPlay, true)

  // Text reflowing at a new size, or the page flipping to dark, is jarring as a hard cut. A View
  // Transition crossfades old and new instead. Skipped with reduced motion, "pause animations" or
  // a hidden tab, and wherever the API is missing. MORPH scopes our timing rules (styles.ts) to
  // our own transitions and makes them click-through, so quick repeated presses still land.
  let morphing = 0
  let alive = true
  const morph = (s: AxSettings, calm: boolean): void => {
    const change = (): void => {
      if (alive) applyClasses(doc, s)
    }
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm || reduced || doc.visibilityState !== 'visible' || typeof doc.startViewTransition !== 'function') {
      change()
      return
    }
    const root = doc.documentElement
    root.classList.add(MORPH)
    morphing++
    const done = (): void => {
      if (--morphing === 0) root.classList.remove(MORPH)
    }
    try {
      doc.startViewTransition(change).finished.then(done, done)
    } catch {
      done()
      change()
    }
  }

  let last = store.get()
  applyClasses(doc, last)
  if (last.still) stillMedia(true)

  const unsubscribe = store.subscribe((s) => {
    morph(s, s.still || last.still)
    if (s.still !== last.still) stillMedia(s.still)
    last = s
    writeJson(KEY, s)
  })

  return {
    store,
    update(patch) {
      // Guide and mask are mutually exclusive: both at once leave nothing readable.
      const next = { ...patch }
      if (patch.guide) next.mask = false
      if (patch.mask) next.guide = false
      store.set(next)
    },
    toggleProfile(id, active) {
      store.set(active ? { ...AX_DEFAULTS } : profileSettings(id))
    },
    reset() {
      store.set({ ...AX_DEFAULTS })
    },
    destroy() {
      alive = false
      unsubscribe()
      doc.removeEventListener('play', onPlay, true)
      stillMedia(false)
      for (const c of [...ALL_AX_CLASSES, MORPH]) doc.documentElement.classList.remove(c)
      style.remove()
    },
  }
}
