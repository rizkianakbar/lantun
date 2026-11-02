import { warn } from '../log'
import { isInsideSkipped, type SkipMatcher } from './skip'

// Readability-style heuristics, trimmed to what matters for picking one root on article pages.
const POSITIVE = /article|body|content|entry|main|post|story|text|detail|isi|berita|artikel/i
const NEGATIVE =
  /comment|sidebar|widget|footer|masthead|menu|nav|related|popular|share|social|sponsor|promo|banner|breadcrumb|cookie|subscribe|newsletter|tags?\b|meta|author|byline|caption|gpt-ad|(?:^|[\s_-])(?:ads?|advert\w*)(?:$|[\s_-])/i

const MIN_PARAGRAPH = 25
const MIN_HINTED_BODY = 200
// Share of a paragraph's score given to its parent, grandparent and great-grandparent.
const ANCESTOR_DIVIDERS = [1, 2, 6] as const

const tagWeight = (el: Element): number => {
  switch (el.localName) {
    case 'div':
    case 'article':
      return 5
    case 'pre':
    case 'td':
    case 'blockquote':
      return 3
    case 'ol':
    case 'ul':
    case 'dl':
    case 'li':
    case 'form':
      return -3
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
    case 'th':
      return -5
    default:
      return 0
  }
}

const classWeight = (el: Element): number => {
  const hint = `${el.getAttribute('class') ?? ''} ${el.id}`
  return (POSITIVE.test(hint) ? 25 : 0) - (NEGATIVE.test(hint) ? 25 : 0)
}

const linkDensity = (el: Element): number => {
  const total = (el.textContent ?? '').length
  if (!total) return 1
  let links = 0
  for (const a of Array.from(el.getElementsByTagName('a'))) links += (a.textContent ?? '').length
  return Math.min(links / total, 1)
}

// <p> plus divs holding bare text, because some portals still separate paragraphs with <br><br>.
const paragraphs = (root: Element): Element[] => {
  const out: Element[] = Array.from(root.getElementsByTagName('p'))
  for (const div of Array.from(root.getElementsByTagName('div'))) {
    let direct = 0
    for (const n of Array.from(div.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) direct += (n.nodeValue ?? '').trim().length
    }
    if (direct >= 80) out.push(div)
  }
  return out
}

const paragraphScore = (text: string): number =>
  1 + (text.match(/[,،，]/g)?.length ?? 0) + Math.min(Math.floor(text.length / 100), 3)

export const detectArticleRoot = (doc: Document, skip: SkipMatcher): Element | null => {
  const body = doc.body
  if (!body) return null

  const hinted = body.querySelector('[itemprop="articleBody"]')
  if (hinted && (hinted.textContent ?? '').trim().length >= MIN_HINTED_BODY) return hinted

  const scores = new Map<Element, number>()
  for (const p of paragraphs(body)) {
    const text = (p.textContent ?? '').trim()
    if (text.length < MIN_PARAGRAPH || isInsideSkipped(p, skip, body)) continue
    const score = paragraphScore(text)
    // A div holding bare text is itself the container, not a paragraph inside one.
    let el = p.localName === 'p' ? p.parentElement : p
    for (const divider of ANCESTOR_DIVIDERS) {
      if (!el || el === doc.documentElement) break
      scores.set(el, (scores.get(el) ?? tagWeight(el) + classWeight(el)) + score / divider)
      el = el.parentElement
    }
  }

  let best: Element | null = null
  let bestScore = 0
  for (const [el, score] of scores) {
    if (score <= bestScore) continue
    const adjusted = score * (1 - linkDensity(el))
    if (adjusted > bestScore) {
      best = el
      bestScore = adjusted
    }
  }
  return best ?? doc.querySelector('article') ?? doc.querySelector('main,[role="main"]') ?? body
}

export const findArticleRoot = (doc: Document, contentSelector: string | null, skip: SkipMatcher): Element | null => {
  if (contentSelector) {
    try {
      const el = doc.querySelector(contentSelector)
      if (el) return el
      warn(`contentSelector "${contentSelector}" matched nothing; falling back to auto-detect.`)
    } catch {
      warn(`contentSelector "${contentSelector}" is not a valid selector; falling back to auto-detect.`)
    }
  }
  return detectArticleRoot(doc, skip)
}
