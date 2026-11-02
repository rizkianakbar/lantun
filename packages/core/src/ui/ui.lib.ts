import { contrast, type RGB } from "../lib/color";
import type { Reader, ReaderState } from "../reader/reader.types";
import type { EngineStatus, Voice } from "../speech/speech.types";
import type { ChevronDir } from "./icons";
import { EDGE, SNAP, SURFACE } from "./ui.constants";
import { fmt, type Strings } from "./ui.i18n";
import type { Box, DockPlace, Edge, Orientation, Spot } from "./ui.types";

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi));
}

export function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

// The dock's untransformed box: we set its left/top ourselves (placeDock).
export function layoutBox(el: HTMLElement): Box {
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);

  if (Number.isFinite(left) && Number.isFinite(top)) return box(left, top, el.offsetWidth, el.offsetHeight);

  const r = el.getBoundingClientRect();

  return box(r.left, r.top, r.width, r.height);
}

// A control's box inside the dock, from layout offsets (the dock is its offset parent).
export function offsetIn(el: HTMLElement, dock: Box): Box {
  return box(dock.left + el.offsetLeft, dock.top + el.offsetTop, el.offsetWidth, el.offsetHeight);
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The visible area, without classic scrollbars: window.innerWidth includes them, so a dock placed
// by it sits under the page scrollbar. jsdom reports 0 client sizes, hence the fallback.
export function viewport(): { width: number; height: number } {
  const root = document.documentElement;

  return { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight };
}

// Centre at (x, y) as viewport fractions, kept fully on screen whatever the dock's size.
export function placeDock(el: HTMLElement, x: number, y: number): void {
  const { width: vw, height: vh } = viewport();
  const w = el.offsetWidth;
  const h = el.offsetHeight;

  el.style.left = `${Math.round(clamp(x * vw - w / 2, EDGE, vw - EDGE - w))}px`;
  el.style.top = `${Math.round(clamp(y * vh - h / 2, EDGE, vh - EDGE - h))}px`;
}

// Near a side the dock snaps flush: upright on the left/right edge, flat on the top/bottom one.
export function dropDock(cx: number, cy: number, o: Orientation, vw: number, vh: number): DockPlace {
  const x = clamp(cx / vw, 0, 1);
  const y = clamp(cy / vh, 0, 1);

  if (cx < SNAP) return { x: 0, y, o: "v" };
  if (cx > vw - SNAP) return { x: 1, y, o: "v" };
  if (cy < SNAP) return { x, y: 0, o: "h" };
  if (cy > vh - SNAP) return { x, y: 1, o: "h" };

  return { x, y, o };
}

export function edgeOf(place: DockPlace): Edge {
  if (place.o === "h") return place.y < 0.5 ? "top" : "bottom";

  return place.x < 0.5 ? "left" : "right";
}

// The hide chevron points at the edge the dock tucks into.
export function hideDir(place: DockPlace): ChevronDir {
  if (place.o === "h") return place.y < 0.5 ? "up" : "down";

  return place.x < 0.5 ? "left" : "right";
}

// Arrow/Home/End navigation for role=radiogroup with a roving tabindex.
export function radioKeys(e: KeyboardEvent, count: number, current: number, select: (i: number) => void): void {
  let next = -1;

  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % count;
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + count) % count;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = count - 1;

  if (next < 0) return;

  // Keep the dock's own arrow-key shortcuts from also firing.
  e.preventDefault();
  e.stopPropagation();
  select(next);
  (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}

function lighten(c: RGB): RGB {
  return c.map((v) => Math.round(v + (255 - v) * 0.15)) as RGB;
}

// Very dark brand colours are lifted toward white until they read on the widget's surface.
export function uiAccent(brand: RGB): RGB {
  let c = brand;

  for (let i = 0; i < 10 && contrast(c, SURFACE) < 3; i++) c = lighten(c);

  return c;
}

export function canListen(reader: Reader | null, state: ReaderState): boolean {
  return !!reader && state.issue !== "unsupported" && state.issue !== "no-content";
}

export function leaveAttr(leaving: boolean): "" | undefined {
  return leaving ? "" : undefined;
}

export function megabytes(bytes: number): number {
  return Math.round(bytes / 1e6);
}

export function hdDetail(v: Voice, status: EngineStatus | null, t: Strings): string {
  if (status?.state === "loading") return fmt(t.hdLoading, { p: Math.round(status.progress * 100) });
  if (status?.state === "error") return t.hdUnavailable;
  if (status?.state === "ready" || !v.downloadBytes) return t.hdReady;

  return fmt(t.hdSize, { mb: megabytes(v.downloadBytes) });
}

export function sameSpot(a: Spot | null, b: Spot): boolean {
  return !!a && a.index === b.index && a.x === b.x && a.y === b.y;
}

export function focusIn(root: HTMLElement | null, selector: string): void {
  requestAnimationFrame(() => root?.querySelector<HTMLElement>(selector)?.focus());
}
