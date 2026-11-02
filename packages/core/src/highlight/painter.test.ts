import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPainter, HIGHLIGHT_STYLE_ID, highlightCss, SENTENCE_HIGHLIGHT, supportsHighlightApi, WORD_HIGHLIGHT } from './painter'

class FakeHighlight extends Set<Range> {
  priority = 0
}

const OPTS = { color: [26, 115, 232] as [number, number, number], background: [255, 255, 255] as [number, number, number], zIndex: 100, nonce: null }

const rangeOver = (el: Element): Range => {
  const r = document.createRange()
  r.selectNodeContents(el)
  return r
}

afterEach(() => vi.restoreAllMocks())

describe('highlightCss', () => {
  it('only targets our own named highlights', () => {
    const css = highlightCss(OPTS)
    const selectors = css.match(/[^{}]+(?=\{)/g)?.map((s) => s.trim()).filter((s) => !s.startsWith('@')) ?? []
    for (const s of selectors) expect(s).toMatch(/^(html\.ax-contrast-(dark|invert) )?::highlight\(lantun-(sentence|word)\)$/)
  })

  it('uses a stronger sentence tint on dark pages', () => {
    expect(highlightCss(OPTS)).toContain('/ 0.18')
    expect(highlightCss({ ...OPTS, background: [20, 20, 20] })).toContain('/ 0.35')
  })

  it('gives the word highlight readable text', () => {
    expect(highlightCss(OPTS)).toMatch(/::highlight\(lantun-word\)\{background-color:rgb\(26 115 232\);color:rgb\(255 255 255\)\}/)
  })
})

describe('Highlight API painter', () => {
  const fakeWin = () => {
    const registry = new Map<string, FakeHighlight>()
    const win = Object.assign(Object.create(window), { CSS: { highlights: registry }, Highlight: FakeHighlight }) as Window
    return { win, registry }
  }

  it('is chosen when the API exists', () => {
    expect(supportsHighlightApi(fakeWin().win)).toBe(true)
    expect(supportsHighlightApi(window)).toBe(false) // jsdom
  })

  it('sets one range per highlight and cleans up fully', () => {
    document.body.innerHTML = '<p id="a">Sentence one.</p><p id="b">Word</p>'
    const before = document.body.innerHTML
    const { win, registry } = fakeWin()
    const p = createPainter(document, win, OPTS)
    p.sentence(rangeOver(document.getElementById('a') as Element))
    p.word(rangeOver(document.getElementById('b') as Element))
    expect(registry.get(SENTENCE_HIGHLIGHT)?.size).toBe(1)
    expect([...(registry.get(WORD_HIGHLIGHT) ?? [])][0]?.toString()).toBe('Word')
    expect(registry.get(WORD_HIGHLIGHT)?.priority).toBe(1)
    expect(document.getElementById(HIGHLIGHT_STYLE_ID)).not.toBeNull()
    p.word(null)
    expect(registry.get(WORD_HIGHLIGHT)?.size).toBe(0)
    p.destroy()
    expect(registry.size).toBe(0)
    expect(document.getElementById(HIGHLIGHT_STYLE_ID)).toBeNull()
    expect(document.body.innerHTML).toBe(before)
  })
})

describe('overlay painter (no Highlight API)', () => {
  it('draws boxes in its own shadow root without touching the article', () => {
    document.body.innerHTML = '<article><p id="a">Some text.</p></article>'
    const before = document.body.innerHTML
    // jsdom has no layout, so Range.getClientRects does not exist there.
    Range.prototype.getClientRects = () =>
      [
        { left: 10, top: 20, width: 50, height: 16 },
        { left: 10, top: 40, width: 30, height: 16 },
      ] as unknown as DOMRectList
    const p = createPainter(document, window, OPTS)
    p.sentence(rangeOver(document.getElementById('a') as Element))
    const host = document.querySelector('lantun-overlay')
    expect(host?.parentElement).toBe(document.documentElement)
    expect(host?.shadowRoot?.querySelectorAll('div.s')).toHaveLength(2)
    p.word(rangeOver(document.getElementById('a') as Element))
    expect(host?.shadowRoot?.querySelectorAll('div.w')).toHaveLength(2)
    expect(document.body.innerHTML).toBe(before)
    p.destroy()
    expect(document.querySelector('lantun-overlay')).toBeNull()
    delete (Range.prototype as Partial<Range>).getClientRects
  })
})

describe('highlightCss under a11y filters', () => {
  it('pre-inverts colours so they come out as the brand colour', () => {
    const css = highlightCss(OPTS)
    // invert(#1a73e8) = rgb(229 140 23)
    expect(css).toContain('html.ax-contrast-invert ::highlight(lantun-word){background-color:rgb(229 140 23)')
    expect(css).toMatch(/html\.ax-contrast-dark ::highlight\(lantun-sentence\)\{background-color:rgb\([\d ]+\/ 0\.35\)/)
  })
})
