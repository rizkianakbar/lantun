import type { RefObject } from 'preact'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { ReaderState } from '../reader'
import type { Store } from '../state/store'

export const useStore = <T extends object>(store: Store<T>): T => {
  const [state, setState] = useState(store.get())
  useEffect(() => {
    setState(store.get())
    return store.subscribe(setState)
  }, [store])
  return state
}

// Closes a popover or panel on a press outside it. composedPath() sees through our shadow root.
export const useDismiss = (open: boolean, inside: RefObject<HTMLElement>[], onClose: () => void): void => {
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      const path = e.composedPath()
      if (!inside.some((r) => r.current && path.includes(r.current))) close.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
    // `inside` holds stable refs, so only `open` matters.
  }, [open])
}

// Arrow/Home/End navigation for role=radiogroup with a roving tabindex.
export const radioKeys = (e: KeyboardEvent, count: number, current: number, select: (i: number) => void): void => {
  const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
  const next = step ? (current + step + count) % count : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : -1
  if (next < 0) return
  // Keep the player's own arrow-key shortcuts from also firing.
  e.preventDefault()
  e.stopPropagation()
  select(next)
  ;(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
}

// Tracks the pointer's vertical position, at most once per frame.
export const usePointerY = (apply: (y: number) => void): void => {
  const fn = useRef(apply)
  fn.current = apply
  useEffect(() => {
    let frame = 0
    let y = window.innerHeight / 2
    fn.current(y)
    const onMove = (e: PointerEvent): void => {
      y = e.clientY
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          fn.current(y)
        })
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])
}

// Time left ticks down every second between sentence updates, but never below what is left
// after the current sentence, so the clock does not jump backwards when the next one starts.
export const useCountdown = (state: ReaderState): number => {
  const [now, setNow] = useState(Date.now)
  const since = useRef(Date.now())
  const playing = state.status === 'playing'
  useEffect(() => {
    since.current = Date.now()
    setNow(since.current)
  }, [state.remaining, playing])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [playing])
  if (!playing) return state.remaining
  // `remaining` is already in seconds at the current rate, so wall-clock time subtracts directly.
  return Math.max(state.remainingAfter, state.remaining - (now - since.current) / 1000)
}

const EDGE = 12
// Space between the dock and a panel it opens.
const GAP = 12

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi))
const clamp01 = (v: number): number => clamp(v, 0, 1)

// Places the dock with its centre at (x, y) as viewport fractions, kept fully on screen, so 0 and
// 1 sit flush against an edge whatever the dock's current size or direction.
export const placeDock = (el: HTMLElement, x: number, y: number): void => {
  const w = el.offsetWidth
  const h = el.offsetHeight
  el.style.left = `${Math.round(clamp(x * window.innerWidth - w / 2, EDGE, window.innerWidth - EDGE - w))}px`
  el.style.top = `${Math.round(clamp(y * window.innerHeight - h / 2, EDGE, window.innerHeight - EDGE - h))}px`
}

// Keeps the dock in place as the window resizes and as it grows or shrinks (session controls
// unfolding), so it grows around its centre instead of off the screen.
export const useDockPlacement = (ref: RefObject<HTMLElement>, x: number, y: number, deps: unknown[]): void => {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = (): void => {
      if (!('drag' in el.dataset)) placeDock(el, x, y)
    }
    place()
    // Glide only between placements, never from the unplaced (0, 0) of the first frame.
    const ready = requestAnimationFrame(() => (el.dataset.ready = ''))
    window.addEventListener('resize', place)
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null
    observer?.observe(el)
    return () => {
      cancelAnimationFrame(ready)
      window.removeEventListener('resize', place)
      observer?.disconnect()
    }
  }, [x, y, ...deps])
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height })

// The dock's untransformed box: we set its left/top ourselves (placeDock).
const layoutBox = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect()
  const left = parseFloat(el.style.left)
  const top = parseFloat(el.style.top)
  return Number.isFinite(left) && Number.isFinite(top) ? box(left, top, el.offsetWidth, el.offsetHeight) : box(r.left, r.top, r.width, r.height)
}

// A control's box inside the dock, from layout offsets (the dock is its offset parent).
const offsetIn = (el: HTMLElement, dock: Box): Box => box(dock.left + el.offsetLeft, dock.top + el.offsetTop, el.offsetWidth, el.offsetHeight)

// Places a floating panel next to the dock: beside a vertical dock (on whichever side has room,
// centred on the control that opened it), above or below a horizontal one. Once placed, a panel
// keeps its spot while its content changes (a profile hint growing a line must not shift it);
// only a window resize places it afresh. Phones turn panels into bottom sheets in CSS.
export const useAnchor = (panel: RefObject<HTMLElement>, anchor: RefObject<HTMLElement>): void => {
  useLayoutEffect(() => {
    const place = (fresh: boolean): void => {
      const el = panel.current
      const a = anchor.current
      if (!el || !a) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Layout boxes, not getBoundingClientRect(): mid-animation the dock is scaled and shifted,
      // and a panel placed from that would keep the wrong spot.
      const dockEl = (a.closest('.dock') ?? a) as HTMLElement
      const dock = layoutBox(dockEl)
      const r = a === dockEl ? dock : offsetIn(a, dock)
      const flat = dockEl.getAttribute('data-o') === 'h'
      const above = dock.top + dock.height / 2 > vh / 2
      // Beside a flat dock a panel only has the room above (or below) it; it scrolls inside that.
      el.style.maxHeight = flat ? `${Math.round((above ? dock.top : vh - dock.bottom) - GAP - EDGE)}px` : ''
      const w = el.offsetWidth
      const h = el.offsetHeight
      let left: number
      let top: number
      let px = 0
      let py = 0
      if (flat) {
        left = clamp(r.left + r.width / 2 - w / 2, EDGE, vw - w - EDGE)
        top = above ? dock.top - GAP - h : dock.bottom + GAP
        py = above ? 10 : -10
      } else {
        const toLeft = dock.left + dock.width / 2 > vw / 2
        left = toLeft ? dock.left - GAP - w : dock.right + GAP
        const prev = Number(el.dataset.top)
        top = !fresh && Number.isFinite(prev) && el.dataset.top ? prev : r.top + r.height / 2 - h / 2
        px = toLeft ? 10 : -10
      }
      top = Math.round(clamp(top, EDGE, vh - h - EDGE))
      el.dataset.top = String(top)
      el.style.setProperty('--top', `${top}px`)
      el.style.setProperty('--left', `${Math.round(clamp(left, EDGE, vw - w - EDGE))}px`)
      el.style.setProperty('--px', `${px}px`)
      el.style.setProperty('--py', `${py}px`)
    }
    const onResize = (): void => place(true)
    place(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })
}

// Released this close to a side, the dock snaps flush against it: upright on the left or right
// edge, lying flat on the top or bottom one. Anywhere else it floats and keeps its direction.
const SNAP = 80

export interface DockDrop {
  x: number
  y: number
  o: 'v' | 'h'
}

export const dropDock = (cx: number, cy: number, o: 'v' | 'h', vw: number, vh: number): DockDrop => {
  const x = clamp01(cx / vw)
  const y = clamp01(cy / vh)
  if (cx < SNAP) return { x: 0, y, o: 'v' }
  if (cx > vw - SNAP) return { x: 1, y, o: 'v' }
  if (cy < SNAP) return { x, y: 0, o: 'h' }
  if (cy > vh - SNAP) return { x, y: 1, o: 'h' }
  return { x, y, o }
}

// Drag from a handle, anywhere on screen. The dock follows the pointer directly during the
// gesture and the result is committed once at the end, so dragging is not a re-render per move.
export const useDrag = (target: RefObject<HTMLElement>, o: 'v' | 'h', onStart: () => void, onEnd: (drop: DockDrop) => void) => {
  const cb = useRef({ onStart, onEnd, o })
  cb.current = { onStart, onEnd, o }
  return (e: PointerEvent): void => {
    const el = target.current
    if (!el || e.button !== 0) return
    e.preventDefault()
    const handle = e.currentTarget as HTMLElement
    handle.setPointerCapture?.(e.pointerId)
    const rect = el.getBoundingClientRect()
    // Keep the grab point under the pointer instead of jumping the dock's centre to it.
    const dx = rect.left + rect.width / 2 - e.clientX
    const dy = rect.top + rect.height / 2 - e.clientY
    let cx = rect.left + rect.width / 2
    let cy = rect.top + rect.height / 2
    el.dataset.drag = ''
    cb.current.onStart()
    const move = (ev: PointerEvent): void => {
      cx = ev.clientX + dx
      cy = ev.clientY + dy
      placeDock(el, cx / window.innerWidth, cy / window.innerHeight)
    }
    const up = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      delete el.dataset.drag
      cb.current.onEnd(dropDock(cx, cy, cb.current.o, window.innerWidth, window.innerHeight))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }
}

// Narrow screens (phones) get the dock flat along the bottom, where thumbs reach and it covers
// no text. Follows rotation and window resizing.
export const useNarrow = (): boolean => {
  const [query] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(max-width: 540px)') : null))
  const [narrow, setNarrow] = useState(query?.matches ?? false)
  useEffect(() => {
    if (!query) return
    const on = (): void => setNarrow(query.matches)
    query.addEventListener?.('change', on)
    return () => query.removeEventListener?.('change', on)
  }, [query])
  return narrow
}

const calm = (): boolean => typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches

// Keeps something mounted for its exit animation. `leaving` marks the element so CSS can play
// the exit; with reduced motion (or no matchMedia, as in tests) it unmounts at once.
export const usePresence = <T,>(value: T | null | false, ms: number, still = false): { shown: T | null; leaving: boolean } => {
  const [kept, setKept] = useState<T | null>(value || null)
  const live = value || null
  useEffect(() => {
    if (live !== null) {
      setKept(live)
      return
    }
    if (still || calm()) {
      setKept(null)
      return
    }
    const id = setTimeout(() => setKept(null), ms)
    return () => clearTimeout(id)
  }, [live])
  return { shown: live ?? kept, leaving: live === null && kept !== null }
}
