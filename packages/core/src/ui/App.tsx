import { useEffect, useRef, useState } from 'preact/hooks'
import type { AxController } from '../a11y/controller'
import { AX_DEFAULTS, isDefault } from '../a11y/settings'
import type { Reader, ReaderState } from '../reader'
import { describeVoice } from '../speech/voices'
import { loadDock, saveDock, type DockState } from '../state/dock'
import { readJson, writeJson } from '../state/storage'
import { createStore } from '../state/store'
import type { Side } from '../types'
import { ReadingGuide, ReadingMask } from './Aids'
import { A11yPanel } from './A11yPanel'
import { Bars } from './controls'
import { useAnchor, useDismiss, useNarrow, usePresence, useStore, type DockDrop } from './hooks'
import { fmt, formatRate, type Strings } from './i18n'
import { ChevronIcon, CloseIcon, SparkIcon, type ChevronDir } from './icons'
import { PlayHere } from './PlayHere'
import { Dock, SpeedPop, VoicePop, type Pop, type Triggers } from './Rail'

export interface AppProps {
  reader: Reader | null
  ax: AxController | null
  t: Strings
  lang: string
  side: Side
  accent: string
  accentInk: string
}

interface Toast {
  text: string
  // The one-time voice hint: marked with a sparkle, and the voice button glows while it shows.
  voiceHint?: boolean
  action?: { label: string; run: () => void }
}

const TOAST_MS = 7000

type Edge = 'left' | 'right' | 'top' | 'bottom'
// The hidden tab's chevron points out of its edge, toward where the dock comes back.
const OUT_OF: Record<Edge, ChevronDir> = { left: 'right', right: 'left', top: 'down', bottom: 'up' }
// Exit animations, matched in styles.ts.
const LEAVE_MS = 160
// Sentences into the first listen before suggesting other voices: by then the reader has heard
// the default one, and the start of the article is not interrupted.
const HINT_AFTER = 2
const HINT_KEY = 'hint-voice'

// Stand-ins so hooks run unconditionally when a feature is switched off.
const noReader = createStore<ReaderState>({
  status: 'idle',
  index: 0,
  total: 0,
  progress: 0,
  duration: 0,
  remaining: 0,
  remainingAfter: 0,
  rate: 1,
  voices: [],
  voice: null,
  voicesLoaded: true,
  resume: null,
  issue: null,
  engine: null,
  fallback: null,
})
const noAx = createStore({ ...AX_DEFAULTS })

const focusIn = (root: HTMLElement | null, selector: string): void => {
  requestAnimationFrame(() => root?.querySelector<HTMLElement>(selector)?.focus())
}

export const App = ({ reader, ax, t, lang, side, accent, accentInk }: AppProps) => {
  const state = useStore(reader?.store ?? noReader)
  const axs = useStore(ax?.store ?? noAx)
  const [dock, setDock] = useState<DockState>(() => loadDock(side === 'left' ? 0 : 1))
  const [open, setOpen] = useState<Pop | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [message, setMessage] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const triggers: Triggers = { speed: useRef(null), voice: useRef(null), ax: useRef(null) }
  const popRef = useRef<HTMLDivElement>(null)
  const toastRef = useRef<HTMLDivElement>(null)
  const playing = state.status === 'playing'
  const tts = !!reader && state.issue !== 'unsupported' && state.issue !== 'no-content'
  // Phones always get the flat dock along the bottom; elsewhere it is wherever the reader put it.
  const narrow = useNarrow()
  const place = narrow ? { x: 0.5, y: 1, o: 'h' as const } : dock
  // Where the dock tucks away to, and which way tooltips open: its nearest edge.
  const edge: Edge = place.o === 'h' ? (place.y < 0.5 ? 'top' : 'bottom') : place.x < 0.5 ? 'left' : 'right'
  const still = axs.still
  const railShown = usePresence(!dock.hidden, LEAVE_MS, still)
  const tabShown = usePresence(dock.hidden, LEAVE_MS, still)
  const pop = usePresence(dock.hidden ? null : open, LEAVE_MS, still)
  const toastShown = usePresence(!dock.hidden && !open ? toast : null, LEAVE_MS, still)

  const announce = (msg: string): void => {
    // Re-setting identical text is not re-announced by screen readers; clear first.
    setMessage('')
    setTimeout(() => setMessage(msg), 50)
  }

  const notify = (next: Toast): void => {
    setToast(next)
    announce(next.text)
  }

  const updateDock = (patch: Partial<DockState>): void => {
    setDock((d) => {
      const next = { ...d, ...patch }
      saveDock(next)
      return next
    })
  }

  // Announce state changes the reader did not directly cause with a click on that control.
  const prev = useRef(state)
  useEffect(() => {
    const p = prev.current
    prev.current = state
    if (p.status !== state.status) {
      if (state.status === 'playing') announce(t.playing)
      else if (state.status === 'paused') announce(t.paused)
      else if (state.status === 'ended') announce(t.finished)
    }
    if (p.rate !== state.rate) announce(fmt(t.speedSet, { r: formatRate(state.rate) }))
    if (p.voice && state.voice && p.voice.id !== state.voice.id) announce(fmt(t.voiceSet, { v: describeVoice(state.voice, lang).name }))
    if (state.fallback && state.fallback !== p.fallback) {
      const v = state.fallback.voice ? describeVoice(state.fallback.voice, lang).name : t.voice
      notify({ text: fmt(state.fallback.reason === 'slow' ? t.hdSlow : t.hdFailed, { v }) })
    }
    // The browser refused to start audio without a click (programmatic play()).
    if (state.issue === 'not-allowed' && p.issue !== 'not-allowed') notify({ text: t.notAllowed, action: { label: t.play, run: () => reader?.play() } })
    // Once ever, point out that the voice can be changed: readers rarely find it on their own.
    if (state.status === 'playing' && state.index >= HINT_AFTER && p.index < HINT_AFTER && !toast && !open && state.voices.length > 1 && !state.voice?.engine && readJson(HINT_KEY) !== true) {
      writeJson(HINT_KEY, true)
      const hd = state.voices.some((v) => v.engine)
      notify({ text: hd ? t.tryHd : fmt(t.tryVoice, { n: state.voices.length }), voiceHint: true, action: { label: t.chooseVoice, run: () => setOpen('voice') } })
    }
  }, [state])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(id)
  }, [toast])

  useDismiss(open !== null, [popRef, triggers.speed, triggers.voice, triggers.ax], () => setOpen(null))
  useAnchor(toastRef, dockRef)

  const closePop = (): void => {
    const trigger = open && triggers[open]
    setOpen(null)
    trigger?.current?.focus()
  }

  // One press to listen. A saved position is picked up straight away, with a way back to the
  // start, rather than asking first.
  const toggle = (): void => {
    if (!reader) return
    if (playing) return reader.pause()
    const resume = state.resume
    if (!resume) return reader.play()
    reader.play(resume.index)
    notify({ text: fmt(t.resumed, { p: Math.round(resume.progress * 100) }), action: { label: t.startOver, run: () => reader.play(0) } })
  }

  if (!tts && !ax) return null

  const hide = (): void => {
    setOpen(null)
    setToast(null)
    updateDock({ hidden: true })
    focusIn(root.current, '[data-lt="show"]')
  }

  return (
    <div
      class="lt"
      ref={root}
      data-side={edge}
      data-still={still ? '' : undefined}
      style={{ '--a': accent, '--ai': accentInk }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return
        e.preventDefault()
        closePop()
      }}
    >
      {/* First, so the dock and panels paint above the guide and mask. */}
      {axs.guide && <ReadingGuide />}
      {axs.mask && <ReadingMask />}
      {tabShown.shown && (
        <button
          type="button"
          class={`tab surface${playing ? ' on' : ''}`}
          aria-label={t.show}
          style={{ '--x': place.x, '--y': place.y }}
          data-lt="show"
          data-leave={tabShown.leaving ? '' : undefined}
          tabIndex={tabShown.leaving ? -1 : undefined}
          onClick={() => {
            updateDock({ hidden: false })
            focusIn(root.current, '[data-lt="hide"]')
          }}
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
          x={place.x}
          y={place.y}
          o={place.o}
          open={open}
          leaving={railShown.leaving}
          hint={!!toastShown.shown?.voiceHint && !toastShown.leaving}
          axOn={ax ? !isDefault(axs) : null}
          dockRef={dockRef}
          triggers={triggers}
          onToggle={toggle}
          onOpen={setOpen}
          onHide={hide}
          onMove={(drop: DockDrop) => updateDock(drop)}
        />
      )}
      {pop.shown === 'speed' && reader && <SpeedPop reader={reader} state={state} t={t} popRef={popRef} anchor={triggers.speed} leaving={pop.leaving} />}
      {pop.shown === 'voice' && reader && <VoicePop reader={reader} state={state} t={t} lang={lang} popRef={popRef} anchor={triggers.voice} leaving={pop.leaving} />}
      {pop.shown === 'ax' && ax && <A11yPanel ax={ax} s={axs} t={t} panelRef={popRef} anchor={triggers.ax} onClose={closePop} announce={announce} leaving={pop.leaving} />}
      {toastShown.shown && (
        <div class="toast surface" ref={toastRef} data-leave={toastShown.leaving ? '' : undefined}>
          {toastShown.shown.voiceHint && <SparkIcon size={16} />}
          <span>{toastShown.shown.text}</span>
          {toastShown.shown.action && (
            <button
              type="button"
              class="btn primary"
              onClick={() => {
                toast?.action?.run()
                setToast(null)
              }}
            >
              {toastShown.shown.action.label}
            </button>
          )}
          <button type="button" class="ghost sm" aria-label={t.dismiss} onClick={() => setToast(null)}>
            <CloseIcon size={16} />
          </button>
        </div>
      )}
      {tts && reader && <PlayHere reader={reader} t={t} current={playing ? state.index : null} onPlay={(index) => reader.play(index)} />}
      <div class="sr" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  )
}
