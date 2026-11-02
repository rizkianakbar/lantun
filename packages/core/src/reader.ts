import { createReadingView, type ReadingView } from "./highlight/view";
import { withWordTiming } from "./highlight/word-timing";
import { debug } from "./log";
import { prepare, type Prepared } from "./prepare";
import { sentenceIndexAt } from "./segment/segment";

import { createMixedDriver } from "./speech/mixed";
import { createPlayer } from "./speech/player";
import { clampRate } from "./speech/player.lib";
import type {
  Player,
  PlayerEmit,
  PlayerStatus,
  SentenceEvent,
  WordEvent,
} from "./speech/player.types";
import type {
  EngineStatus,
  SpeechDriver,
  Voice,
  VoiceEngine,
} from "./speech/types";
import { listVoices, pickVoice, primaryLang } from "./speech/voices";
import {
  createWebSpeechDriver,
  isWebSpeechSupported,
} from "./speech/webspeech";
import {
  articleKey,
  clearPosition,
  findSavedPosition,
  savePosition,
} from "./state/positions";
import {
  loadSettings,
  saveSettings,
  type ReaderSettings,
} from "./state/settings";
import { createStore, type Store } from "./state/store";
import { indexAt, rangeFor } from "./textmap/textmap";
import type { ReaderEvent, ResolvedOptions } from "./types";

export type ReaderIssue = "unsupported" | "no-content" | "not-allowed" | null;

// An add-on voice the reader picked could not be used, and a built-in voice took over.
export interface VoiceFallback {
  reason: "slow" | "failed";
  voice: Voice | null;
}

export interface ReaderState {
  status: PlayerStatus;
  index: number;
  total: number;
  // 0–1 by characters read, at the start of the current sentence.
  progress: number;
  // Seconds, at the current rate.
  duration: number;
  remaining: number;
  // Time left once the current sentence is done; lower bound for the live countdown.
  remainingAfter: number;
  rate: number;
  voices: Voice[];
  voice: Voice | null;
  voicesLoaded: boolean;
  // Offered "continue from" position, cleared once playback starts.
  resume: { index: number; progress: number } | null;
  issue: ReaderIssue;
  // Status of the add-on engine behind the selected voice; null for built-in voices.
  engine: EngineStatus | null;
  fallback: VoiceFallback | null;
}

export interface SentenceHit {
  index: number;
  rect: DOMRect;
}

export interface Reader {
  store: Store<ReaderState>;
  play(from?: number): void;
  pause(): void;
  toggle(): void;
  next(): void;
  prev(): void;
  seek(index: number): void;
  // Seek by fraction of the article (0–1), measured in characters like `progress`.
  seekTo(fraction: number): void;
  setRate(rate: number): void;
  setVoice(id: string): void;
  addEngine(engine: VoiceEngine): void;
  // For "play from here": the sentence under a viewport point, with its first line box.
  sentenceAtPoint(x: number, y: number): SentenceHit | null;
  // Sentence where the reader's text selection starts, if it is inside the article.
  selectionSentence(): number | null;
  destroy(): void;
}

export interface ReaderDeps {
  doc?: Document;
  win?: Window;
  // null forces the "unsupported" path; omitted picks Web Speech when available.
  driver?: SpeechDriver | null;
}

// Speaking speed used for time estimates at 1x; close to measured rates for id/en voices.
const CHARS_PER_SECOND = 15;

export const createReader = (
  opts: ResolvedOptions,
  emit: (event: ReaderEvent, payload: unknown) => void,
  deps: ReaderDeps = {},
): Reader => {
  const doc = deps.doc ?? document;
  const win = deps.win ?? window;
  const raw =
    deps.driver !== undefined
      ? deps.driver
      : isWebSpeechSupported(win)
        ? createWebSpeechDriver(win)
        : null;
  // Only browser voices need estimated word timing; add-on engines report their own.
  const mixed = createMixedDriver(
    raw &&
      withWordTiming(raw, {
        onFallback: (voice, lang) =>
          debug(
            `Voice "${voice?.name ?? `default for ${lang}`}" fires no word boundaries; estimating word timing.`,
          ),
      }),
  );
  const driver = mixed;
  const engines = new Map<string, VoiceEngine>();
  const unsubscribers: (() => void)[] = [];
  const canSpeak = (): boolean => raw !== null || engines.size > 0;

  const lang = primaryLang(opts.lang) || "en";
  // Recomputed with each extraction: a client-side navigation brings a new article and URL.
  let key = articleKey(win.location);
  const settings: ReaderSettings = loadSettings();

  const store = createStore<ReaderState>({
    status: "idle",
    index: 0,
    total: 0,
    progress: 0,
    duration: 0,
    remaining: 0,
    remainingAfter: 0,
    rate: settings.rate,
    voices: [],
    voice: null,
    voicesLoaded: !canSpeak(),
    resume: null,
    issue: canSpeak() ? null : "unsupported",
    engine: null,
    fallback: null,
  });

  let prepared: Prepared | null = null;
  // Characters before each sentence, for progress and time left.
  let charsBefore: number[] = [];
  let totalChars = 0;
  let player: Player | null = null;
  let view: ReadingView | null = null;
  let destroyed = false;
  // The selection a play() already started from: a selection left on the page must not keep
  // pulling playback back to it on every later play.
  let usedSelection = "";

  const sentenceText = (i: number): string => {
    const s = prepared?.sentences[i];
    return s && prepared ? prepared.map.text.slice(s.start, s.end) : "";
  };

  const timing = (
    index: number,
    rate: number,
  ): Pick<
    ReaderState,
    "progress" | "duration" | "remaining" | "remainingAfter"
  > => {
    const done = charsBefore[index] ?? totalChars;
    const after = charsBefore[index + 1] ?? totalChars;
    const perSecond = CHARS_PER_SECOND * rate;
    return {
      progress: totalChars ? done / totalChars : 0,
      duration: totalChars / perSecond,
      remaining: (totalChars - done) / perSecond,
      remainingAfter: (totalChars - after) / perSecond,
    };
  };

  const teardownPlayback = (): void => {
    player?.destroy();
    player = null;
    view?.destroy();
    view = null;
  };

  // Extraction is cheap (a few ms) but the article can be replaced by client-side navigation,
  // so the cached result is only reused while its DOM is still attached.
  const ensurePrepared = (): Prepared | null => {
    if (
      prepared?.root.isConnected &&
      prepared.map.nodes[0]?.isConnected !== false
    )
      return prepared;
    teardownPlayback();
    key = articleKey(win.location);
    prepared = prepare(doc, opts);
    const sentences = prepared?.sentences ?? [];
    let acc = 0;
    charsBefore = sentences.map((s) => {
      const before = acc;
      acc += s.end - s.start;
      return before;
    });
    totalChars = acc;
    const saved = findSavedPosition(key, sentenceText, sentences.length);
    store.set({
      total: sentences.length,
      index: 0,
      ...timing(0, store.get().rate),
      resume:
        saved && saved > 0 && saved < sentences.length - 1
          ? { index: saved, progress: timing(saved, 1).progress }
          : null,
      issue: canSpeak()
        ? sentences.length
          ? null
          : "no-content"
        : "unsupported",
    });
    return prepared;
  };

  const onPlayerEvent: PlayerEmit = (type, payload) => {
    if (destroyed) return;
    switch (type) {
      case "state": {
        const status = payload as PlayerStatus;
        store.set({
          status,
          ...(status === "playing" ? { issue: null, resume: null } : {}),
        });
        return;
      }
      case "sentence": {
        const s = payload as SentenceEvent;
        view?.sentence(s.start, s.end);
        store.set({ index: s.index, ...timing(s.index, store.get().rate) });
        savePosition(key, s.index, store.get().total, s.text);
        break;
      }
      case "word": {
        const w = payload as WordEvent;
        view?.word(w.start, w.end);
        break;
      }
      case "end":
        view?.clear();
        clearPosition(key);
        store.set({ index: 0, ...timing(0, store.get().rate) });
        break;
      case "error":
        if ((payload as { code: string }).code === "not-allowed")
          store.set({ issue: "not-allowed" });
        break;
    }
    emit(type, payload);
  };

  const ensurePlayer = (): Player | null => {
    const p = ensurePrepared();
    if (!canSpeak() || !p?.sentences.length) return null;
    if (player) return player;
    view = createReadingView({
      doc,
      win,
      map: p.map,
      root: p.root,
      color: opts.color,
      zIndex: opts.zIndex,
      nonce: opts.nonce,
    });
    player = createPlayer({
      driver,
      text: p.map.text,
      sentences: p.sentences,
      lang: opts.lang,
      rate: store.get().rate,
      voice: store.get().voice,
      emit: onPlayerEvent,
    });
    return player;
  };

  const engineStatus = (voice: Voice | null): EngineStatus | null =>
    voice?.engine ? (engines.get(voice.engine)?.status() ?? null) : null;

  const useVoice = (voice: Voice | null): void => {
    store.set({ voice, engine: engineStatus(voice) });
    player?.setVoice(voice);
    warmUp();
  };

  // An add-on voice needs its model loaded and the first sentence synthesised before it can speak.
  // Starting that as soon as the voice is chosen, not on play, makes the first press near-instant.
  const warmUp = (): void => {
    const { voice, status, resume, index, rate } = store.get();
    if (!voice?.engine || status === "playing") return;
    const p = ensurePrepared();
    const s = p?.sentences[resume?.index ?? index];
    if (p && s)
      driver.prepare?.({
        text: p.map.text.slice(s.start, s.end),
        lang: opts.lang,
        rate,
        voice,
      });
  };

  // Voices load in the background; the player starts with the browser default for the language
  // and switches once the best match is known (normally long before the first click). Runs again
  // whenever an add-on engine registers.
  const loadVoices = (): void => {
    void driver.getVoices().then(
      (all) => {
        if (destroyed) return;
        const voices = listVoices(all, opts.lang);
        const current = store.get().voice;
        const voice =
          (current && voices.find((v) => v.id === current.id)) ??
          pickVoice(voices, opts.lang, settings.voices[lang]);
        store.set({ voices, voicesLoaded: true });
        if (voice?.id !== current?.id || !current) useVoice(voice);
      },
      () => store.set({ voicesLoaded: true }),
    );
  };
  if (raw) loadVoices();

  // The engine behind the chosen voice cannot keep up or failed to load: hand over to the best
  // built-in voice so reading carries on, and forget the choice so the next visit starts there.
  const onEngineStatus = (engine: VoiceEngine, status: EngineStatus): void => {
    const voice = store.get().voice;
    if (destroyed || voice?.engine !== engine.id) return;
    if (status.state !== "error") {
      store.set({ engine: status });
      return;
    }
    const builtIn = pickVoice(
      store.get().voices.filter((v) => !v.engine),
      opts.lang,
    );
    delete settings.voices[lang];
    saveSettings(settings);
    store.set({
      fallback: { reason: status.error ?? "failed", voice: builtIn },
    });
    useVoice(builtIn);
  };

  // Chrome keeps speaking after the page unloads; pausing also keeps our place for bfcache.
  const onPageHide = (): void => player?.pause();
  win.addEventListener("pagehide", onPageHide);

  const selectionSentence = (): number | null => {
    const p = prepared ?? ensurePrepared();
    const sel = doc.getSelection();
    if (!p || !sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!p.root.contains(range.startContainer)) return null;
    const i = indexAt(p.map, range.startContainer, range.startOffset);
    return i < 0 ? null : sentenceIndexAt(p.sentences, i);
  };

  const freshSelectionSentence = (): number | undefined => {
    const index = selectionSentence();
    const stamp =
      index === null ? "" : `${index}:${doc.getSelection()?.toString() ?? ""}`;
    if (index === null || stamp === usedSelection) return undefined;
    usedSelection = stamp;
    return index;
  };

  const caretAt = (
    x: number,
    y: number,
  ): { node: Node; offset: number } | null => {
    const d = doc as Document & {
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const pos = d.caretPositionFromPoint?.(x, y);
    if (pos) return { node: pos.offsetNode, offset: pos.offset };
    const range = d.caretRangeFromPoint?.(x, y);
    return range
      ? { node: range.startContainer, offset: range.startOffset }
      : null;
  };

  const reader: Reader = {
    store,
    play(from) {
      if (destroyed) return;
      const p = ensurePlayer();
      if (!p) {
        store.set({ issue: canSpeak() ? "no-content" : "unsupported" });
        if (!canSpeak())
          emit("error", {
            code: "unsupported",
            message: "This browser cannot read text aloud.",
          });
        else
          emit("error", {
            code: "no-content",
            message: "No readable article text found.",
          });
        return;
      }
      // Selecting text then pressing play starts from the selection (spec).
      p.play(
        from ??
          (store.get().status === "playing"
            ? undefined
            : freshSelectionSentence()),
      );
    },
    pause() {
      player?.pause();
    },
    toggle() {
      if (store.get().status === "playing") reader.pause();
      else reader.play();
    },
    next() {
      ensurePlayer()?.next();
    },
    prev() {
      ensurePlayer()?.prev();
    },
    seek(index) {
      ensurePlayer()?.seek(index);
    },
    seekTo(fraction) {
      if (!ensurePrepared()) return;
      const target = Math.min(Math.max(fraction, 0), 1) * totalChars;
      // Last sentence starting at or before the target.
      let lo = 0;
      let hi = charsBefore.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((charsBefore[mid] as number) <= target) lo = mid;
        else hi = mid - 1;
      }
      reader.seek(lo);
    },
    setRate(rate) {
      const next = clampRate(rate);
      player?.setRate(next);
      settings.rate = next;
      saveSettings(settings);
      store.set({ rate: next, ...timing(store.get().index, next) });
    },
    setVoice(id) {
      const voice = store.get().voices.find((v) => v.id === id);
      if (!voice) return;
      settings.voices[lang] = id;
      saveSettings(settings);
      store.set({ fallback: null });
      useVoice(voice);
    },
    addEngine(engine) {
      if (destroyed || engines.has(engine.id)) return;
      const couldSpeak = canSpeak();
      engines.set(engine.id, engine);
      mixed.add(engine);
      unsubscribers.push(
        engine.subscribe((status) => onEngineStatus(engine, status)),
      );
      if (!couldSpeak) {
        store.set({ issue: null });
        schedulePrepare();
      }
      loadVoices();
    },
    sentenceAtPoint(x, y) {
      const p = ensurePrepared();
      const caret = p && caretAt(x, y);
      if (!p || !caret || !p.root.contains(caret.node)) return null;
      const i = indexAt(p.map, caret.node, caret.offset);
      if (i < 0 || i >= p.map.text.length) return null;
      const index = sentenceIndexAt(p.sentences, i);
      const s = p.sentences[index];
      const range = s ? rangeFor(p.map, s.start, s.end) : null;
      const rect =
        typeof range?.getClientRects === "function"
          ? range.getClientRects()[0]
          : undefined;
      return rect ? { index, rect } : null;
    },
    selectionSentence,
    destroy() {
      destroyed = true;
      teardownPlayback();
      unsubscribers.forEach((off) => off());
      win.removeEventListener("pagehide", onPageHide);
    },
  };

  // Prepare once the page is idle so the launcher can show the listening time without
  // competing with the host page's own start-up work.
  function schedulePrepare(): void {
    const idle = (
      win as Window & {
        requestIdleCallback?: (
          cb: () => void,
          o?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    if (idle) idle(() => !destroyed && ensurePrepared(), { timeout: 2000 });
    else setTimeout(() => !destroyed && ensurePrepared(), 200);
  }
  if (canSpeak()) schedulePrepare();

  return reader;
};
