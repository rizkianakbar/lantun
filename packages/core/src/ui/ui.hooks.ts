import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Store } from "../lib/store";
import type { ReaderState } from "../reader/reader.types";
import { EDGE, GAP } from "./ui.constants";
import {
  clamp,
  flingDock,
  glide,
  layoutBox,
  offsetIn,
  placeDock,
  prefersReducedMotion,
  releaseVelocity,
  rubberBand,
  type Sample,
  takeShift,
  viewport,
} from "./ui.lib";
import type { DockPlace, ElementRef, Orientation, Presence } from "./ui.types";

export function useStore<T extends object>(store: Store<T>): T {
  const [state, setState] = useState(store.get());

  useEffect(() => {
    setState(store.get());

    return store.subscribe(setState);
  }, [store]);

  return state;
}

// Closes a popover or panel on a press outside it. composedPath() sees through our shadow root.
export function useDismiss(open: boolean, inside: ElementRef[], onClose: () => void): void {
  const close = useRef(onClose);

  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    function onDown(e: PointerEvent): void {
      const path = e.composedPath();

      if (!inside.some((r) => r.current && path.includes(r.current))) {
        close.current();
      }
    }

    document.addEventListener("pointerdown", onDown, true);

    return () => document.removeEventListener("pointerdown", onDown, true);
    // `inside` holds stable refs, so only `open` matters.
  }, [open]);
}

// Tracks the pointer's vertical position, at most once per frame.
export function usePointerY(apply: (y: number) => void): void {
  const fn = useRef(apply);

  fn.current = apply;

  useEffect(() => {
    let frame = 0;
    let y = viewport().height / 2;

    function flush(): void {
      frame = 0;
      fn.current(y);
    }

    function onMove(e: PointerEvent): void {
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    }

    fn.current(y);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
}

// Ticks down every second, but never below the time left after the current sentence, so the clock
// does not jump backwards when the next sentence starts.
export function useCountdown(state: ReaderState): number {
  const [now, setNow] = useState(Date.now);
  const since = useRef(Date.now());
  const playing = state.status === "playing";

  useEffect(() => {
    since.current = Date.now();
    setNow(since.current);
  }, [state.remaining, playing]);

  useEffect(() => {
    if (!playing) return;

    const id = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(id);
  }, [playing]);

  if (!playing) return state.remaining;

  // `remaining` is already in seconds at the current rate, so wall-clock time subtracts directly.
  return Math.max(state.remainingAfter, state.remaining - (now - since.current) / 1000);
}

// Re-places the dock on resize and as it grows or shrinks, so it grows around its centre. A new
// spot (a drop, a reset) glides there from wherever the dock is drawn.
export function useDockPlacement(ref: ElementRef, x: number, y: number, deps: unknown[]): void {
  useLayoutEffect(() => {
    const el = ref.current;

    if (!el) return;

    function place(): void {
      if (el && !("drag" in el.dataset)) placeDock(el, x, y);
    }

    // Mid-drag the pointer owns the dock; the drop places it.
    const settled = !("drag" in el.dataset);
    const from = settled && "ready" in el.dataset ? layoutBox(el) : null;
    const shift = settled ? takeShift(el) : { x: 0, y: 0 };

    place();

    if (from) {
      const to = layoutBox(el);

      glide(el, from.left + shift.x - to.left, from.top + shift.y - to.top);
    }

    // Glide only between placements, never from the unplaced (0, 0) of the first frame.
    const ready = requestAnimationFrame(() => {
      el.dataset.ready = "";
    });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(place) : null;

    window.addEventListener("resize", place);
    observer?.observe(el);

    return () => {
      cancelAnimationFrame(ready);
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [x, y, ...deps]);
}

// Places a panel beside a vertical dock or above/below a flat one. It keeps its spot while its
// content changes; only a window resize places it afresh.
export function useAnchor(panel: ElementRef, anchor: ElementRef): void {
  function place(fresh: boolean): void {
    const el = panel.current;
    const a = anchor.current;

    if (!el || !a) return;

    const { width: vw, height: vh } = viewport();
    // Layout boxes, not getBoundingClientRect(): mid-animation the dock is scaled and shifted.
    const dockEl = (a.closest(".dock") ?? a) as HTMLElement;
    const dock = layoutBox(dockEl);
    const r = a === dockEl ? dock : offsetIn(a, dock);
    const flat = dockEl.getAttribute("data-o") === "h";
    const above = dock.top + dock.height / 2 > vh / 2;

    // Beside a flat dock a panel only has the room above (or below) it; it scrolls inside that.
    el.style.maxHeight = flat ? `${Math.round((above ? dock.top : vh - dock.bottom) - GAP - EDGE)}px` : "";

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left: number;
    let top: number;
    let px = 0;
    let py = 0;

    if (flat) {
      left = clamp(r.left + r.width / 2 - w / 2, EDGE, vw - w - EDGE);
      top = above ? dock.top - GAP - h : dock.bottom + GAP;
      py = above ? 10 : -10;
    } else {
      const toLeft = dock.left + dock.width / 2 > vw / 2;
      const prev = Number(el.dataset.top);
      const kept = !fresh && el.dataset.top && Number.isFinite(prev);

      left = toLeft ? dock.left - GAP - w : dock.right + GAP;
      top = kept ? prev : r.top + r.height / 2 - h / 2;
      px = toLeft ? 10 : -10;
    }

    top = Math.round(clamp(top, EDGE, vh - h - EDGE));
    left = Math.round(clamp(left, EDGE, vw - w - EDGE));
    el.dataset.top = String(top);
    el.style.setProperty("--top", `${top}px`);
    el.style.setProperty("--left", `${left}px`);
    el.style.setProperty("--px", `${px}px`);
    el.style.setProperty("--py", `${py}px`);
    // Grow out of the button that opened it: the edge facing the dock, level with that button.
    const ox = flat ? `${Math.round(r.left + r.width / 2 - left)}px` : px > 0 ? "100%" : "0%";
    const oy = flat ? (py > 0 ? "100%" : "0%") : `${Math.round(r.top + r.height / 2 - top)}px`;

    el.style.setProperty("--origin", `${ox} ${oy}`);
  }

  // Every render: content may have changed size.
  useLayoutEffect(() => place(false));

  // Once: the refs are stable, so one listener serves every render.
  useLayoutEffect(() => {
    function onResize(): void {
      place(true);
    }

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);
}

// The dock follows the pointer on the compositor (translate, no layout), rubber-bands past the
// edges, and keeps a flick's momentum: the drop lands where the throw would carry it. The drop is
// committed once, so dragging never re-renders.
export function useDrag(
  target: ElementRef,
  o: Orientation,
  onStart: () => void,
  onEnd: (drop: DockPlace) => void,
): (e: PointerEvent) => void {
  const latest = useRef({ onStart, onEnd, o });

  latest.current = { onStart, onEnd, o };

  return function startDrag(e: PointerEvent): void {
    const el = target.current;

    // One pointer at a time: a second finger mid-drag would make the dock jump to it.
    if (!el || e.button !== 0 || "drag" in el.dataset) return;

    e.preventDefault();

    const handle = e.currentTarget as HTMLElement;
    // A grab mid-glide continues from where the dock is drawn, not from where it was heading.
    const shift = takeShift(el);
    const box = layoutBox(el);
    const left0 = box.left;
    const top0 = box.top;
    const { width: vw, height: vh } = viewport();
    let cx = left0 + shift.x + box.width / 2;
    let cy = top0 + shift.y + box.height / 2;
    // Keep the grab point under the pointer instead of jumping the dock's centre to it.
    const dx = cx - e.clientX;
    const dy = cy - e.clientY;
    const samples: Sample[] = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];

    function draw(): void {
      const left = rubberBand(cx - box.width / 2, EDGE, vw - EDGE - box.width);
      const top = rubberBand(cy - box.height / 2, EDGE, vh - EDGE - box.height);

      (el as HTMLElement).style.translate = `${left - left0}px ${top - top0}px`;
    }

    function move(ev: PointerEvent): void {
      cx = ev.clientX + dx;
      cy = ev.clientY + dy;
      samples.push({ t: ev.timeStamp, x: ev.clientX, y: ev.clientY });
      if (samples.length > 8) samples.shift();
      draw();
    }

    function up(ev: PointerEvent): void {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      delete (el as HTMLElement).dataset.drag;

      const v = ev.type === "pointerup" ? releaseVelocity(samples, ev.timeStamp) : { vx: 0, vy: 0 };
      const { width, height } = viewport();

      latest.current.onEnd(flingDock(cx, cy, v, latest.current.o, width, height));

      // A drop on the spot it started from changes no props, so nothing re-places it: settle here.
      requestAnimationFrame(() => {
        if (!el || "drag" in el.dataset || !el.style.translate) return;

        const rest = takeShift(el);

        glide(el, rest.x, rest.y);
      });
    }

    handle.setPointerCapture?.(e.pointerId);
    el.dataset.drag = "";
    el.style.translate = `${shift.x}px ${shift.y}px`;
    latest.current.onStart();
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };
}

// Phones get the dock flat along the bottom, where thumbs reach and it covers no text.
export function useNarrow(): boolean {
  const [query] = useState(() => (typeof matchMedia === "function" ? matchMedia("(max-width: 540px)") : null));
  const [narrow, setNarrow] = useState(query?.matches ?? false);

  useEffect(() => {
    if (!query) return;

    function onChange(): void {
      setNarrow((query as MediaQueryList).matches);
    }

    query.addEventListener?.("change", onChange);

    return () => query.removeEventListener?.("change", onChange);
  }, [query]);

  return narrow;
}

// Keeps something mounted for its exit animation; with reduced motion it unmounts at once.
export function usePresence<T>(value: T | null | false, ms: number, still = false): Presence<T> {
  const live = value || null;
  const [kept, setKept] = useState<T | null>(live);

  useEffect(() => {
    if (live !== null) {
      setKept(live);
      return;
    }

    if (still || prefersReducedMotion()) {
      setKept(null);
      return;
    }

    const id = setTimeout(() => setKept(null), ms);

    return () => clearTimeout(id);
  }, [live]);

  return { shown: live ?? kept, leaving: live === null && kept !== null };
}
