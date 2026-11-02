import { describe, expect, it } from 'vitest'
import { backgroundOf, contrast, isDark, parseColor, resolveColor, textOn } from './colors'

describe('parseColor', () => {
  it.each([
    ['#1a73e8', [26, 115, 232]],
    ['#FFF', [255, 255, 255]],
    ['#1a73e8ff', [26, 115, 232]],
    ['rgb(26, 115, 232)', [26, 115, 232]],
    ['rgba(0,0,0,0.5)', [0, 0, 0]],
    ['rgb(10 20 30 / 50%)', [10, 20, 30]],
  ])('%s', (input, rgb) => expect(parseColor(input)).toEqual(rgb))

  it.each(['transparent', 'rgba(0, 0, 0, 0)', '#0000', 'nonsense', ''])('rejects %s', (input) => {
    expect(parseColor(input)).toBeNull()
  })
})

describe('resolveColor', () => {
  it('lets the browser resolve named colours', () => {
    expect(resolveColor('red', document)).toEqual([255, 0, 0])
    expect(resolveColor('not-a-colour', document)).toBeNull()
  })
})

describe('textOn', () => {
  it('picks the higher-contrast text colour', () => {
    expect(textOn([255, 235, 59])).toEqual([0, 0, 0]) // yellow
    expect(textOn([13, 71, 161])).toEqual([255, 255, 255]) // dark blue
  })

  it('always reaches at least 4.5:1 for the default brand colour', () => {
    const brand = parseColor('#1a73e8') as [number, number, number]
    expect(contrast(brand, textOn(brand))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('backgroundOf', () => {
  it('finds the first opaque background up the tree, defaulting to white', () => {
    document.body.innerHTML = '<div style="background:#111"><p><span id="t">x</span></p></div><i id="u">y</i>'
    const dark = backgroundOf(document.getElementById('t') as Element)
    expect(dark).toEqual([17, 17, 17])
    expect(isDark(dark)).toBe(true)
    expect(backgroundOf(document.getElementById('u') as Element)).toEqual([255, 255, 255])
  })
})
