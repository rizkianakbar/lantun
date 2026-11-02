import type { JSX, RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { PROFILE_IDS, TEXT_SIZES } from "../a11y/a11y.constants";
import { activeProfile, isDefault } from "../a11y/a11y.lib";
import type { AxController, AxSettings, ProfileId, Step } from "../a11y/a11y.types";
import { CycleTile, Pips, Tile, Toggle } from "./controls";
import {
  BookIcon,
  CalmIcon,
  CloseIcon,
  CursorIcon,
  DyslexiaIcon,
  EyeIcon,
  FocusIcon,
  FontIcon,
  GlassesIcon,
  GrayscaleIcon,
  GuideIcon,
  LineHeightIcon,
  LinkIcon,
  MaskIcon,
  NoImageIcon,
  SpacingIcon,
  StillIcon,
} from "./icons";
import { MAX_STEP, MODES } from "./ui.constants";
import { useAnchor } from "./ui.hooks";
import { fmt, type Strings } from "./ui.i18n";
import { leaveAttr, radioKeys } from "./ui.lib";

export type A11yPanelProps = {
  ax: AxController;
  s: AxSettings;
  t: Strings;
  panelRef: RefObject<HTMLElement | null>;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  announce: (msg: string) => void;
  leaving: boolean;
};

type AidKey = "guide" | "mask" | "links" | "cursor" | "still" | "noImages";

const PROFILE_ICONS: Record<ProfileId, () => JSX.Element> = {
  lowVision: EyeIcon,
  dyslexia: BookIcon,
  adhd: FocusIcon,
  seizure: CalmIcon,
  elderly: GlassesIcon,
};

const AIDS: { key: AidKey; Icon: () => JSX.Element }[] = [
  { key: "guide", Icon: GuideIcon },
  { key: "mask", Icon: MaskIcon },
  { key: "links", Icon: LinkIcon },
  { key: "cursor", Icon: CursorIcon },
  { key: "still", Icon: StillIcon },
  { key: "noImages", Icon: NoImageIcon },
];

export function A11yPanel(props: A11yPanelProps) {
  const { ax, s, t, panelRef, anchor, onClose, announce, leaving } = props;
  const first = useRef<HTMLButtonElement>(null);
  const active = activeProfile(s);
  const modeIndex = Math.max(
    0,
    MODES.findIndex((m) => m.value === s.contrast),
  );

  useEffect(() => first.current?.focus(), []);
  useAnchor(panelRef, anchor);

  function set(patch: Partial<AxSettings>): void {
    ax.update(patch);
  }

  function level(n: number): string {
    return n ? fmt(t.level, { n, m: MAX_STEP }) : t.off;
  }

  function size(text: Step): void {
    set({ text });
    announce(`${t.textSize} ${TEXT_SIZES[text]}%`);
  }

  function reset(): void {
    ax.reset();
    announce(t.settingsReset);
    first.current?.focus();
  }

  function toggleProfile(id: ProfileId): void {
    const on = active === id;

    ax.toggleProfile(id, on);
    announce(on ? t.settingsReset : fmt(t.profileOn, { p: t[id] }));
  }

  function onSwatchKey(e: KeyboardEvent): void {
    radioKeys(e, MODES.length, modeIndex, (i) => set({ contrast: MODES[i]?.value ?? "default" }));
  }

  return (
    <section
      class="pop panel surface"
      role="dialog"
      aria-labelledby="lt-ax-title"
      ref={panelRef}
      data-leave={leaveAttr(leaving)}
    >
      <div class="phead">
        <h2 id="lt-ax-title">{t.a11yTitle}</h2>
        <button type="button" class="reset" aria-label={t.resetAll} disabled={isDefault(s)} onClick={reset}>
          {t.reset}
        </button>
        <button type="button" class="ghost sm" aria-label={t.closePanel} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div class="body">
        <h3>{t.profiles}</h3>
        <div class="chips">
          {PROFILE_IDS.map((id, i) => {
            const Icon = PROFILE_ICONS[id];

            return (
              <button
                key={id}
                ref={i === 0 ? first : undefined}
                type="button"
                class="pchip"
                aria-pressed={active === id}
                onClick={() => toggleProfile(id)}
              >
                <Icon />
                {t[id]}
              </button>
            );
          })}
        </div>
        <p class="hint">{active ? t[`${active}Hint`] : t.profilesHint}</p>

        <h3>{t.text}</h3>
        <div class="size" role="group" aria-label={t.textSize}>
          <button
            type="button"
            class="step"
            aria-label={t.smaller}
            disabled={s.text === 0}
            onClick={() => size((s.text - 1) as Step)}
          >
            <span class="a sm">A</span>
          </button>
          <div class="val" aria-hidden="true">
            <span>{t.textSize}</span>
            <b>{TEXT_SIZES[s.text]}%</b>
            <Pips value={s.text + 1} max={TEXT_SIZES.length} />
          </div>
          <button
            type="button"
            class="step"
            aria-label={t.larger}
            disabled={s.text === MAX_STEP}
            onClick={() => size((s.text + 1) as Step)}
          >
            <span class="a lg">A</span>
          </button>
        </div>

        <div class="tiles two">
          <CycleTile
            icon={<LineHeightIcon />}
            label={t.lineHeight}
            value={s.line}
            max={MAX_STEP}
            valueText={level(s.line)}
            onChange={(line) => set({ line: line as Step })}
          />
          <CycleTile
            icon={<SpacingIcon />}
            label={t.letterSpacing}
            value={s.spacing}
            max={MAX_STEP}
            valueText={level(s.spacing)}
            onChange={(spacing) => set({ spacing: spacing as Step })}
          />
          <Tile
            icon={<FontIcon />}
            label={t.fontReadable}
            on={s.font === "readable"}
            onChange={(on) => set({ font: on ? "readable" : "default" })}
          />
          <Tile
            icon={<DyslexiaIcon />}
            label={t.fontDyslexic}
            on={s.font === "dyslexic"}
            onChange={(on) => set({ font: on ? "dyslexic" : "default" })}
          />
        </div>

        <h3 id="lt-color">{t.color}</h3>
        <div class="swatches" role="radiogroup" aria-labelledby="lt-color" onKeyDown={onSwatchKey}>
          {MODES.map((m, i) => (
            <button
              key={m.value}
              type="button"
              class="sw"
              role="radio"
              aria-checked={i === modeIndex}
              tabIndex={i === modeIndex ? 0 : -1}
              onClick={() => set({ contrast: m.value })}
            >
              <span class={`prev ${m.value}`} style={{ background: m.bg, color: m.fg }} aria-hidden="true">
                <span>Aa</span>
              </span>
              {t[m.label]}
            </button>
          ))}
        </div>
        <Toggle
          icon={<GrayscaleIcon />}
          label={t.desaturate}
          on={s.desaturate}
          onChange={(desaturate) => set({ desaturate })}
        />

        <h3>{t.aids}</h3>
        <div class="tiles">
          {AIDS.map(({ key, Icon }) => (
            <Tile key={key} icon={<Icon />} label={t[key]} on={s[key]} onChange={(on) => set({ [key]: on })} />
          ))}
        </div>
      </div>
    </section>
  );
}
