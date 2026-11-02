export type RGB = [r: number, g: number, b: number]

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_FN = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i

// Returns null for transparent or unparseable colours. Named colours go through resolveColor().
export const parseColor = (input: string): RGB | null => {
  const s = input.trim()
  const hex = HEX.exec(s)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    if (full.length === 8 && full.slice(6) === '00') return null
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB
  }
  const m = RGB_FN.exec(s)
  if (!m) return null
  const alpha = m[4]
  if (alpha !== undefined && parseFloat(alpha) === 0) return null
  return [m[1], m[2], m[3]].map((v) => Math.min(255, Math.round(Number(v)))) as RGB
}

// Lets the browser parse anything CSS accepts ("rebeccapurple", "hsl(...)").
export const resolveColor = (input: string, doc: Document): RGB | null => {
  const direct = parseColor(input)
  if (direct || !doc.body) return direct
  const probe = doc.createElement('span')
  probe.style.color = input
  if (!probe.style.color) return null
  doc.body.append(probe)
  try {
    return parseColor(getComputedStyle(probe).color)
  } finally {
    probe.remove()
  }
}

const channel = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminance = ([r, g, b]: RGB): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

export const contrast = (a: RGB, b: RGB): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]

// White reads as the conventional "selected" look, so use it whenever it meets WCAG AA (4.5:1).
export const textOn = (bg: RGB): RGB =>
  contrast(bg, WHITE) >= 4.5 || contrast(bg, WHITE) >= contrast(bg, BLACK) ? WHITE : BLACK

// Effective background behind an element: first non-transparent one up the tree, else white.
export const backgroundOf = (el: Element): RGB => {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = parseColor(getComputedStyle(n).backgroundColor)
    if (bg) return bg
  }
  return WHITE
}

export const isDark = (c: RGB): boolean => luminance(c) < 0.18

export const css = ([r, g, b]: RGB, alpha = 1): string => (alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`)

// Same colour transforms the a11y dark/invert modes apply to the page (CSS filter matrices).
// Pre-transforming highlight colours with them makes the result come out as the brand colour.
export const invert = ([r, g, b]: RGB): RGB => [255 - r, 255 - g, 255 - b]

const clamp = (v: number): number => Math.min(255, Math.max(0, Math.round(v)))

export const hueRotate180 = ([r, g, b]: RGB): RGB => [
  clamp(-0.574 * r + 1.43 * g + 0.144 * b),
  clamp(0.426 * r + 0.43 * g + 0.144 * b),
  clamp(0.426 * r + 1.43 * g - 0.856 * b),
]

export const smartInvert = (c: RGB): RGB => hueRotate180(invert(c))
