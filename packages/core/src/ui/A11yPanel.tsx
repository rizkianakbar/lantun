import type { JSX, RefObject } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { AxController } from '../a11y/controller'
import { activeProfile, isDefault, PROFILE_IDS, TEXT_SIZES, type AxSettings, type ContrastMode, type ProfileId, type Step } from '../a11y/settings'
import { CycleTile, Pips, Tile, Toggle } from './controls'
import { radioKeys, useAnchor } from './hooks'
import { fmt, type Strings } from './i18n'
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
} from './icons'

interface Props {
  ax: AxController
  s: AxSettings
  t: Strings
  panelRef: RefObject<HTMLElement | null>
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  announce: (msg: string) => void
  leaving: boolean
}

const PROFILE_ICONS: Record<ProfileId, () => JSX.Element> = {
  lowVision: EyeIcon,
  dyslexia: BookIcon,
  adhd: FocusIcon,
  seizure: CalmIcon,
  elderly: GlassesIcon,
}

// Each swatch previews the mode it switches to, so nobody has to guess what "invert" means.
const MODES: { value: ContrastMode; bg: string; fg: string }[] = [
  { value: 'default', bg: '#f4f4f5', fg: '#18181b' },
  { value: 'dark', bg: '#16161a', fg: '#e6e6e9' },
  { value: 'light', bg: '#fffaf0', fg: '#3b3b3b' },
  { value: 'high', bg: '#000', fg: '#ffe500' },
  { value: 'invert', bg: 'linear-gradient(135deg,#f4f4f5 50%,#18181b 50%)', fg: 'transparent' },
]

export const A11yPanel = ({ ax, s, t, panelRef, anchor, onClose, announce, leaving }: Props) => {
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => first.current?.focus(), [])
  useAnchor(panelRef, anchor)
  const active = activeProfile(s)
  const set = (patch: Partial<AxSettings>) => ax.update(patch)
  const level = (n: number) => (n ? fmt(t.level, { n, m: 3 }) : t.off)
  const modeLabel: Record<ContrastMode, string> = { default: t.contrastDefault, dark: t.dark, light: t.light, high: t.high, invert: t.invert }
  const modeIndex = Math.max(
    0,
    MODES.findIndex((m) => m.value === s.contrast),
  )
  const size = (text: Step) => {
    set({ text })
    announce(`${t.textSize} ${TEXT_SIZES[text]}%`)
  }

  return (
    <section class="pop panel surface" role="dialog" aria-labelledby="lt-ax-title" ref={panelRef} data-leave={leaving ? '' : undefined}>
      <div class="phead">
        <h2 id="lt-ax-title">{t.a11yTitle}</h2>
        <button
          type="button"
          class="reset"
          aria-label={t.resetAll}
          disabled={isDefault(s)}
          onClick={() => {
            ax.reset()
            announce(t.settingsReset)
            first.current?.focus()
          }}
        >
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
            const Icon = PROFILE_ICONS[id]
            return (
              <button
                key={id}
                ref={i === 0 ? first : undefined}
                type="button"
                class="pchip"
                aria-pressed={active === id}
                onClick={() => {
                  ax.toggleProfile(id, active === id)
                  announce(active === id ? t.settingsReset : fmt(t.profileOn, { p: t[id] }))
                }}
              >
                <Icon />
                {t[id]}
              </button>
            )
          })}
        </div>
        <p class="hint">{active ? t[`${active}Hint`] : t.profilesHint}</p>

        <h3>{t.text}</h3>
        <div class="size" role="group" aria-label={t.textSize}>
          <button type="button" class="step" aria-label={t.smaller} disabled={s.text === 0} onClick={() => size((s.text - 1) as Step)}>
            <span class="a sm">A</span>
          </button>
          <div class="val" aria-hidden="true">
            <span>{t.textSize}</span>
            <b>{TEXT_SIZES[s.text]}%</b>
            <Pips value={s.text + 1} max={TEXT_SIZES.length} />
          </div>
          <button type="button" class="step" aria-label={t.larger} disabled={s.text === 3} onClick={() => size((s.text + 1) as Step)}>
            <span class="a lg">A</span>
          </button>
        </div>
        <div class="tiles two">
          <CycleTile icon={<LineHeightIcon />} label={t.lineHeight} value={s.line} max={3} valueText={level(s.line)} onChange={(line) => set({ line: line as Step })} />
          <CycleTile
            icon={<SpacingIcon />}
            label={t.letterSpacing}
            value={s.spacing}
            max={3}
            valueText={level(s.spacing)}
            onChange={(spacing) => set({ spacing: spacing as Step })}
          />
          <Tile icon={<FontIcon />} label={t.fontReadable} on={s.font === 'readable'} onChange={(on) => set({ font: on ? 'readable' : 'default' })} />
          <Tile icon={<DyslexiaIcon />} label={t.fontDyslexic} on={s.font === 'dyslexic'} onChange={(on) => set({ font: on ? 'dyslexic' : 'default' })} />
        </div>

        <h3 id="lt-color">{t.color}</h3>
        <div
          class="swatches"
          role="radiogroup"
          aria-labelledby="lt-color"
          onKeyDown={(e) => radioKeys(e, MODES.length, modeIndex, (i) => set({ contrast: MODES[i]?.value ?? 'default' }))}
        >
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
              {modeLabel[m.value]}
            </button>
          ))}
        </div>
        <Toggle icon={<GrayscaleIcon />} label={t.desaturate} on={s.desaturate} onChange={(desaturate) => set({ desaturate })} />

        <h3>{t.aids}</h3>
        <div class="tiles">
          <Tile icon={<GuideIcon />} label={t.guide} on={s.guide} onChange={(guide) => set({ guide })} />
          <Tile icon={<MaskIcon />} label={t.mask} on={s.mask} onChange={(mask) => set({ mask })} />
          <Tile icon={<LinkIcon />} label={t.links} on={s.links} onChange={(links) => set({ links })} />
          <Tile icon={<CursorIcon />} label={t.cursor} on={s.cursor} onChange={(cursor) => set({ cursor })} />
          <Tile icon={<StillIcon />} label={t.still} on={s.still} onChange={(still) => set({ still })} />
          <Tile icon={<NoImageIcon />} label={t.noImages} on={s.noImages} onChange={(noImages) => set({ noImages })} />
        </div>
      </div>
    </section>
  )
}
