import { useEffect, useRef, useState } from "preact/hooks";
import { isDefault } from "../a11y/a11y.lib";
import type { AxController } from "../a11y/a11y.types";
import { readJson, writeJson } from "../lib/storage";
import type { Side } from "../options/options.types";
import type { Reader, ReaderState } from "../reader/reader.types";
import { describeVoice } from "../voices/voices.lib";
import { A11yPanel } from "./a11y-panel";
import { Bars } from "./controls";
import { Dock } from "./dock";
import { ChevronIcon, CloseIcon, SparkIcon } from "./icons";
import { PlayHere } from "./play-here";
import { ReadingGuide, ReadingMask } from "./reading-aids";
import { SpeedPopover } from "./speed-popover";
import {
  HINT_AFTER,
  HINT_STORAGE_KEY,
  LEAVE_MS,
  NARROW_PLACE,
  NO_AX,
  NO_READER,
  OUT_OF,
  TOAST_MS,
} from "./ui.constants";
import { useAnchor, useDismiss, useNarrow, usePresence, useStore } from "./ui.hooks";
import { fmt, formatRate, type Strings } from "./ui.i18n";
import { canListen, edgeOf, focusIn, leaveAttr } from "./ui.lib";
import { loadDock, saveDock } from "./ui.storage";
import type { DockState, Pop, Toast, Triggers } from "./ui.types";
import { VoicePopover } from "./voice-popover";

export type AppProps = {
  reader: Reader | null;
  ax: AxController | null;
  t: Strings;
  lang: string;
  side: Side;
  accent: string;
  accentInk: string;
};

export function App(props: AppProps) {
  const { reader, ax, t, lang, side, accent, accentInk } = props;
  const state = useStore(reader?.store ?? NO_READER);
  const axs = useStore(ax?.store ?? NO_AX);
  const narrow = useNarrow();
  const [dock, setDock] = useState<DockState>(() => loadDock(side === "left" ? 0 : 1));
  const [open, setOpen] = useState<Pop | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const prev = useRef(state);
  const triggers: Triggers = {
    speed: useRef<HTMLButtonElement>(null),
    voice: useRef<HTMLButtonElement>(null),
    ax: useRef<HTMLButtonElement>(null),
  };

  const playing = state.status === "playing";
  const tts = canListen(reader, state);
  const place = narrow ? NARROW_PLACE : dock;
  const edge = edgeOf(place);
  const still = axs.still;
  const railShown = usePresence(!dock.hidden, LEAVE_MS, still);
  const tabShown = usePresence(dock.hidden, LEAVE_MS, still);
  const pop = usePresence(dock.hidden ? null : open, LEAVE_MS, still);
  const toastShown = usePresence(!dock.hidden && !open ? toast : null, LEAVE_MS, still);

  function announce(msg: string): void {
    // Re-setting identical text is not re-announced by screen readers; clear first.
    setMessage("");
    setTimeout(() => setMessage(msg), 50);
  }

  function notify(next: Toast): void {
    setToast(next);
    announce(next.text);
  }

  function updateDock(patch: Partial<DockState>): void {
    setDock((current) => {
      const next = { ...current, ...patch };

      saveDock(next);

      return next;
    });
  }

  function voiceName(voice: ReaderState["voice"]): string {
    return voice ? describeVoice(voice, lang).name : t.voice;
  }

  // Once ever, point out that the voice can be changed: readers rarely find it on their own.
  function maybeHintVoice(p: ReaderState): void {
    const due =
      state.status === "playing" &&
      state.index >= HINT_AFTER &&
      p.index < HINT_AFTER &&
      !toast &&
      !open &&
      state.voices.length > 1 &&
      !state.voice?.engine;

    if (!due || readJson(HINT_STORAGE_KEY) === true) return;

    writeJson(HINT_STORAGE_KEY, true);

    const hd = state.voices.some((v) => v.engine);

    notify({
      text: hd ? t.tryHd : fmt(t.tryVoice, { n: state.voices.length }),
      voiceHint: true,
      action: { label: t.chooseVoice, run: () => setOpen("voice") },
    });
  }

  // Announce state changes the reader did not directly cause with a click on that control.
  useEffect(() => {
    const p = prev.current;

    prev.current = state;

    if (p.status !== state.status) {
      if (state.status === "playing") announce(t.playing);
      else if (state.status === "paused") announce(t.paused);
      else if (state.status === "ended") announce(t.finished);
    }

    if (p.rate !== state.rate) {
      announce(fmt(t.speedSet, { r: formatRate(state.rate) }));
    }

    if (p.voice && state.voice && p.voice.id !== state.voice.id) {
      announce(fmt(t.voiceSet, { v: voiceName(state.voice) }));
    }

    if (state.fallback && state.fallback !== p.fallback) {
      const template = state.fallback.reason === "slow" ? t.hdSlow : t.hdFailed;

      notify({ text: fmt(template, { v: voiceName(state.fallback.voice) }) });
    }

    // The browser refused to start audio without a click (programmatic play()).
    if (state.issue === "not-allowed" && p.issue !== "not-allowed") {
      notify({
        text: t.notAllowed,
        action: { label: t.play, run: () => reader?.play() },
      });
    }

    maybeHintVoice(p);
  }, [state]);

  useEffect(() => {
    if (!toast) return;

    const id = setTimeout(() => setToast(null), TOAST_MS);

    return () => clearTimeout(id);
  }, [toast]);

  useDismiss(open !== null, [popRef, triggers.speed, triggers.voice, triggers.ax], () => setOpen(null));
  useAnchor(toastRef, dockRef);

  if (!tts && !ax) return null;

  function closePop(): void {
    const trigger = open && triggers[open];

    setOpen(null);
    trigger?.current?.focus();
  }

  // A saved position resumes straight away, with a toast offering to start over.
  function toggle(): void {
    if (!reader) return;

    if (playing) {
      reader.pause();
      return;
    }

    const resume = state.resume;

    if (!resume) {
      reader.play();
      return;
    }

    reader.play(resume.index);
    notify({
      text: fmt(t.resumed, { p: Math.round(resume.progress * 100) }),
      action: { label: t.startOver, run: () => reader.play(0) },
    });
  }

  function hide(): void {
    setOpen(null);
    setToast(null);
    updateDock({ hidden: true });
    focusIn(root.current, '[data-lt="show"]');
  }

  function show(): void {
    updateDock({ hidden: false });
    focusIn(root.current, '[data-lt="hide"]');
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Escape" || !open) return;

    e.preventDefault();
    closePop();
  }

  function runToastAction(): void {
    toast?.action?.run();
    setToast(null);
  }

  const shownToast = toastShown.shown;

  return (
    <div
      class="lt"
      ref={root}
      data-side={edge}
      data-still={still ? "" : undefined}
      style={{ "--a": accent, "--ai": accentInk }}
      onKeyDown={onKeyDown}
    >
      {/* First, so the dock and panels paint above the guide and mask. */}
      {axs.guide && <ReadingGuide />}
      {axs.mask && <ReadingMask />}

      {tabShown.shown && (
        <button
          type="button"
          class={`tab surface${playing ? " on" : ""}`}
          aria-label={t.show}
          style={{ "--x": place.x, "--y": place.y }}
          data-lt="show"
          data-leave={leaveAttr(tabShown.leaving)}
          tabIndex={tabShown.leaving ? -1 : undefined}
          onClick={show}
        >
          {playing ? <Bars /> : <ChevronIcon dir={OUT_OF[edge]} />}
        </button>
      )}

      {railShown.shown && (
        <Dock
          reader={reader}
          state={state}
          t={t}
          lang={lang}
          place={place}
          open={open}
          leaving={railShown.leaving}
          hint={!!shownToast?.voiceHint && !toastShown.leaving}
          axOn={ax ? !isDefault(axs) : null}
          dockRef={dockRef}
          triggers={triggers}
          onToggle={toggle}
          onOpen={setOpen}
          onHide={hide}
          onMove={updateDock}
        />
      )}

      {pop.shown === "speed" && reader && (
        <SpeedPopover
          reader={reader}
          state={state}
          t={t}
          popRef={popRef}
          anchor={triggers.speed}
          leaving={pop.leaving}
        />
      )}

      {pop.shown === "voice" && reader && (
        <VoicePopover
          reader={reader}
          state={state}
          t={t}
          lang={lang}
          popRef={popRef}
          anchor={triggers.voice}
          leaving={pop.leaving}
        />
      )}

      {pop.shown === "ax" && ax && (
        <A11yPanel
          ax={ax}
          s={axs}
          t={t}
          panelRef={popRef}
          anchor={triggers.ax}
          onClose={closePop}
          announce={announce}
          leaving={pop.leaving}
        />
      )}

      {shownToast && (
        <div class="toast surface" ref={toastRef} data-leave={leaveAttr(toastShown.leaving)}>
          {shownToast.voiceHint && <SparkIcon size={16} />}
          <span>{shownToast.text}</span>
          {shownToast.action && (
            <button type="button" class="btn primary" onClick={runToastAction}>
              {shownToast.action.label}
            </button>
          )}
          <button type="button" class="ghost sm" aria-label={t.dismiss} onClick={() => setToast(null)}>
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {tts && reader && (
        <PlayHere reader={reader} t={t} current={playing ? state.index : null} onPlay={(index) => reader.play(index)} />
      )}

      <div class="sr" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
