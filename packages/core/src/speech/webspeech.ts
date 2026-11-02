import type { SpeakHandlers, SpeakRequest, SpeechDriver, Voice } from './types'

const VOICES_TIMEOUT_MS = 1500
// Chrome can drop a speak() issued straight after cancel(); a short gap avoids it (docs/browser-quirks.md).
const AFTER_CANCEL_DELAY_MS = 50

// lib.dom types the speechSynthesis instance on Window but not the utterance constructor.
type SpeechWindow = Window & { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }

export const isWebSpeechSupported = (win: Window = window): boolean =>
  'speechSynthesis' in win && typeof (win as SpeechWindow).SpeechSynthesisUtterance === 'function'

const voiceId = (v: SpeechSynthesisVoice): string => v.voiceURI || v.name

const toVoice = (v: SpeechSynthesisVoice): Voice => ({
  id: voiceId(v),
  name: v.name,
  lang: v.lang,
  local: v.localService,
  isDefault: v.default,
})

export const loadVoices = (synth: SpeechSynthesis, timeoutMs = VOICES_TIMEOUT_MS): Promise<Voice[]> =>
  new Promise((resolve) => {
    const now = synth.getVoices()
    if (now.length) {
      resolve(now.map(toVoice))
      return
    }
    // Chrome fills the list asynchronously; some Safari versions never fire voiceschanged at all.
    const done = (): void => {
      clearTimeout(timer)
      synth.removeEventListener('voiceschanged', done)
      resolve(synth.getVoices().map(toVoice))
    }
    const timer = setTimeout(done, timeoutMs)
    synth.addEventListener('voiceschanged', done)
  })

export const createWebSpeechDriver = (win: Window = window): SpeechDriver => {
  const synth = win.speechSynthesis
  const Utterance = (win as SpeechWindow).SpeechSynthesisUtterance ?? SpeechSynthesisUtterance
  // Strong reference: Chrome garbage-collects in-flight utterances and then never fires onend.
  let current: SpeechSynthesisUtterance | null = null
  let pending: ReturnType<typeof setTimeout> | undefined

  const stop = (): boolean => {
    clearTimeout(pending)
    pending = undefined
    const busy = current !== null || synth.speaking || synth.pending
    current = null
    if (busy) synth.cancel()
    return busy
  }

  const start = (req: SpeakRequest, h: SpeakHandlers): void => {
    const u = new Utterance(req.text)
    u.lang = req.voice?.lang ?? req.lang
    u.rate = req.rate
    const native = req.voice ? synth.getVoices().find((v) => voiceId(v) === req.voice?.id) : undefined
    if (native) u.voice = native
    // Cancelled utterances still fire end/error in some browsers; only the current one may report.
    const live = (): boolean => current === u
    u.onstart = () => {
      if (live()) h.onStart?.()
    }
    u.onboundary = (e) => {
      if (live() && e.name !== 'sentence') h.onWord(e.charIndex)
    }
    u.onend = () => {
      if (!live()) return
      current = null
      h.onEnd()
    }
    u.onerror = (e) => {
      if (!live()) return
      current = null
      h.onError({ code: e.error, message: `Speech failed: ${e.error}` })
    }
    current = u
    // A paused synth (left over from another script) silently queues new utterances forever.
    if (synth.paused) synth.resume()
    synth.speak(u)
  }

  return {
    id: 'webspeech',
    reliablePause: false,
    getVoices: () => loadVoices(synth),
    speak(req, h) {
      if (stop()) pending = setTimeout(() => start(req, h), AFTER_CANCEL_DELAY_MS)
      else start(req, h)
    },
    pause: () => synth.pause(),
    resume: () => synth.resume(),
    cancel: () => {
      stop()
    },
  }
}
