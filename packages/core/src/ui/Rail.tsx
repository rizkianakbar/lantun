import type { RefObject } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import type { Reader, ReaderState } from '../reader'
import type { EngineStatus, Voice } from '../speech/types'
import { MAX_RATE, MIN_RATE, RATE_STEP } from '../speech/player.constants'
import { describeVoice, voiceTip } from '../speech/voices'
import type { Orientation } from '../state/dock'
import { radioKeys, useAnchor, useCountdown, useDockPlacement, useDrag, type DockDrop } from './hooks'
import { clock, fmt, formatRate, type Strings } from './i18n'
import { AccessIcon, CheckIcon, ChevronIcon, GripIcon, SparkIcon, type ChevronDir, MinusIcon, PauseIcon, PlayIcon, PlusIcon, SkipIcon, VoiceIcon } from './icons'

const PRESETS = [0.75, 1, 1.25, 1.5, 2]
const RING = 2 * Math.PI * 22

export type Pop = 'speed' | 'voice' | 'ax'

export interface Triggers {
  speed: RefObject<HTMLButtonElement | null>
  voice: RefObject<HTMLButtonElement | null>
  ax: RefObject<HTMLButtonElement | null>
}

interface DockProps {
  reader: Reader | null
  state: ReaderState
  t: Strings
  lang: string
  x: number
  y: number
  o: Orientation
  open: Pop | null
  leaving: boolean
  // Draws attention to the voice button while the one-time voice hint is showing.
  hint: boolean
  axOn: boolean | null
  dockRef: RefObject<HTMLDivElement | null>
  triggers: Triggers
  onToggle: () => void
  onOpen: (pop: Pop | null) => void
  onHide: () => void
  onMove: (drop: DockDrop) => void
}

// The dock: a listening rail plus, set apart, the reading-aids button. Idle the rail is play
// (with the listening time), voice and speed; once a session starts it grows skip back/ahead and
// a progress ring. Upright on a side edge, lying flat along the top or bottom.
export const Dock = (p: DockProps) => {
  const { state, t, o, open, axOn, triggers } = p
  const remaining = useCountdown(state)
  const startDrag = useDrag(p.dockRef, o, () => p.onOpen(null), p.onMove)
  useDockPlacement(p.dockRef, p.x, p.y, [o, axOn === null])
  const playing = state.status === 'playing'
  const active = playing || state.status === 'paused'
  // Without a voice or article text there is nothing to play: the rail keeps only move and hide.
  const tts = state.issue !== 'unsupported' && state.issue !== 'no-content' ? p.reader : null
  const minutes = Math.max(1, Math.round(state.duration / 60))
  const position = fmt(t.sentenceOf, { i: Math.min(state.index + 1, state.total), n: state.total })
  const voiceName = state.voice ? describeVoice(state.voice, p.lang).name : t.voice
  // While a lifelike voice downloads, the ring and the time slot show the download instead.
  const loading = state.engine?.state === 'loading' && active ? state.engine.progress : null
  const percent = loading === null ? '' : `${Math.round(loading * 100)}%`
  const ring = loading ?? state.progress
  const tip = loading !== null ? `${fmt(t.preparing, { v: voiceName, p: percent })} · ${t.preparingSub}` : active ? `${position} · ${fmt(t.left, { t: clock(remaining) })}` : fmt(t.listenFor, { n: minutes })
  const toggle = (pop: Pop) => () => p.onOpen(open === pop ? null : pop)

  const onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement
    if (!tts || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'k' || e.key === 'K' || (e.key === ' ' && target.tagName !== 'BUTTON')) p.onToggle()
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') tts.prev()
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') tts.next()
    else return
    e.preventDefault()
  }

  return (
    <div class="dock" ref={p.dockRef} data-o={o} data-leave={p.leaving ? '' : undefined}>
      <div class="rail surface" role="region" aria-label={t.region} data-active={active ? '' : undefined} onKeyDown={onKey}>
        <div class="grip" aria-hidden="true" title={t.move} onPointerDown={startDrag} onDblClick={() => p.onMove({ x: p.x < 0.5 ? 0 : 1, y: 0.5, o: 'v' })}>
          <GripIcon />
        </div>
        {tts && (
          <>
            <div class="xtra">
              <button type="button" class="ghost" aria-label={t.prev} data-tip={t.prev} disabled={loading !== null} onClick={() => tts.prev()}>
                <SkipIcon />
              </button>
            </div>
            <div class="playwrap">
              {active && (
                <div
                  class={`ring${loading === null ? '' : ' load'}`}
                  role="progressbar"
                  aria-label={t.progress}
                  aria-valuemin={1}
                  aria-valuemax={Math.max(state.total, 1)}
                  aria-valuenow={Math.min(state.index + 1, Math.max(state.total, 1))}
                  aria-valuetext={loading === null ? position : fmt(t.preparing, { v: voiceName, p: percent })}
                >
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <circle cx="24" cy="24" r="22" />
                    <circle cx="24" cy="24" r="22" class="prg" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - ring)} />
                  </svg>
                </div>
              )}
              <button
                type="button"
                class={`play${loading === null ? '' : ' load'}`}
                aria-label={playing ? t.pause : t.play}
                data-tip={tip}
                onClick={p.onToggle}
                data-lt="play"
              >
                {playing ? <PauseIcon size={13} /> : <PlayIcon size={14} />}
              </button>
            </div>
            <span class={`time${loading === null ? '' : ' load'}`} aria-hidden="true">
              {loading !== null ? percent : active ? clock(remaining) : fmt(t.minutes, { n: minutes })}
            </span>
            <div class="xtra">
              <button type="button" class="ghost" aria-label={t.next} data-tip={t.next} disabled={loading !== null} onClick={() => tts.next()}>
                <SkipIcon ahead />
              </button>
            </div>
            <span class="sep" />
            <button
              type="button"
              class="ghost vb"
              ref={triggers.voice}
              aria-label={fmt(state.voice?.engine ? t.voiceOfHd : t.voiceOf, { v: voiceName })}
              aria-expanded={open === 'voice'}
              aria-haspopup="dialog"
              data-tip={fmt(t.voiceOf, { v: voiceName })}
              data-hint={p.hint ? '' : undefined}
              data-lt="voice"
              onClick={toggle('voice')}
            >
              <VoiceIcon />
              {state.voice?.engine && <i class="dot" />}
            </button>
            <button
              type="button"
              class="speed"
              ref={triggers.speed}
              aria-label={`${t.speed}, ${formatRate(state.rate)}×`}
              aria-expanded={open === 'speed'}
              aria-haspopup="dialog"
              data-tip={t.speed}
              onClick={toggle('speed')}
            >
              {formatRate(state.rate)}×
            </button>
          </>
        )}
        <button type="button" class="ghost hide" aria-label={t.hide} data-tip={t.hide} onClick={p.onHide} data-lt="hide">
          <ChevronIcon dir={hideDir(p)} />
        </button>
      </div>
      {axOn !== null && (
        <button
          type="button"
          class="puck surface"
          ref={triggers.ax}
          aria-label={axOn ? `${t.a11y}, ${t.on}` : t.a11y}
          aria-expanded={open === 'ax'}
          aria-haspopup="dialog"
          data-tip={t.a11yTitle}
          data-lt="ax"
          onClick={toggle('ax')}
        >
          <AccessIcon size={18} />
          {axOn && <i class="dot" />}
        </button>
      )}
    </div>
  )
}

// The hide chevron points at the edge the dock tucks into.
const hideDir = ({ o, x, y }: { o: Orientation; x: number; y: number }): ChevronDir =>
  o === 'h' ? (y < 0.5 ? 'up' : 'down') : x < 0.5 ? 'left' : 'right'

interface PopProps {
  reader: Reader
  state: ReaderState
  t: Strings
  popRef: RefObject<HTMLDivElement | null>
  anchor: RefObject<HTMLElement | null>
  leaving: boolean
}

export const SpeedPop = ({ reader, state, t, popRef, anchor, leaving }: PopProps) => {
  const rangeRef = useRef<HTMLInputElement>(null)
  useEffect(() => rangeRef.current?.focus(), [])
  useAnchor(popRef, anchor)
  const { rate } = state
  return (
    <div class="pop speedpop surface" role="dialog" aria-label={t.speed} ref={popRef} data-leave={leaving ? '' : undefined}>
      <div class="label">
        {t.speed}
        <b>{formatRate(rate)}×</b>
      </div>
      <div class="stepper">
        <button type="button" class="ghost sm" aria-label={t.slower} disabled={rate <= MIN_RATE} onClick={() => reader.setRate(rate - RATE_STEP)}>
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
          style={{ '--p': `${((rate - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100}%` }}
          onInput={(e) => reader.setRate(Number(e.currentTarget.value))}
        />
        <button type="button" class="ghost sm" aria-label={t.faster} disabled={rate >= MAX_RATE} onClick={() => reader.setRate(rate + RATE_STEP)}>
          <PlusIcon />
        </button>
      </div>
      <div class="presets">
        {PRESETS.map((r) => (
          <button key={r} type="button" aria-pressed={rate === r} onClick={() => reader.setRate(r)}>
            {r}×
          </button>
        ))}
      </div>
    </div>
  )
}

const hdDetail = (v: Voice, status: EngineStatus | null, t: Strings): string => {
  if (status?.state === 'loading') return fmt(t.hdLoading, { p: Math.round(status.progress * 100) })
  if (status?.state === 'error') return t.hdUnavailable
  if (status?.state === 'ready' || !v.downloadBytes) return t.hdReady
  return fmt(t.hdSize, { mb: Math.round(v.downloadBytes / 1e6) })
}

export const VoicePop = ({ reader, state, t, lang, popRef, anchor, leaving }: PopProps & { lang: string }) => {
  const listRef = useRef<HTMLDivElement>(null)
  useAnchor(popRef, anchor)
  // HD voices first as their own group; arrow keys walk the list in the order shown.
  const hd = state.voices.filter((v) => v.engine)
  const voices = [...hd, ...state.voices.filter((v) => !v.engine)]
  const hdCount = hd.length
  const hdReady = state.engine?.state === 'ready' || !hd[0]?.downloadBytes
  const current = Math.max(
    0,
    voices.findIndex((v) => v.id === state.voice?.id),
  )
  // Focus lands on the chosen voice, as a radiogroup expects, without scrolling the group headings
  // out of view unless the voice is further down than the list shows.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    el?.focus({ preventScroll: true })
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [])
  const tip = voiceTip(voices, navigator.userAgent, navigator.maxTouchPoints || 0)

  const option = (v: Voice, i: number) => {
    const d = describeVoice(v, lang)
    const on = i === current
    // HD rows show download state only on the chosen voice; the size is said once, in the heading.
    const sub =
      d.kind === 'hd'
        ? on
          ? hdDetail(v, state.engine, t)
          : [v.gender && t[v.gender], d.region].filter(Boolean).join(' · ')
        : [d.region, d.kind === 'online' ? t.online : d.kind === 'device' ? t.device : ''].filter(Boolean).join(' · ')
    return (
      <button key={v.id} type="button" class="opt" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => reader.setVoice(v.id)}>
        <span class="av" aria-hidden="true">
          {d.name.slice(0, 1)}
        </span>
        <span class="n">
          <b>
            {d.name}
            {d.kind === 'natural' && <span class="tag">{t.natural}</span>}
          </b>
          <span class="sub">{sub}</span>
        </span>
        <span class="tick">
          <CheckIcon />
        </span>
      </button>
    )
  }

  return (
    <div class="pop voicepop surface" role="dialog" aria-label={t.voice} ref={popRef} data-leave={leaving ? '' : undefined}>
      {voices.length ? (
        <div
          class="voices"
          role="radiogroup"
          aria-label={t.voice}
          ref={listRef}
          onKeyDown={(e) => radioKeys(e, voices.length, current, (i) => reader.setVoice(voices[i]?.id ?? ''))}
        >
          {hdCount > 0 && (
            <div class="group" aria-hidden="true">
              <b>
                <SparkIcon />
                {t.hdGroup}
              </b>
              <span>{hdReady ? t.hdGroupSub : fmt(t.hdGroupDownload, { mb: Math.round((hd[0]?.downloadBytes ?? 0) / 1e6) })}</span>
            </div>
          )}
          {voices.slice(0, hdCount).map(option)}
          {hdCount > 0 && hdCount < voices.length && (
            <div class="group" aria-hidden="true">
              <b>{t.builtInGroup}</b>
            </div>
          )}
          {voices.slice(hdCount).map((v, i) => option(v, i + hdCount))}
        </div>
      ) : (
        state.voicesLoaded && <p class="empty">{t.noVoice}</p>
      )}
      {tip && !hdCount && <p class="tip">{tip === 'edge' ? t.tipEdge : tip === 'mac' ? t.tipMac : t.tipIos}</p>}
    </div>
  )
}
