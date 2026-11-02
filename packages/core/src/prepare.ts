import { findArticleRoot } from './extract/root'
import { createSkipMatcher } from './extract/skip'
import { segment, type Sentence } from './segment/segment'
import { buildTextMap, type TextMap } from './textmap/textmap'
import type { ResolvedOptions } from './types'

export interface Prepared {
  root: Element
  map: TextMap
  sentences: Sentence[]
}

export const prepare = (
  doc: Document,
  opts: Pick<ResolvedOptions, 'contentSelector' | 'excludeSelectors' | 'lang'>,
): Prepared | null => {
  const skip = createSkipMatcher(opts.excludeSelectors, doc)
  const root = findArticleRoot(doc, opts.contentSelector, skip)
  if (!root) return null
  const map = buildTextMap(root, skip)
  return { root, map, sentences: segment(map.text, opts.lang) }
}
