import { afterEach, describe, expect, it, vi } from 'vitest'
import { destroy, init, isInitialized, on } from './index'
import { DEFAULT_COLOR, DEFAULT_Z_INDEX, resolveOptions } from './options'

afterEach(() => {
  destroy()
  document.documentElement.lang = ''
  vi.restoreAllMocks()
})

describe('resolveOptions', () => {
  it('applies spec defaults', () => {
    expect(resolveOptions({})).toEqual({
      contentSelector: null,
      excludeSelectors: [],
      position: 'right',
      color: DEFAULT_COLOR,
      lang: 'en',
      features: { tts: true, a11y: true },
      zIndex: DEFAULT_Z_INDEX,
      nonce: null,
    })
  })

  it('takes lang from <html lang> when not given', () => {
    document.documentElement.lang = 'id'
    expect(resolveOptions({}).lang).toBe('id')
    expect(resolveOptions({ lang: 'en-GB' }).lang).toBe('en-GB')
  })

  it('rejects an unknown position', () => {
    // Data attributes are untyped strings, so bad values do reach this at runtime.
    expect(resolveOptions({ position: 'top' as never }).position).toBe('right')
  })

  it('maps the original bottom-* positions to their edge', () => {
    expect(resolveOptions({ position: 'left' }).position).toBe('left')
    expect(resolveOptions({ position: 'bottom-left' }).position).toBe('left')
    expect(resolveOptions({ position: 'bottom-right' }).position).toBe('right')
  })
})

describe('public API boundary', () => {
  it('warns instead of initialising twice', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    init()
    init()
    expect(isInitialized()).toBe(true)
    expect(spy).toHaveBeenCalledWith('[Lantun]', expect.stringContaining('init() called twice'))
  })

  it('never throws into the host page', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const bad = { get contentSelector(): string { throw new Error('boom') } }
    expect(() => init(bad)).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })

  it('returns an unsubscribe function from on()', () => {
    const off = on('end', () => {})
    expect(typeof off).toBe('function')
  })
})

describe('destroy()', () => {
  it('removes every element, style and ax- class the widget added', () => {
    document.body.innerHTML = '<article><p>Some text to read here.</p></article>'
    localStorage.setItem('lantun:ax', JSON.stringify({ contrast: 'dark', links: true }))
    init({ contentSelector: 'article' })
    expect(document.querySelector('lantun-reader')).not.toBeNull()
    expect(document.documentElement.classList.contains('ax-contrast-dark')).toBe(true)
    destroy()
    expect(document.querySelector('lantun-reader, lantun-overlay')).toBeNull()
    expect(document.querySelector('#lantun-ax, #lantun-highlight')).toBeNull()
    expect(Array.from(document.documentElement.classList).filter((c) => c.startsWith('ax-'))).toEqual([])
    localStorage.clear()
  })
})

describe('init() failure', () => {
  it('rolls back completely so init can be retried', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const ui = await import('./ui/mount')
    const mount = vi.spyOn(ui, 'mountUI').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    localStorage.setItem('lantun:ax', JSON.stringify({ links: true }))
    init()
    expect(isInitialized()).toBe(false)
    expect(document.documentElement.classList.contains('ax-links')).toBe(false)
    expect(spy).toHaveBeenCalled()
    mount.mockRestore()
    init()
    expect(isInitialized()).toBe(true)
    destroy()
    localStorage.clear()
  })
})
