import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import type { Reader, ReaderState } from "../reader/reader.types";
import type { Voice } from "../speech/speech.types";
import { describeVoice, voiceTip } from "../voices/voices.lib";
import type { VoiceLabel } from "../voices/voices.types";
import { CheckIcon, SparkIcon } from "./icons";
import { TIPS } from "./ui.constants";
import { useAnchor } from "./ui.hooks";
import { fmt, type Strings } from "./ui.i18n";
import { hdDetail, leaveAttr, megabytes, radioKeys } from "./ui.lib";

export type VoicePopoverProps = {
  reader: Reader;
  state: ReaderState;
  t: Strings;
  lang: string;
  popRef: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLElement | null>;
  leaving: boolean;
};

export function VoicePopover(props: VoicePopoverProps) {
  const { reader, state, t, lang, popRef, anchor, leaving } = props;
  const listRef = useRef<HTMLDivElement>(null);
  // HD voices first as their own group; arrow keys walk the list in the order shown.
  const hd = state.voices.filter((v) => v.engine);
  const builtIn = state.voices.filter((v) => !v.engine);
  const voices = [...hd, ...builtIn];
  const hdBytes = hd[0]?.downloadBytes ?? 0;
  const hdReady = state.engine?.state === "ready" || !hdBytes;
  const current = Math.max(
    0,
    voices.findIndex((v) => v.id === state.voice?.id),
  );
  const tip = voiceTip(voices, navigator.userAgent, navigator.maxTouchPoints || 0);

  useAnchor(popRef, anchor);

  // Focus the chosen voice without scrolling the group headings out of view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');

    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest" });
  }, []);

  // HD rows show the download state only on the chosen voice; the size is said once, in the heading.
  function subtitle(v: Voice, d: VoiceLabel, on: boolean): string {
    if (d.kind === "hd") {
      return on ? hdDetail(v, state.engine, t) : [v.gender && t[v.gender], d.region].filter(Boolean).join(" · ");
    }

    const where = d.kind === "online" ? t.online : d.kind === "device" ? t.device : "";

    return [d.region, where].filter(Boolean).join(" · ");
  }

  function option(v: Voice, i: number) {
    const d = describeVoice(v, lang);
    const on = i === current;

    return (
      <button
        key={v.id}
        type="button"
        class="opt"
        role="radio"
        aria-checked={on}
        tabIndex={on ? 0 : -1}
        onClick={() => reader.setVoice(v.id)}
      >
        <span class="av" aria-hidden="true">
          {d.name.slice(0, 1)}
        </span>
        <span class="n">
          <b>
            {d.name}
            {d.kind === "natural" && <span class="tag">{t.natural}</span>}
          </b>
          <span class="sub">{subtitle(v, d, on)}</span>
        </span>
        <span class="tick">
          <CheckIcon />
        </span>
      </button>
    );
  }

  function onKeyDown(e: KeyboardEvent): void {
    radioKeys(e, voices.length, current, (i) => reader.setVoice(voices[i]?.id ?? ""));
  }

  return (
    <div class="pop voicepop surface" role="dialog" aria-label={t.voice} ref={popRef} data-leave={leaveAttr(leaving)}>
      {voices.length ? (
        <div class="voices" role="radiogroup" aria-label={t.voice} ref={listRef} onKeyDown={onKeyDown}>
          {hd.length > 0 && (
            <div class="group" aria-hidden="true">
              <b>
                <SparkIcon />
                {t.hdGroup}
              </b>
              <span>{hdReady ? t.hdGroupSub : fmt(t.hdGroupDownload, { mb: megabytes(hdBytes) })}</span>
            </div>
          )}
          {hd.map(option)}

          {hd.length > 0 && builtIn.length > 0 && (
            <div class="group" aria-hidden="true">
              <b>{t.builtInGroup}</b>
            </div>
          )}
          {builtIn.map((v, i) => option(v, i + hd.length))}
        </div>
      ) : (
        state.voicesLoaded && <p class="empty">{t.noVoice}</p>
      )}

      {tip && !hd.length && <p class="tip">{t[TIPS[tip]]}</p>}
    </div>
  );
}
