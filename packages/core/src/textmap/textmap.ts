// One flat string for the segmenter, with a per-character map back to the DOM for Ranges.
export interface TextMap {
  text: string;
  nodes: Text[];
  // Per character of `text`: index into `nodes`, or -1 for separators the map inserted.
  nodeIndex: Int32Array;
  // Per character of `text`: offset inside its Text node (meaningless when nodeIndex is -1).
  nodeOffset: Int32Array;
  // Index in `text` of each node's first character.
  nodeStart: number[];
}

const BLOCKS = new Set(
  (
    "address article aside blockquote dd details div dl dt fieldset figcaption figure footer " +
    "form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td " +
    "tfoot th thead tr ul"
  ).split(" "),
);

type Gap = "none" | "space" | "break";

// Tag names rather than computed style: no layout cost, and it behaves the same in jsdom.
function blockOf(node: Node, root: Element): Element {
  for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
    if (BLOCKS.has(el.localName)) return el;
  }

  return root;
}

// Space, newline, tab, carriage return, form feed.
function isCollapsible(c: number): boolean {
  return c === 32 || c === 10 || c === 9 || c === 13 || c === 12;
}

function never(): boolean {
  return false;
}

export function buildTextMap(root: Element, skip: (el: Element) => boolean = never): TextMap {
  let text = "";
  const nodes: Text[] = [];
  const nodeStart: number[] = [];
  const index: number[] = [];
  const offset: number[] = [];
  // A newline between blocks is a hard sentence break for Intl.Segmenter (UAX #29 SB4),
  // so a heading without a full stop never runs into the paragraph after it.
  let gap: Gap = "none";
  let lastBlock: Element | null = null;

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType !== Node.ELEMENT_NODE || !skip(n as Element)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      // Keep words on either side of a removed element from fusing together.
      if (gap === "none") gap = "space";

      return NodeFilter.FILTER_REJECT;
    },
  });

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType !== Node.TEXT_NODE) {
      if ((n as Element).localName === "br") gap = "break";
      continue;
    }

    const data = (n as Text).data;
    let ni = -1;

    for (let i = 0; i < data.length; i++) {
      if (isCollapsible(data.charCodeAt(i))) {
        if (gap === "none") gap = "space";
        continue;
      }

      if (ni < 0) {
        // Whitespace-only nodes between blocks never get here, so they cannot fake a block change.
        const block = blockOf(n, root);

        if (block !== lastBlock) {
          if (lastBlock) gap = "break";
          lastBlock = block;
        }

        ni = nodes.push(n as Text) - 1;
      }

      if (index.length && gap !== "none") {
        text += gap === "break" ? "\n" : " ";
        index.push(-1);
        offset.push(-1);
      }

      gap = "none";
      if (nodeStart.length === ni) nodeStart.push(index.length);
      text += data[i];
      index.push(ni);
      offset.push(i);
    }
  }

  return {
    text,
    nodes,
    nodeIndex: Int32Array.from(index),
    nodeOffset: Int32Array.from(offset),
    nodeStart,
  };
}

// Returns null when the slice has no mapped characters or the DOM changed under the map.
export function rangeFor(map: TextMap, start: number, end: number): Range | null {
  const { nodeIndex: idx, nodeOffset: off, nodes } = map;
  let s = Math.max(start, 0);
  let e = Math.min(end, idx.length) - 1;

  while (s <= e && (idx[s] as number) < 0) s++;
  while (e >= s && (idx[e] as number) < 0) e--;

  if (s > e) return null;

  const a = nodes[idx[s] as number] as Text;
  const b = nodes[idx[e] as number] as Text;

  try {
    const range = a.ownerDocument.createRange();

    range.setStart(a, off[s] as number);
    range.setEnd(b, (off[e] as number) + 1);

    return range;
  } catch {
    return null;
  }
}

// Built on first use: indexAt runs on every mouse-move frame for "play from here".
const nodeLookups = new WeakMap<TextMap, Map<Text, number>>();

function indexOfNode(map: TextMap, node: Text): number {
  let lookup = nodeLookups.get(map);

  if (!lookup) {
    lookup = new Map(map.nodes.map((n, i) => [n, i]));
    nodeLookups.set(map, lookup);
  }

  return lookup.get(node) ?? -1;
}

// Maps a DOM boundary point (from a click or selection) to the first text index at or after it.
// Returns -1 when the point is outside the document the map was built from.
export function indexAt(map: TextMap, container: Node, offset: number): number {
  const { nodes, nodeStart, nodeIndex, nodeOffset, text } = map;
  const ni = container.nodeType === Node.TEXT_NODE ? indexOfNode(map, container as Text) : -1;

  if (ni >= 0) {
    const end = nodeStart[ni + 1] ?? text.length;

    for (let i = nodeStart[ni] as number; i < end; i++) {
      if (nodeIndex[i] === ni && (nodeOffset[i] as number) >= offset) return i;
    }

    return end;
  }

  try {
    const point = (container.ownerDocument ?? (container as Document)).createRange();
    let lo = 0;
    let hi = nodes.length;

    point.setStart(container, offset);

    while (lo < hi) {
      const mid = (lo + hi) >> 1;

      if (point.comparePoint(nodes[mid] as Text, 0) < 0) lo = mid + 1;
      else hi = mid;
    }

    return lo < nodes.length ? (nodeStart[lo] as number) : text.length;
  } catch {
    return -1;
  }
}
