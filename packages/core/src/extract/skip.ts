import { warn } from '../log'

const ADS = '.ad,.ads,.advert,.advertisement,.ad-slot,.adsbygoogle,[id^="div-gpt-ad"],[data-ad-unit],[data-ad-slot]'

// Things a listener never wants read aloud, even when they sit inside the article root.
export const BUILTIN_SKIP = [
  '[data-reader-skip]',
  'nav,aside,footer,[role="navigation"],[role="complementary"],[role="note"]',
  // Figures hold images, captions, embeds, audio players and pull quotes, never body text.
  // Many CMSes mark captions and photo credits with classes instead of <figcaption>.
  'figure,figcaption,[class*="caption"],[class*="credit"]',
  // Text meant only for screen readers ("opens in new tab") is noise when read to everyone.
  '.sr-only,.screen-reader-text,.visually-hidden,.visuallyhidden',
  'script,style,noscript,template,iframe,object,embed,svg,math,canvas,video,audio',
  'button,select,textarea,input,form',
  // Code reads terribly through TTS; publishers can still opt in with contentSelector on a <pre>.
  'pre',
  '[hidden],[aria-hidden="true"]',
  ADS,
].join(',')

// Inline cross-links ("Baca juga: ...") are standard on Indonesian portals and break the flow of the article.
const READ_ALSO = /^\s*(baca juga|lihat juga|simak juga|read more|read also|see also|related)\s*:/i

const isReadAlso = (el: Element): boolean =>
  (el.localName === 'p' || el.localName === 'li') && READ_ALSO.test((el.textContent ?? '').slice(0, 40))

// Footnote markers ("[1]") that link to the notes list. Behind a support check: one selector a
// browser cannot parse would invalidate the whole skip list.
const FOOTNOTES = 'sup:has(> a[href^="#"])'
const supportsHas = (): boolean => {
  try {
    return CSS.supports('selector(:has(*))')
  } catch {
    return false
  }
}

// Floated tables are sidebars (Wikipedia infoboxes and the like), not part of the running text.
const isFloatedTable = (el: Element): boolean => {
  if (el.localName !== 'table') return false
  const side = getComputedStyle(el).cssFloat
  return side === 'left' || side === 'right' || side === 'inline-start' || side === 'inline-end'
}

const isHidden = (el: Element): boolean => {
  // checkVisibility() is missing in older Safari and jsdom; treat those as visible rather than guess.
  if (typeof el.checkVisibility !== 'function' || el.checkVisibility()) return false
  // display:contents has no box, so checkVisibility() reports it hidden even though its children render.
  return getComputedStyle(el).display !== 'contents'
}

const isValidSelector = (doc: Document, selector: string): boolean => {
  try {
    doc.createDocumentFragment().querySelector(selector)
    return true
  } catch {
    warn(`Ignoring invalid excludeSelectors entry: ${selector}`)
    return false
  }
}

export type SkipMatcher = (el: Element) => boolean

export const createSkipMatcher = (exclude: readonly string[] = [], doc: Document = document): SkipMatcher => {
  const custom = exclude.map((s) => s.trim()).filter((s) => s && isValidSelector(doc, s))
  const selector = [BUILTIN_SKIP, ...(supportsHas() ? [FOOTNOTES] : []), ...custom].join(',')
  return (el) => el.matches(selector) || isReadAlso(el) || isFloatedTable(el) || isHidden(el)
}

export const isInsideSkipped = (el: Element, skip: SkipMatcher, stopAt: Element): boolean => {
  for (let n: Element | null = el; n && n !== stopAt; n = n.parentElement) {
    if (skip(n)) return true
  }
  return false
}
