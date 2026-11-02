import { useEffect, useRef, useState } from 'preact/hooks'
import type { Reader } from '../reader'
import type { Strings } from './i18n'
import { PlayIcon } from './icons'

interface Spot {
  index: number
  x: number
  y: number
}

const SIZE = 28
// Keeps the button up while the pointer travels from the text to it across the margin.
const HIDE_DELAY_MS = 450

// "Play from here": a button in the margin of the sentence under the mouse, and a chip under a
// text selection (the touch-friendly path). Both start reading at that sentence.
export const PlayHere = ({ reader, t, current, onPlay }: { reader: Reader; t: Strings; current: number | null; onPlay: (index: number) => void }) => {
  const [hover, setHover] = useState<Spot | null>(null)
  const [sel, setSel] = useState<Spot | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    let frame = 0
    let hideTimer = 0
    let px = 0
    let py = 0
    let overButton = false

    const update = (): void => {
      frame = 0
      if (overButton) return
      const hit = reader.sentenceAtPoint(px, py)
      if (!hit || Math.abs(hit.rect.top + hit.rect.height / 2 - py) > 400) {
        if (!hideTimer) hideTimer = window.setTimeout(() => setHover(null), HIDE_DELAY_MS)
        return
      }
      clearTimeout(hideTimer)
      hideTimer = 0
      const next = { index: hit.index, x: Math.max(4, hit.rect.left - SIZE - 10), y: hit.rect.top + hit.rect.height / 2 - SIZE / 2 }
      // Runs every frame the mouse moves; most frames land on the same sentence, so skip those renders.
      setHover((prev) => (prev && prev.index === next.index && prev.x === next.x && prev.y === next.y ? prev : next))
    }
    const onMove = (e: MouseEvent): void => {
      overButton = !!button.current && e.composedPath().includes(button.current)
      px = e.clientX
      py = e.clientY
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onScroll = (): void => setHover(null)
    document.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      clearTimeout(hideTimer)
    }
  }, [reader])

  useEffect(() => {
    let timer = 0
    const check = (): void => {
      const index = reader.selectionSentence()
      const range = index === null ? null : document.getSelection()?.getRangeAt(0)
      const rect = range?.getBoundingClientRect()
      if (index === null || !rect) {
        setSel(null)
        return
      }
      setSel({
        index,
        x: Math.min(Math.max(8, rect.left), window.innerWidth - 180),
        y: Math.min(rect.bottom + 10, window.innerHeight - 110),
      })
    }
    const onChange = (): void => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 220)
    }
    const onScroll = (): void => setSel(null)
    document.addEventListener('selectionchange', onChange)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('selectionchange', onChange)
      window.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [reader])

  const showHover = hover && hover.index !== current
  return (
    <>
      <button
        ref={button}
        type="button"
        class={`here${showHover ? ' on' : ''}`}
        style={hover ? { top: `${hover.y}px`, left: `${hover.x}px` } : { visibility: 'hidden' }}
        aria-label={t.playFromHere}
        tabIndex={-1}
        onClick={() => {
          if (!hover) return
          onPlay(hover.index)
          setHover(null)
        }}
      >
        <PlayIcon size={14} />
      </button>
      {sel && (
        <button
          type="button"
          class="selchip surface"
          style={{ top: `${sel.y}px`, left: `${sel.x}px` }}
          // Keep the selection alive: a mousedown on a button would otherwise clear it first.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onPlay(sel.index)
            setSel(null)
          }}
        >
          <span class="disc">
            <PlayIcon size={11} />
          </span>
          {t.playFromHere}
        </button>
      )}
    </>
  )
}
