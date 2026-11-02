export type RGB = [r: number, g: number, b: number];

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_FN = /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i;

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

function parseHex(hex: string): RGB | null {
  const full = hex.length <= 4 ? Array.from(hex, (c) => c + c).join("") : hex;

  if (full.length === 8 && full.slice(6) === "00") return null;

  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

// Returns null for transparent or unparseable colours. Named colours go through resolveColor().
export function parseColor(input: string): RGB | null {
  const s = input.trim();
  const hex = HEX.exec(s)?.[1];

  if (hex) return parseHex(hex);

  const m = RGB_FN.exec(s);

  if (!m) return null;

  const alpha = m[4];

  if (alpha !== undefined && parseFloat(alpha) === 0) return null;

  return [m[1], m[2], m[3]].map((v) => Math.min(255, Math.round(Number(v)))) as RGB;
}

// Lets the browser parse anything CSS accepts ("rebeccapurple", "hsl(...)").
export function resolveColor(input: string, doc: Document): RGB | null {
  const direct = parseColor(input);

  if (direct || !doc.body) return direct;

  const probe = doc.createElement("span");

  probe.style.color = input;

  if (!probe.style.color) return null;

  doc.body.append(probe);

  try {
    return parseColor(getComputedStyle(probe).color);
  } finally {
    probe.remove();
  }
}

function channel(c: number): number {
  const s = c / 255;

  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);

  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// White reads as the conventional "selected" look, so use it whenever it meets WCAG AA (4.5:1).
export function textOn(bg: RGB): RGB {
  const onWhite = contrast(bg, WHITE);

  return onWhite >= 4.5 || onWhite >= contrast(bg, BLACK) ? WHITE : BLACK;
}

// Effective background behind an element: first non-transparent one up the tree, else white.
export function backgroundOf(el: Element): RGB {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = parseColor(getComputedStyle(n).backgroundColor);

    if (bg) return bg;
  }

  return WHITE;
}

export function isDark(c: RGB): boolean {
  return luminance(c) < 0.18;
}

export function css([r, g, b]: RGB, alpha = 1): string {
  return alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

// The a11y dark/invert filters; pre-applying them makes highlights come out as the brand colour.
export function invert([r, g, b]: RGB): RGB {
  return [255 - r, 255 - g, 255 - b];
}

function clampByte(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

export function hueRotate180([r, g, b]: RGB): RGB {
  return [
    clampByte(-0.574 * r + 1.43 * g + 0.144 * b),
    clampByte(0.426 * r + 0.43 * g + 0.144 * b),
    clampByte(0.426 * r + 1.43 * g - 0.856 * b),
  ];
}

export function smartInvert(c: RGB): RGB {
  return hueRotate180(invert(c));
}
