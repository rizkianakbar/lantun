import type { EngineStatus, SpeakHandlers, Voice, VoiceEngine } from "@lantun/core";
import { encodeWav, SILENCE } from "../audio/audio.lib";
import { SAMPLE_RATE } from "../worker/worker.constants";
import type { FromWorker, ToWorker } from "../worker/worker.types";
import {
  CACHE_CLIPS,
  DEFAULT_SOURCES,
  JUDGE_AFTER,
  LOAD_BYTES,
  MAX_REALTIME_FACTOR,
  MIN_JUDGED_SECONDS,
  PACE,
  VOICE_NAMES,
  WORD_TICK_MS,
} from "./engine.constants";
import { canRun, debug, ignore, keyOf, nameOf, rampParts, revoke, toVoice, wordOffsets } from "./engine.lib";
import type { Clip, ClipEntry, EngineWindow, KittenOptions, PartClip, Pending } from "./engine.types";

export function createKittenEngine(
  createWorker: () => Worker,
  o: KittenOptions = {},
  win: EngineWindow = window,
): VoiceEngine {
  const sources = { ...DEFAULT_SOURCES, ...o.sources };
  const voices = canRun(win) ? (o.voices ?? VOICE_NAMES).map(toVoice) : [];
  const listeners = new Set<(s: EngineStatus) => void>();
  const pending = new Map<number, Pending>();
  const clips = new Map<string, ClipEntry>();
  const factors: number[] = [];

  let status: EngineStatus = { state: "idle", progress: 0 };
  let worker: Worker | null = null;
  let nextId = 1;
  let audio: HTMLAudioElement | null = null;
  let rate = 1;
  let paused = false;
  // Bumped by every speak() and cancel(): callbacks from an older utterance check it and bail.
  let token = 0;
  let ticker: ReturnType<typeof setInterval> | undefined;
  // When the last clip finished, to log how long the reader waited for the next one.
  let endedAt = 0;
  // Clips the current utterance still wants: its own parts, plus what prepare() asks for right
  // after speak() (the player prefetches the next sentences in the same task).
  let wanted: Set<number> | null = null;
  let startWhenResumed: (() => void) | null = null;
  // While an utterance plays, prepare() is the player looking ahead, not a warm-up.
  let speaking = false;

  function setStatus(next: EngineStatus): void {
    status = next;
    for (const listener of listeners) listener(next);
  }

  function fail(): void {
    worker?.terminate();
    worker = null;

    for (const p of pending.values()) {
      p.reject(new Error("Voice engine failed to load"));
    }

    pending.clear();
    for (const entry of clips.values()) revoke(entry);
    clips.clear();
    setStatus({ state: "error", progress: 0, error: "failed" });
  }

  // A device that cannot synthesise faster than the reader listens would stutter: say so, and
  // the reader switches to a built-in voice.
  function judge(ms: number, seconds: number): void {
    if (seconds < MIN_JUDGED_SECONDS) return;

    factors.push((ms / 1000 / seconds) * rate);

    if (factors.length < JUDGE_AFTER + 1) return;

    const recent = factors.slice(1).slice(-JUDGE_AFTER);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (mean > MAX_REALTIME_FACTOR) {
      debug(`too slow: synthesis takes ${mean.toFixed(2)}× the listening time`);
      setStatus({ state: "error", progress: 0, error: "slow" });
    }
  }

  function onAudio(msg: Extract<FromWorker, { type: "audio" }>): void {
    const p = pending.get(msg.id);

    pending.delete(msg.id);

    if (!p) return;

    const seconds = msg.samples.length / SAMPLE_RATE;
    const wav = new Blob([encodeWav(msg.samples, SAMPLE_RATE)], {
      type: "audio/wav",
    });

    debug(`clip ${msg.id}: ${Math.round(msg.ms)} ms for ${seconds.toFixed(1)} s of audio`);
    judge(msg.ms, seconds);
    p.resolve({ url: URL.createObjectURL(wav), seconds, starts: msg.starts });
  }

  function onMessage(msg: FromWorker): void {
    switch (msg.type) {
      case "progress":
        if (status.state === "loading") {
          setStatus({
            state: "loading",
            progress: Math.min(0.99, msg.loaded / LOAD_BYTES),
          });
        }
        return;

      case "ready":
        setStatus({ state: "ready", progress: 1 });
        return;

      case "audio":
        onAudio(msg);
        return;

      case "error":
        if (msg.id === undefined) {
          debug("load failed:", msg.message);
          fail();
          return;
        }

        debug(`clip ${msg.id} failed:`, msg.message);
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
    }
  }

  function send(msg: ToWorker): void {
    worker?.postMessage(msg);
  }

  function ensureWorker(): Worker | null {
    if (worker) return worker;

    try {
      worker = createWorker();
    } catch {
      // A strict Content-Security-Policy can forbid blob: workers.
      fail();
      return null;
    }

    worker.onmessage = (e: MessageEvent<FromWorker>) => onMessage(e.data);
    worker.onerror = fail;
    setStatus({ state: "loading", progress: 0 });
    send({ type: "load", sources });

    return worker;
  }

  function evict(): void {
    for (const [key, entry] of clips) {
      if (clips.size <= CACHE_CLIPS) return;

      clips.delete(key);
      revoke(entry);
    }
  }

  // `urgent` clips are what the reader is waiting to hear: the worker makes them before prefetches.
  function clipFor(voice: Voice | null, text: string, urgent = false): ClipEntry {
    const key = keyOf(voice, text);
    const hit = clips.get(key);

    if (hit) {
      // Re-insert so the Map's order stays least-recently-used first.
      clips.delete(key);
      clips.set(key, hit);

      return hit;
    }

    const id = nextId++;
    const name = nameOf(voice);
    const clip = new Promise<Clip>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      debug(`queue clip ${id}: "${text.slice(0, 40)}"`);
      send({ type: "synth", id, text, voice: name, speed: PACE[name], urgent });
    });
    const entry = { id, clip };

    // A failed clip must not stay cached, or a retry would get the same failure.
    clip.catch(() => {
      if (clips.get(key)?.id === id) clips.delete(key);
    });
    clips.set(key, entry);
    evict();

    return entry;
  }

  // A sentence already made (or being made) whole plays whole; otherwise it starts with a short
  // opening so the first words come quickly.
  function partsFor(voice: Voice | null, text: string, urgent: boolean): PartClip[] {
    const whole = clips.get(keyOf(voice, text));

    if (whole) return [{ part: { text, offset: 0 }, ...whole }];

    return rampParts(text).map((part) => ({ part, ...clipFor(voice, part.text, urgent) }));
  }

  // The reader moved on: forget unfinished clips for anything else, here and now, so nothing
  // can pick up a clip that is about to be cancelled, and tell the worker to skip them.
  function dropAllBut(keep: Set<number>): void {
    for (const [key, entry] of clips) {
      const p = pending.get(entry.id);

      if (!p || keep.has(entry.id)) continue;

      clips.delete(key);
      pending.delete(entry.id);
      p.reject(new Error("dropped"));
    }

    send({ type: "drop", keep: [...keep] });
  }

  function stop(): void {
    clearInterval(ticker);
    ticker = undefined;
    startWhenResumed = null;

    if (audio) {
      audio.onended = null;
      audio.pause();
    }
  }

  function element(): HTMLAudioElement {
    if (audio) return audio;

    const AudioCtor = win.Audio ?? Audio;
    const el = new AudioCtor();

    el.preload = "auto";
    // Speed changes keep the voice's pitch (the default in browsers, stated for clarity).
    el.preservesPitch = true;
    audio = el;

    return el;
  }

  // Plays the utterance's parts back to back, mapping each part's words to utterance offsets.
  function playParts(parts: PartClip[], handlers: SpeakHandlers, mine: number): void {
    const el = element();
    let i = 0;
    let started = false;

    function current(): boolean {
      return mine === token;
    }

    function onPlayFailed(err: Error): void {
      if (!current()) return;

      handlers.onError({
        code: err.name === "NotAllowedError" ? "not-allowed" : "audio-failed",
        message: err.message,
      });
    }

    function onClipFailed(err: Error): void {
      if (!current() || err.message === "dropped") return;

      handlers.onError({ code: "synthesis-failed", message: err.message });
    }

    function playClip(item: PartClip, clip: Clip): void {
      if (!current()) return;

      const offsets = wordOffsets(item.part);
      let next = 0;

      // Word events follow the media clock, which already accounts for speed and pauses.
      function tick(): void {
        while (next < offsets.length && (clip.starts[next] ?? Infinity) <= el.currentTime) {
          handlers.onWord(offsets[next++] ?? 0, false);
        }
      }

      function onPlaying(): void {
        if (!current()) return;

        if (!started) {
          started = true;
          handlers.onStart?.();
        }

        if (endedAt) {
          debug(`silence before "${item.part.text.slice(0, 30)}": ${Math.round(performance.now() - endedAt)} ms`);
        }

        endedAt = 0;
        clearInterval(ticker);
        ticker = setInterval(tick, WORD_TICK_MS);
        tick();
      }

      function start(): void {
        el.onended = () => {
          endedAt = performance.now();

          if (!current()) return;

          clearInterval(ticker);
          tick();
          i++;
          playNext();
        };
        el.src = clip.url;
        el.playbackRate = rate;
        el.play().then(onPlaying, onPlayFailed);
      }

      // Paused while the clip was still being made: start when the reader resumes.
      if (paused) startWhenResumed = start;
      else start();
    }

    function playNext(): void {
      const item = parts[i];

      if (!item) {
        speaking = false;
        handlers.onEnd();
        return;
      }

      item.clip.then((clip) => playClip(item, clip), onClipFailed);
    }

    playNext();
  }

  return {
    id: "kitten",
    reliablePause: true,
    slowStart: true,
    liveRate: true,

    status() {
      return status;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },

    getVoices() {
      return Promise.resolve(voices);
    },

    speak(req, handlers) {
      stop();

      const mine = ++token;
      const el = element();

      paused = false;
      speaking = true;
      rate = req.rate;

      // Inside the reader's click: playing anything now lets this element play later.
      if (!el.src) {
        el.src = SILENCE;
        el.play().catch(ignore);
      }

      if (status.state === "error") {
        factors.length = 0;
        setStatus({ state: "idle", progress: 0 });
      }

      if (!ensureWorker()) {
        handlers.onError({
          code: "engine-failed",
          message: "HD voice is unavailable on this page.",
        });
        return;
      }

      const parts = partsFor(req.voice, req.text, true);
      // Drop stale work once the player has also named the sentences it wants next. Dropping
      // at once threw away the next sentence mid-synthesis on every ordinary sentence change,
      // and the reader then waited while it was made again from scratch.
      const keep = new Set(parts.map((p) => p.id));

      wanted = keep;
      queueMicrotask(() => {
        if (wanted === keep) dropAllBut(keep);
      });
      playParts(parts, handlers, mine);
    },

    // Only ever called for this engine's voices, so for a reader who chose one: loading is
    // wanted. Before playback it is the sentence play will start on, made in the same pieces
    // speak() would use; during playback it is a sentence ahead, made whole.
    prepare(req) {
      if (status.state === "error" || !ensureWorker()) return;

      const entries = speaking ? [clipFor(req.voice, req.text)] : partsFor(req.voice, req.text, false);

      for (const entry of entries) {
        wanted?.add(entry.id);
        entry.clip.catch(ignore);
      }
    },

    setRate(next) {
      rate = next;
      if (audio) audio.playbackRate = next;
    },

    pause() {
      paused = true;
      audio?.pause();
    },

    resume() {
      paused = false;

      const start = startWhenResumed;

      startWhenResumed = null;

      if (start) start();
      else audio?.play().catch(ignore);
    },

    cancel() {
      token++;
      speaking = false;
      stop();
    },
  };
}
