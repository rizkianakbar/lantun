import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applySavedAx, AX_STYLE_ID, createAx } from './controller'
import { activeProfile, AX_DEFAULTS, axClasses, profileSettings, sanitizeAx } from './settings'
import { AX_CSS } from './styles'

const classes = () => Array.from(document.documentElement.classList).filter((c) => c.startsWith('ax-')).sort()

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  document.head.innerHTML = ''
})
afterEach(() => vi.restoreAllMocks())

describe('settings', () => {
  it('sanitises untrusted stored values', () => {
    expect(sanitizeAx({ text: 9, font: 'comic', contrast: 'dark', links: 'yes', cursor: true })).toEqual({
      ...AX_DEFAULTS,
      contrast: 'dark',
      cursor: true,
    })
    expect(sanitizeAx('garbage')).toEqual(AX_DEFAULTS)
  })

  it('maps settings to ax- classes', () => {
    expect(axClasses(AX_DEFAULTS)).toEqual([])
    expect(axClasses(profileSettings('lowVision')).sort()).toEqual(['ax-contrast-high', 'ax-cursor', 'ax-links', 'ax-text-130'])
    expect(axClasses(profileSettings('dyslexia')).sort()).toEqual(['ax-font-dyslexic', 'ax-guide', 'ax-line-1', 'ax-spacing-1'])
  })

  it('recognises an applied profile', () => {
    expect(activeProfile(profileSettings('seizure'))).toBe('seizure')
    expect(activeProfile({ ...profileSettings('seizure'), links: true })).toBeNull()
  })
})

describe('AX_CSS', () => {
  it('scopes every rule under an html.ax-* class', () => {
    const blocks = AX_CSS.split('\n')
    for (const rule of blocks) {
      if (rule.startsWith('@font-face')) continue
      const selector = rule.slice(0, rule.indexOf('{'))
      // Split on top-level commas only (not inside :is()/:not()).
      let depth = 0
      let part = ''
      const parts: string[] = []
      for (const ch of selector) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) {
          parts.push(part)
          part = ''
        } else part += ch
      }
      parts.push(part)
      for (const p of parts) expect(p.trim()).toMatch(/^html(\.ax-[a-z0-9-]+|:is\(\.ax-[a-z-]+(,\.ax-[a-z-]+)*\))/)
    }
  })
})

describe('createAx', () => {
  it('applies, persists and resets', () => {
    const ax = createAx(document)
    expect(document.getElementById(AX_STYLE_ID)).not.toBeNull()
    ax.update({ text: 2, links: true })
    expect(classes()).toEqual(['ax-links', 'ax-text-130'])
    expect(JSON.parse(localStorage.getItem('lantun:ax') ?? '{}')).toMatchObject({ text: 2, links: true })
    ax.reset()
    expect(classes()).toEqual([])
    ax.destroy()
  })

  it('keeps reading guide and mask mutually exclusive', () => {
    const ax = createAx(document)
    ax.update({ guide: true })
    ax.update({ mask: true })
    expect(ax.store.get()).toMatchObject({ guide: false, mask: true })
    ax.destroy()
  })

  it('toggles profiles on and off', () => {
    const ax = createAx(document)
    ax.toggleProfile('elderly', false)
    expect(classes()).toEqual(['ax-cursor', 'ax-font-readable', 'ax-text-130'])
    ax.toggleProfile('elderly', true)
    expect(classes()).toEqual([])
    ax.destroy()
  })

  it('pauses playing videos and resumes them afterwards', () => {
    document.body.innerHTML = '<video></video><video></video>'
    const [playing, idle] = Array.from(document.querySelectorAll('video'))
    Object.defineProperty(playing, 'paused', { value: false, configurable: true })
    Object.defineProperty(idle, 'paused', { value: true, configurable: true })
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const ax = createAx(document)
    ax.update({ still: true })
    expect(pause).toHaveBeenCalledTimes(1)
    idle?.dispatchEvent(new Event('play'))
    expect(pause).toHaveBeenCalledTimes(2)
    ax.update({ still: false })
    expect(play).toHaveBeenCalledTimes(2)
    ax.destroy()
  })

  it('removes everything it added on destroy, and only that', () => {
    document.documentElement.classList.add('ax-site-own-class')
    const ax = createAx(document)
    ax.update({ contrast: 'dark', desaturate: true })
    ax.destroy()
    expect(classes()).toEqual(['ax-site-own-class'])
    expect(document.getElementById(AX_STYLE_ID)).toBeNull()
  })
})

describe('applySavedAx', () => {
  it('restores saved classes synchronously, without touching anything when nothing is saved', () => {
    applySavedAx(document)
    expect(document.getElementById(AX_STYLE_ID)).toBeNull()
    localStorage.setItem('lantun:ax', JSON.stringify({ contrast: 'high' }))
    applySavedAx(document)
    expect(classes()).toEqual(['ax-contrast-high'])
    expect(document.getElementById(AX_STYLE_ID)).not.toBeNull()
  })
})
