import { createReadingView } from "../highlight/highlight";
import type { ReadingView } from "../highlight/highlight.types";
import { debug } from "../lib/log";
import { createStore } from "../lib/store";
import type { ReaderEvent, ResolvedOptions } from "../options/options.types";
import { createPlayer } from "../player/player";
import { clampRate } from "../player/player.lib";
import type { Player, PlayerEmit, PlayerStatus, SentenceEvent, WordEvent } from "../player/player.types";
import { sentenceIndexAt } from "../segment/segment";
import { createMixedDriver } from "../speech/mixed-driver";
import type { EngineStatus, SpeechErrorInfo, Voice, VoiceEngine } from "../speech/speech.types";
import { withWordTiming } from "../speech/word-timing";
import { indexAt, rangeFor } from "../textmap/textmap";
import { listVoices, pickVoice, primaryLang } from "../voices/voices.lib";
import { CHARS_PER_SECOND, ERRORS } from "./reader.constants";
import { caretAt, defaultDriver, lastAtOrBefore, prepare } from "./reader.lib";
import {
  articleKey,
  clearPosition,
  findSavedPosition,
  loadSettings,
  savePosition,
  saveSettings,
} from "./reader.storage";
import type {
  CaretDocument,
  IdleWindow,
  Prepared,
  Reader,
  ReaderDeps,
  ReaderIssue,
  ReaderState,
  Timing,
} from "./reader.types";

export function createReader(
  opts: ResolvedOptions,
  emit: (event: ReaderEvent, payload: unknown) => void,
  deps: ReaderDeps = {},
): Reader {
  const doc = deps.doc ?? document;
  const win = deps.win ?? window;
  const builtIn = deps.driver !== undefined ? deps.driver : defaultDriver(win);
  // Only browser voices need estimated word timing; add-on engines report their own.
  const driver = createMixedDriver(
    builtIn &&
      withWordTiming(builtIn, {
        onFallback(voice, lang) {
          debug(`Voice "${voice?.name ?? `default for ${lang}`}" fires no word boundaries; estimating word timing.`);
        },
      }),
  );
  const engines = new Map<string, VoiceEngine>();
  const unsubscribers: (() => void)[] = [];
  const lang = primaryLang(opts.lang) || "en";
  const settings = loadSettings();

  // Recomputed with each extraction: a client-side navigation brings a new article and URL.
  let key = articleKey(win.location);
  let prepared: Prepared | null = null;
  // Characters before each sentence, for progress and time left.
  let charsBefore: number[] = [];
  let totalChars = 0;
  let player: Player | null = null;
  let view: ReadingView | null = null;
  let destroyed = false;
  // A selection steers only the first play() after it is made.
  let usedSelection = "";

  function canSpeak(): boolean {
    return builtIn !== null || engines.size > 0;
  }

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

  function sentenceText(i: number): string {
    const s = prepared?.sentences[i];

    return s && prepared ? prepared.map.text.slice(s.start, s.end) : "";
  }

  function timing(index: number, rate: number): Timing {
    const done = charsBefore[index] ?? totalChars;
    const after = charsBefore[index + 1] ?? totalChars;
    const perSecond = CHARS_PER_SECOND * rate;

    return {
      progress: totalChars ? done / totalChars : 0,
      duration: totalChars / perSecond,
      remaining: (totalChars - done) / perSecond,
      remainingAfter: (totalChars - after) / perSecond,
    };
  }

  function issueFor(sentenceCount: number): ReaderIssue {
    if (!canSpeak()) return "unsupported";

    return sentenceCount ? null : "no-content";
  }

  function teardownPlayback(): void {
    player?.destroy();
    player = null;
    view?.destroy();
    view = null;
  }

  // Reused only while its DOM is attached: client-side navigation can replace the article.
  function ensurePrepared(): Prepared | null {
    if (prepared?.root.isConnected && prepared.map.nodes[0]?.isConnected !== false) {
      return prepared;
    }

    teardownPlayback();
    key = articleKey(win.location);
    prepared = prepare(doc, opts);

    const sentences = prepared?.sentences ?? [];

    totalChars = 0;
    charsBefore = sentences.map((s) => {
      const before = totalChars;

      totalChars += s.end - s.start;

      return before;
    });

    const saved = findSavedPosition(key, sentenceText, sentences.length);
    const resumable = saved !== null && saved > 0 && saved < sentences.length - 1;

    store.set({
      total: sentences.length,
      index: 0,
      ...timing(0, store.get().rate),
      resume: resumable ? { index: saved, progress: timing(saved, 1).progress } : null,
      issue: issueFor(sentences.length),
    });

    return prepared;
  }

  const onPlayerEvent: PlayerEmit = function onPlayerEvent(type, payload) {
    if (destroyed) return;

    switch (type) {
      case "state": {
        const status = payload as PlayerStatus;

        store.set(status === "playing" ? { status, issue: null, resume: null } : { status });
        // Internal only: publishers hear about playback through sentence/word/end.
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
        if ((payload as SpeechErrorInfo).code === "not-allowed") {
          store.set({ issue: "not-allowed" });
        }
        break;
    }

    emit(type, payload);
  };

  function ensurePlayer(): Player | null {
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
  }

  function engineStatus(voice: Voice | null): EngineStatus | null {
    return voice?.engine ? (engines.get(voice.engine)?.status() ?? null) : null;
  }

  // Start loading an add-on voice when it is chosen, so the first press of play is near-instant.
  function warmUp(): void {
    const { voice, status, resume, index, rate } = store.get();

    if (!voice?.engine || status === "playing") return;

    const p = ensurePrepared();
    const s = p?.sentences[resume?.index ?? index];

    if (!p || !s) return;

    driver.prepare?.({
      text: p.map.text.slice(s.start, s.end),
      lang: opts.lang,
      rate,
      voice,
    });
  }

  function useVoice(voice: Voice | null): void {
    store.set({ voice, engine: engineStatus(voice) });
    player?.setVoice(voice);
    warmUp();
  }

  // Runs at start and whenever an add-on engine registers; keeps the current voice if still listed.
  function loadVoices(): void {
    driver.getVoices().then(
      (all) => {
        if (destroyed) return;

        const voices = listVoices(all, opts.lang);
        const current = store.get().voice;
        const voice =
          (current && voices.find((v) => v.id === current.id)) ?? pickVoice(voices, opts.lang, settings.voices[lang]);

        store.set({ voices, voicesLoaded: true });
        if (!current || voice?.id !== current.id) useVoice(voice);
      },
      () => store.set({ voicesLoaded: true }),
    );
  }

  // The chosen engine is too slow or failed: hand over to the best built-in voice and forget the choice.
  function onEngineStatus(engine: VoiceEngine, status: EngineStatus): void {
    if (destroyed || store.get().voice?.engine !== engine.id) return;

    if (status.state !== "error") {
      store.set({ engine: status });
      return;
    }

    const fallback = pickVoice(
      store.get().voices.filter((v) => !v.engine),
      opts.lang,
    );

    delete settings.voices[lang];
    saveSettings(settings);
    store.set({
      fallback: { reason: status.error ?? "failed", voice: fallback },
    });
    useVoice(fallback);
  }

  // Chrome keeps speaking after the page unloads; pausing also keeps our place for bfcache.
  function onPageHide(): void {
    player?.pause();
  }

  function selectionSentence(): number | null {
    const p = prepared ?? ensurePrepared();
    const selection = doc.getSelection();

    if (!p || !selection || selection.isCollapsed || !selection.rangeCount) {
      return null;
    }

    const range = selection.getRangeAt(0);

    if (!p.root.contains(range.startContainer)) return null;

    const i = indexAt(p.map, range.startContainer, range.startOffset);

    return i < 0 ? null : sentenceIndexAt(p.sentences, i);
  }

  function freshSelectionSentence(): number | undefined {
    const index = selectionSentence();

    if (index === null) return undefined;

    const stamp = `${index}:${doc.getSelection()?.toString() ?? ""}`;

    if (stamp === usedSelection) return undefined;

    usedSelection = stamp;

    return index;
  }

  // In idle time, so the listening time shows without competing with the page's own start-up.
  function schedulePrepare(): void {
    function run(): void {
      if (!destroyed) ensurePrepared();
    }

    const idle = (win as IdleWindow).requestIdleCallback;

    if (idle) idle.call(win, run, { timeout: 2000 });
    else setTimeout(run, 200);
  }

  const reader: Reader = {
    store,

    play(from) {
      if (destroyed) return;

      const p = ensurePlayer();

      if (!p) {
        const issue = canSpeak() ? "no-content" : "unsupported";

        store.set({ issue });
        emit("error", ERRORS[issue]);
        return;
      }

      const start = from ?? (store.get().status === "playing" ? undefined : freshSelectionSentence());

      p.play(start);
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

      reader.seek(lastAtOrBefore(charsBefore, target));
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
      driver.add(engine);
      unsubscribers.push(engine.subscribe((status) => onEngineStatus(engine, status)));

      if (!couldSpeak) {
        store.set({ issue: null });
        schedulePrepare();
      }

      loadVoices();
    },

    sentenceAtPoint(x, y) {
      const p = ensurePrepared();
      const caret = p && caretAt(doc as CaretDocument, x, y);

      if (!p || !caret || !p.root.contains(caret.node)) return null;

      const i = indexAt(p.map, caret.node, caret.offset);

      if (i < 0 || i >= p.map.text.length) return null;

      const index = sentenceIndexAt(p.sentences, i);
      const s = p.sentences[index];
      const range = s ? rangeFor(p.map, s.start, s.end) : null;
      const rect = typeof range?.getClientRects === "function" ? range.getClientRects()[0] : undefined;

      return rect ? { index, rect } : null;
    },

    selectionSentence,

    destroy() {
      destroyed = true;
      teardownPlayback();
      for (const off of unsubscribers) off();
      win.removeEventListener("pagehide", onPageHide);
    },
  };

  win.addEventListener("pagehide", onPageHide);
  if (builtIn) loadVoices();
  if (canSpeak()) schedulePrepare();

  return reader;
}
