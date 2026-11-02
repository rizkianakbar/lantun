// Test double for SpeechDriver: jsdom has no speechSynthesis. Emits boundary events on timers,
// one word every `wordMs / rate` milliseconds.
import type { EngineStatus, SpeakRequest, SpeechDriver, Voice, VoiceEngine } from './types'

export interface FakeDriverOptions {
  wordMs?: number
  boundaries?: boolean
  reliablePause?: boolean
  voices?: Voice[]
  // Error codes returned by the next speak() calls, in order.
  failures?: string[]
  // Number of upcoming utterances that go silent after `stallAfterWords` words and never end.
  stalls?: number
  stallAfterWords?: number
}

export interface FakeDriver extends SpeechDriver {
  spoken: SpeakRequest[]
}

export const createFakeDriver = (o: FakeDriverOptions = {}): FakeDriver => {
  const wordMs = o.wordMs ?? 100
  const failures = [...(o.failures ?? [])]
  let stalls = o.stalls ?? 0
  let timers: ReturnType<typeof setTimeout>[] = []
  const clear = (): void => {
    timers.forEach(clearTimeout)
    timers = []
  }
  const later = (fn: () => void, ms: number): void => {
    timers.push(setTimeout(fn, ms))
  }

  return {
    id: 'fake',
    reliablePause: o.reliablePause ?? false,
    spoken: [],
    getVoices: () => Promise.resolve(o.voices ?? []),
    speak(req, h) {
      clear()
      this.spoken.push(req)
      const failure = failures.shift()
      if (failure) {
        later(() => h.onError({ code: failure, message: failure }), 0)
        return
      }
      const words = Array.from(req.text.matchAll(/\S+/g), (m) => m.index ?? 0)
      const stallAt = stalls > 0 ? (stalls--, Math.min(o.stallAfterWords ?? 1, words.length)) : -1
      const step = wordMs / req.rate
      later(() => h.onStart?.(), 0)
      words.forEach((charIndex, i) => {
        if (stallAt >= 0 && i >= stallAt) return
        if (o.boundaries !== false) later(() => h.onWord(charIndex), i * step)
      })
      if (stallAt < 0) later(h.onEnd, words.length * step)
    },
    pause: () => {},
    resume: () => {},
    cancel: clear,
  }
}

export interface FakeEngine extends VoiceEngine, FakeDriver {
  prepared: SpeakRequest[]
  setStatus(status: EngineStatus): void
}

// Test double for an add-on engine: a fake driver with status reporting and prefetch tracking.
export const createFakeEngine = (id: string, o: FakeDriverOptions = {}): FakeEngine => {
  const base = createFakeDriver({ reliablePause: true, ...o, voices: (o.voices ?? []).map((v) => ({ ...v, engine: id })) })
  let status: EngineStatus = { state: 'idle', progress: 0 }
  const listeners = new Set<(s: EngineStatus) => void>()
  return Object.assign(base, {
    id,
    slowStart: true,
    prepared: [] as SpeakRequest[],
    prepare(req: SpeakRequest) {
      this.prepared.push(req)
    },
    status: () => status,
    subscribe(cb: (s: EngineStatus) => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    setStatus(next: EngineStatus) {
      status = next
      listeners.forEach((cb) => cb(next))
    },
  })
}
