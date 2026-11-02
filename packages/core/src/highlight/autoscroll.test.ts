import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoScroll } from './autoscroll'

const rangeAt = (top: number, height = 20): Range =>
  ({ getBoundingClientRect: () => ({ top, bottom: top + height, height }) }) as unknown as Range

let scrollBy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  scrollBy = vi.fn()
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
})
afterEach(() => vi.useRealTimers())

describe('createAutoScroll', () => {
  it('leaves a sentence that is already comfortably in view', () => {
    const s = createAutoScroll(window)
    s.follow(rangeAt(400))
    expect(scrollBy).not.toHaveBeenCalled()
    s.destroy()
  })

  it('scrolls a sentence below the fold to 30% from the top', () => {
    const s = createAutoScroll(window)
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' })
    s.follow(rangeAt(50))
    expect(scrollBy).toHaveBeenLastCalledWith({ top: -250, behavior: 'smooth' })
    s.destroy()
  })

  it('scrolls when a sentence straddles the bottom of the band', () => {
    const s = createAutoScroll(window)
    s.follow(rangeAt(800, 100))
    expect(scrollBy).toHaveBeenCalled()
    s.destroy()
  })

  it('pauses for 5 s after the reader scrolls by hand', () => {
    const s = createAutoScroll(window)
    window.dispatchEvent(new Event('wheel'))
    s.follow(rangeAt(1200))
    vi.advanceTimersByTime(4900)
    s.follow(rangeAt(1200))
    expect(scrollBy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    s.destroy()
  })

  it('counts scroll keys but not typing in a field', () => {
    const s = createAutoScroll(window)
    document.body.innerHTML = '<input id="i">'
    document.getElementById('i')?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    s.destroy()
  })

  it('jumps instead of animating with prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    const s = createAutoScroll(window)
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledWith({ top: 900, behavior: 'auto' })
    s.destroy()
    window.matchMedia = undefined as unknown as typeof window.matchMedia
  })

  it('stops listening after destroy', () => {
    const s = createAutoScroll(window)
    s.destroy()
    window.dispatchEvent(new Event('wheel'))
    s.follow(rangeAt(1200))
    expect(scrollBy).toHaveBeenCalledTimes(1)
  })
})
