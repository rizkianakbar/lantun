import type { RefObject } from "preact";
import type { Reader, ReaderState } from "../reader/reader.types";
import { describeVoice } from "../voices/voices.lib";
import { AccessIcon, ChevronIcon, GripIcon, PauseIcon, PlayIcon, SkipIcon, VoiceIcon } from "./icons";
import { RING } from "./ui.constants";
import { useCountdown, useDockPlacement, useDrag } from "./ui.hooks";
import { clock, fmt, formatRate, type Strings } from "./ui.i18n";
import { hideDir, leaveAttr } from "./ui.lib";
import type { DockPlace, Pop, Triggers } from "./ui.types";

export type DockProps = {
  reader: Reader | null;
  state: ReaderState;
  t: Strings;
  lang: string;
  place: DockPlace;
  open: Pop | null;
  leaving: boolean;
  // Draws attention to the voice button while the one-time voice hint is showing.
  hint: boolean;
  axOn: boolean | null;
  dockRef: RefObject<HTMLDivElement | null>;
  triggers: Triggers;
  onToggle: () => void;
  onOpen: (pop: Pop | null) => void;
  onHide: () => void;
  onMove: (place: DockPlace) => void;
};

// The listening rail plus, set apart, the reading-aids button. A session grows skip buttons and a
// progress ring.
export function Dock(props: DockProps) {
  const { state, t, place, open, axOn, triggers } = props;
  const remaining = useCountdown(state);
  const startDrag = useDrag(props.dockRef, place.o, () => props.onOpen(null), props.onMove);

  useDockPlacement(props.dockRef, place.x, place.y, [place.o, axOn === null]);

  const playing = state.status === "playing";
  const active = playing || state.status === "paused";
  // Without a voice or article text there is nothing to play: the rail keeps only move and hide.
  const tts = state.issue !== "unsupported" && state.issue !== "no-content" ? props.reader : null;
  const minutes = Math.max(1, Math.round(state.duration / 60));
  const position = fmt(t.sentenceOf, {
    i: Math.min(state.index + 1, state.total),
    n: state.total,
  });
  const voiceName = state.voice ? describeVoice(state.voice, props.lang).name : t.voice;
  // While a lifelike voice downloads, the ring and the time slot show the download instead.
  const loading = state.engine?.state === "loading" && active ? state.engine.progress : null;
  const isLoading = loading !== null;
  const percent = isLoading ? `${Math.round(loading * 100)}%` : "";
  const preparing = fmt(t.preparing, { v: voiceName, p: percent });
  const ring = loading ?? state.progress;
  const total = Math.max(state.total, 1);
  const load = isLoading ? " load" : "";

  let tip = fmt(t.listenFor, { n: minutes });
  let time = fmt(t.minutes, { n: minutes });

  if (isLoading) {
    tip = `${preparing} · ${t.preparingSub}`;
    time = percent;
  } else if (active) {
    tip = `${position} · ${fmt(t.left, { t: clock(remaining) })}`;
    time = clock(remaining);
  }

  function toggle(pop: Pop): () => void {
    return () => props.onOpen(open === pop ? null : pop);
  }

  function onKey(e: KeyboardEvent): void {
    if (!tts || e.metaKey || e.ctrlKey || e.altKey) return;

    const onButton = (e.target as HTMLElement).tagName === "BUTTON";

    if (e.key === "k" || e.key === "K" || (e.key === " " && !onButton)) {
      props.onToggle();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      tts.prev();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      tts.next();
    } else {
      return;
    }

    e.preventDefault();
  }

  // Double-clicking the grip sends the dock back to the middle of its nearest side.
  function resetPlace(): void {
    props.onMove({ x: place.x < 0.5 ? 0 : 1, y: 0.5, o: "v" });
  }

  return (
    <div class="dock" ref={props.dockRef} data-o={place.o} data-leave={leaveAttr(props.leaving)}>
      <div
        class="rail surface"
        role="region"
        aria-label={t.region}
        data-active={active ? "" : undefined}
        onKeyDown={onKey}
      >
        <div class="grip" aria-hidden="true" title={t.move} onPointerDown={startDrag} onDblClick={resetPlace}>
          <GripIcon />
        </div>

        {tts && (
          <>
            <div class="xtra">
              <button
                type="button"
                class="ghost"
                aria-label={t.prev}
                data-tip={t.prev}
                disabled={isLoading}
                onClick={() => tts.prev()}
              >
                <SkipIcon />
              </button>
            </div>

            <div class="playwrap">
              {active && (
                <div
                  class={`ring${load}`}
                  role="progressbar"
                  aria-label={t.progress}
                  aria-valuemin={1}
                  aria-valuemax={total}
                  aria-valuenow={Math.min(state.index + 1, total)}
                  aria-valuetext={isLoading ? preparing : position}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <circle cx="24" cy="24" r="22" />
                    <circle
                      cx="24"
                      cy="24"
                      r="22"
                      class="prg"
                      stroke-dasharray={RING}
                      stroke-dashoffset={RING * (1 - ring)}
                    />
                  </svg>
                </div>
              )}
              <button
                type="button"
                class={`play${load}`}
                aria-label={playing ? t.pause : t.play}
                data-tip={tip}
                onClick={props.onToggle}
                data-lt="play"
              >
                {playing ? <PauseIcon size={13} /> : <PlayIcon size={14} />}
              </button>
            </div>

            <span class={`time${load}`} aria-hidden="true">
              {time}
            </span>

            <div class="xtra">
              <button
                type="button"
                class="ghost"
                aria-label={t.next}
                data-tip={t.next}
                disabled={isLoading}
                onClick={() => tts.next()}
              >
                <SkipIcon ahead />
              </button>
            </div>

            <span class="sep" />

            <button
              type="button"
              class="ghost vb"
              ref={triggers.voice}
              aria-label={fmt(state.voice?.engine ? t.voiceOfHd : t.voiceOf, {
                v: voiceName,
              })}
              aria-expanded={open === "voice"}
              aria-haspopup="dialog"
              data-tip={fmt(t.voiceOf, { v: voiceName })}
              data-hint={props.hint ? "" : undefined}
              data-lt="voice"
              onClick={toggle("voice")}
            >
              <VoiceIcon />
              {state.voice?.engine && <i class="dot" />}
            </button>

            <button
              type="button"
              class="speed"
              ref={triggers.speed}
              aria-label={`${t.speed}, ${formatRate(state.rate)}×`}
              aria-expanded={open === "speed"}
              aria-haspopup="dialog"
              data-tip={t.speed}
              onClick={toggle("speed")}
            >
              {formatRate(state.rate)}×
            </button>
          </>
        )}

        <button
          type="button"
          class="ghost hide"
          aria-label={t.hide}
          data-tip={t.hide}
          onClick={props.onHide}
          data-lt="hide"
        >
          <ChevronIcon dir={hideDir(place)} />
        </button>
      </div>

      {axOn !== null && (
        <button
          type="button"
          class="puck surface"
          ref={triggers.ax}
          aria-label={axOn ? `${t.a11y}, ${t.on}` : t.a11y}
          aria-expanded={open === "ax"}
          aria-haspopup="dialog"
          data-tip={t.a11yTitle}
          data-lt="ax"
          onClick={toggle("ax")}
        >
          <AccessIcon size={18} />
          {axOn && <i class="dot" />}
        </button>
      )}
    </div>
  );
}
