// Silent stand-in for speechSynthesis, injected before page scripts run. Real voices are
// unavailable (and audible) in CI; this fires the same events on a fast timer.
export const installSpeechStub = ({ boundaries = true, wordMs = 25 } = {}): void => {
  type Utter = {
    text: string
    rate: number
    onstart?: () => void
    onend?: () => void
    onboundary?: (e: { name: string; charIndex: number }) => void
  }
  let timers: number[] = []
  const synth = Object.assign(new EventTarget(), {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [{ name: 'Stub', lang: 'en-US', voiceURI: 'stub', localService: true, default: true }],
    speak(u: Utter) {
      synth.speaking = true
      ;((window as unknown as { __spoken?: string[] }).__spoken ??= []).push(u.text)
      const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
      const starts = Array.from(u.text.matchAll(/\S+/g), (m) => m.index ?? 0)
      later(() => u.onstart?.(), 0)
      if (boundaries) starts.forEach((i, n) => later(() => u.onboundary?.({ name: 'word', charIndex: i }), n * wordMs))
      later(() => {
        synth.speaking = false
        u.onend?.()
      }, starts.length * wordMs + 5)
    },
    cancel() {
      timers.forEach(clearTimeout)
      timers = []
      synth.speaking = false
    },
    pause() {},
    resume() {},
  })
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  ;(window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    rate = 1
    lang = ''
    voice = null
    constructor(public text: string) {}
  }
}
