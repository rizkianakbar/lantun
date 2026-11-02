import { createStyle } from "../lib/dom";
import { readJson, writeJson } from "../lib/storage";
import { createStore } from "../lib/store";
import { ALL_AX_CLASSES, AX_DEFAULTS, AX_STORAGE_KEY, AX_STYLE_ID, MORPH_CLASS } from "./a11y.constants";
import { axClasses, profileSettings, sanitizeAx } from "./a11y.lib";
import { AX_CSS } from "./a11y.styles";
import type { AxController, AxSettings } from "./a11y.types";

export function loadAx(): AxSettings {
  return sanitizeAx(readJson(AX_STORAGE_KEY));
}

function ensureStyle(doc: Document, nonce: string | null): HTMLStyleElement {
  const existing = doc.getElementById(AX_STYLE_ID);

  if (existing instanceof HTMLStyleElement) return existing;

  const style = createStyle(doc, AX_CSS, nonce, AX_STYLE_ID);

  (doc.head ?? doc.documentElement).append(style);

  return style;
}

function applyClasses(doc: Document, s: AxSettings): void {
  const wanted = new Set(axClasses(s));
  const list = doc.documentElement.classList;

  // Only our known classes: a host site's own "ax-*" classes are left alone.
  for (const c of ALL_AX_CLASSES) list.toggle(c, wanted.has(c));
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Synchronous, so returning readers get their settings before first paint when loaded in <head>.
export function applySavedAx(doc: Document, nonce: string | null = null): void {
  const s = loadAx();

  if (!axClasses(s).length) return;

  ensureStyle(doc, nonce);
  applyClasses(doc, s);
}

export function createAx(doc: Document, nonce: string | null = null): AxController {
  const store = createStore<AxSettings>(loadAx());
  const style = ensureStyle(doc, nonce);
  const root = doc.documentElement;
  // Videos we paused for "pause animations", resumed when it is turned off again.
  const paused = new Set<HTMLVideoElement>();
  let morphing = 0;
  let alive = true;
  let last = store.get();

  function pauseVideos(): void {
    for (const v of Array.from(doc.querySelectorAll("video"))) {
      if (!v.paused) {
        v.pause();
        paused.add(v);
      }
    }
  }

  function resumeVideos(): void {
    for (const v of paused) v.play().catch(() => {});
    paused.clear();
  }

  // Catches autoplaying videos that start after the setting was turned on.
  function onPlay(e: Event): void {
    if (!store.get().still || !(e.target instanceof HTMLVideoElement)) return;

    e.target.pause();
    paused.add(e.target);
  }

  // Crossfades between looks with a View Transition instead of a hard cut, unless motion is unwanted.
  function morph(s: AxSettings, calm: boolean): void {
    function change(): void {
      if (alive) applyClasses(doc, s);
    }

    if (
      calm ||
      prefersReducedMotion() ||
      doc.visibilityState !== "visible" ||
      typeof doc.startViewTransition !== "function"
    ) {
      change();
      return;
    }

    function done(): void {
      if (--morphing === 0) root.classList.remove(MORPH_CLASS);
    }

    root.classList.add(MORPH_CLASS);
    morphing++;

    try {
      doc.startViewTransition(change).finished.then(done, done);
    } catch {
      done();
      change();
    }
  }

  doc.addEventListener("play", onPlay, true);
  applyClasses(doc, last);
  if (last.still) pauseVideos();

  const unsubscribe = store.subscribe((s) => {
    morph(s, s.still || last.still);

    if (s.still !== last.still) {
      if (s.still) pauseVideos();
      else resumeVideos();
    }

    last = s;
    writeJson(AX_STORAGE_KEY, s);
  });

  return {
    store,

    update(patch) {
      // Guide and mask are mutually exclusive: both at once leave nothing readable.
      const next = { ...patch };

      if (patch.guide) next.mask = false;
      if (patch.mask) next.guide = false;

      store.set(next);
    },

    toggleProfile(id, active) {
      store.set(active ? { ...AX_DEFAULTS } : profileSettings(id));
    },

    reset() {
      store.set({ ...AX_DEFAULTS });
    },

    destroy() {
      alive = false;
      unsubscribe();
      doc.removeEventListener("play", onPlay, true);
      resumeVideos();
      root.classList.remove(...ALL_AX_CLASSES, MORPH_CLASS);
      style.remove();
    },
  };
}
