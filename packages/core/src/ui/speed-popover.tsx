import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { MAX_RATE, MIN_RATE, RATE_STEP } from "../player/player.constants";
import type { Reader, ReaderState } from "../reader/reader.types";
import { MinusIcon, PlusIcon } from "./icons";
import { RATE_PRESETS } from "./ui.constants";
import { useAnchor } from "./ui.hooks";
import { formatRate, type Strings } from "./ui.i18n";
import { leaveAttr } from "./ui.lib";

export type SpeedPopoverProps = {
  reader: Reader;
  state: ReaderState;
  t: Strings;
  popRef: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLElement | null>;
  leaving: boolean;
};

export function SpeedPopover(props: SpeedPopoverProps) {
  const { reader, state, t, popRef, anchor, leaving } = props;
  const rangeRef = useRef<HTMLInputElement>(null);
  const { rate } = state;
  const fill = ((rate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100;

  useEffect(() => rangeRef.current?.focus(), []);
  useAnchor(popRef, anchor);

  return (
    <div class="pop speedpop surface" role="dialog" aria-label={t.speed} ref={popRef} data-leave={leaveAttr(leaving)}>
      <div class="label">
        {t.speed}
        <b>{formatRate(rate)}×</b>
      </div>

      <div class="stepper">
        <button
          type="button"
          class="ghost sm"
          aria-label={t.slower}
          disabled={rate <= MIN_RATE}
          onClick={() => reader.setRate(rate - RATE_STEP)}
        >
          <MinusIcon />
        </button>
        <input
          ref={rangeRef}
          class="range"
          type="range"
          min={MIN_RATE}
          max={MAX_RATE}
          step={RATE_STEP}
          value={rate}
          aria-label={t.speed}
          aria-valuetext={`${formatRate(rate)}×`}
          style={{ "--p": `${fill}%` }}
          onInput={(e) => reader.setRate(Number(e.currentTarget.value))}
        />
        <button
          type="button"
          class="ghost sm"
          aria-label={t.faster}
          disabled={rate >= MAX_RATE}
          onClick={() => reader.setRate(rate + RATE_STEP)}
        >
          <PlusIcon />
        </button>
      </div>

      <div class="presets">
        {RATE_PRESETS.map((preset) => (
          <button key={preset} type="button" aria-pressed={rate === preset} onClick={() => reader.setRate(preset)}>
            {preset}×
          </button>
        ))}
      </div>
    </div>
  );
}
