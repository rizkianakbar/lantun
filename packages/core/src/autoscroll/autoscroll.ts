import { BAND_BOTTOM, BAND_TOP, FIELDS, LISTENER, PAUSE_MS, SCROLL_KEYS, TARGET } from "./autoscroll.constants";
import type { AutoScroll, AutoScrollOptions } from "./autoscroll.types";

// Keys typed into a field, or pressed inside our own (shadow-hosted) UI, are not page scrolling.
function scrollsPage(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;

  return (
    SCROLL_KEYS.has(e.key) && !target?.isContentEditable && !FIELDS.test(target?.tagName ?? "") && !target?.shadowRoot
  );
}

export function createAutoScroll(win: Window, o: AutoScrollOptions = {}): AutoScroll {
  const pauseMs = o.pauseMs ?? PAUSE_MS;
  const doc = win.document;
  let suspendedUntil = 0;

  // Only real user input counts: our own smooth scrolling fires `scroll` events too.
  function suspend(): void {
    suspendedUntil = Date.now() + pauseMs;
  }

  function onKey(e: KeyboardEvent): void {
    if (scrollsPage(e)) suspend();
  }

  // A pointerdown on <html> itself is a click on the page scrollbar.
  function onPointer(e: PointerEvent): void {
    if (e.target === doc.documentElement) suspend();
  }

  function reducedMotion(): boolean {
    return win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  win.addEventListener("wheel", suspend, LISTENER);
  win.addEventListener("touchmove", suspend, LISTENER);
  win.addEventListener("keydown", onKey, LISTENER);
  win.addEventListener("pointerdown", onPointer, LISTENER);

  return {
    follow(range) {
      if (Date.now() < suspendedUntil || doc.hidden || typeof range.getBoundingClientRect !== "function") {
        return;
      }

      const rect = range.getBoundingClientRect();

      if (!rect.height) return;

      const vh = win.innerHeight;
      const top = vh * BAND_TOP;
      const bottom = vh * BAND_BOTTOM;
      const tall = rect.height > bottom - top;
      const outside = rect.top < top || rect.top > bottom || (!tall && rect.bottom > bottom);

      if (!outside) return;

      win.scrollBy({
        top: rect.top - vh * TARGET,
        behavior: reducedMotion() ? "auto" : "smooth",
      });
    },

    destroy() {
      win.removeEventListener("wheel", suspend, LISTENER);
      win.removeEventListener("touchmove", suspend, LISTENER);
      win.removeEventListener("keydown", onKey, LISTENER);
      win.removeEventListener("pointerdown", onPointer, LISTENER);
    },
  };
}
