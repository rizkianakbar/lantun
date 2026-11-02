// One flat string for the segmenter, plus a per-character table back to the DOM so any
// [start, end) slice of it can become a Range without touching the publisher's markup.
export interface TextMap {
  text: string
  nodes: Text[]
  // Per character of `text`: index into `nodes`, or -1 for separators the map inserted.
  nodeIndex: Int32Array
  // Per character of `text`: offset inside its Text node (meaningless when nodeIndex is -1).
  nodeOffset: Int32Array
  // Index in `text` of each node's first character.
  nodeStart: number[]
}

const BLOCKS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol',
  'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
])

// Tag names rather than computed style: no layout cost, and it behaves the same in jsdom.
const blockOf = (node: Node, root: Element): Element => {
  for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
    if (BLOCKS.has(el.localName)) return el
  }
  return root
}

const isCollapsible = (c: number): boolean => c === 32 || c === 10 || c === 9 || c === 13 || c === 12

type Gap = 'none' | 'space' | 'break'

export const buildTextMap = (root: Element, skip: (el: Element) => boolean = () => false): TextMap => {
  const parts: string[] = []
  const nodes: Text[] = []
  const nodeStart: number[] = []
  const index: number[] = []
  const offset: number[] = []
  // A newline between blocks is a hard sentence break for Intl.Segmenter (UAX #29 SB4),
  // so a heading without a full stop never runs into the paragraph after it.
  let gap: Gap = 'none'
  let lastBlock: Element | null = null

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== Node.ELEMENT_NODE || !skip(n as Element)) return NodeFilter.FILTER_ACCEPT
      // Keep words on either side of a removed element from fusing together.
      if (gap === 'none') gap = 'space'
      return NodeFilter.FILTER_REJECT
    },
  })

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType !== Node.TEXT_NODE) {
      if ((n as Element).localName === 'br') gap = 'break'
      continue
    }
    const data = (n as Text).data
    let ni = -1
    for (let i = 0; i < data.length; i++) {
      if (isCollapsible(data.charCodeAt(i))) {
        if (gap === 'none') gap = 'space'
        continue
      }
      if (ni < 0) {
        // Whitespace-only nodes between blocks never get here, so they cannot fake a block change.
        const block = blockOf(n, root)
        if (block !== lastBlock) {
          if (lastBlock) gap = 'break'
          lastBlock = block
        }
        ni = nodes.push(n as Text) - 1
      }
      if (index.length && gap !== 'none') {
        parts.push(gap === 'break' ? '\n' : ' ')
        index.push(-1)
        offset.push(-1)
      }
      gap = 'none'
      if (nodeStart.length === ni) nodeStart.push(index.length)
      parts.push(data[i] as string)
      index.push(ni)
      offset.push(i)
    }
  }

  return {
    text: parts.join(''),
    nodes,
    nodeIndex: Int32Array.from(index),
    nodeOffset: Int32Array.from(offset),
    nodeStart,
  }
}

// Returns null when the slice has no mapped characters or the DOM changed under the map.
export const rangeFor = (map: TextMap, start: number, end: number): Range | null => {
  const { nodeIndex: idx, nodeOffset: off, nodes } = map
  let s = Math.max(start, 0)
  let e = Math.min(end, idx.length) - 1
  while (s <= e && (idx[s] as number) < 0) s++
  while (e >= s && (idx[e] as number) < 0) e--
  if (s > e) return null
  const a = nodes[idx[s] as number] as Text
  const b = nodes[idx[e] as number] as Text
  try {
    const range = a.ownerDocument.createRange()
    range.setStart(a, off[s] as number)
    range.setEnd(b, (off[e] as number) + 1)
    return range
  } catch {
    return null
  }
}

// Maps a DOM boundary point (from a click or selection) to the first text index at or after it.
// Returns -1 when the point is outside the document the map was built from.
export const indexAt = (map: TextMap, container: Node, offset: number): number => {
  const { nodes, nodeStart, nodeIndex, nodeOffset, text } = map
  const ni = container.nodeType === Node.TEXT_NODE ? nodes.indexOf(container as Text) : -1
  if (ni >= 0) {
    const end = nodeStart[ni + 1] ?? text.length
    for (let i = nodeStart[ni] as number; i < end; i++) {
      if (nodeIndex[i] === ni && (nodeOffset[i] as number) >= offset) return i
    }
    return end
  }
  try {
    const point = (container.ownerDocument ?? (container as Document)).createRange()
    point.setStart(container, offset)
    let lo = 0
    let hi = nodes.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (point.comparePoint(nodes[mid] as Text, 0) < 0) lo = mid + 1
      else hi = mid
    }
    return lo < nodes.length ? (nodeStart[lo] as number) : text.length
  } catch {
    return -1
  }
}
