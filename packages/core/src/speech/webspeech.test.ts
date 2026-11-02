import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeakHandlers } from './types'
import { createWebSpeechDriver, isWebSpeechSupported, loadVoices } from './webspeech'

class MockUtterance {
  lang = ''
  rate = 1
  voice: unknown = null
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onboundary: ((e: { name?: string; charIndex: number }) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  constructor(public text: string) {}
}

const nativeVoice = (name: string, lang: string, localService = true) => ({ name, lang, voiceURI: name, localService, default: false })

class MockSynth extends EventTarget {
  speaking = false
  pending = false
  paused = false
  voices: ReturnType<typeof nativeVoice>[] = []
  queue: MockUtterance[] = []
  getVoices = () => this.voices
  speak = vi.fn((u: MockUtterance) => {
    this.queue.push(u)
    this.speaking = true
  })
  cancel = vi.fn(() => {
    // Chrome reports the cancelled utterance as an "interrupted" error.
    for (const u of this.queue.splice(0)) u.onerror?.({ error: 'interrupted' })
    this.speaking = false
  })
  pause = vi.fn()
  resume = vi.fn(() => {
    this.paused = false
  })
}

const handlers = (): SpeakHandlers => ({ onWord: vi.fn(), onEnd: vi.fn(), onError: vi.fn(), onStart: vi.fn() })
const req = (text: string) => ({ text, lang: 'id-ID', rate: 1.5, voice: null })

let synth: MockSynth
let win: Window

beforeEach(() => {
  vi.useFakeTimers()
  synth = new MockSynth()
  win = { speechSynthesis: synth, SpeechSynthesisUtterance: MockUtterance } as unknown as Window
})
afterEach(() => vi.useRealTimers())

describe('createWebSpeechDriver', () => {
  it('detects support', () => {
    expect(isWebSpeechSupported(win)).toBe(true)
    expect(isWebSpeechSupported({} as Window)).toBe(false)
  })

  it('passes text, lang, rate and the chosen voice', () => {
    synth.voices = [nativeVoice('Damayanti', 'id-ID')]
    const driver = createWebSpeechDriver(win)
    driver.speak({ ...req('Halo.'), voice: { id: 'Damayanti', name: 'Damayanti', lang: 'id-ID', local: true, isDefault: false } }, handlers())
    const u = synth.queue[0]
    expect(u).toMatchObject({ text: 'Halo.', lang: 'id-ID', rate: 1.5 })
    expect(u?.voice).toBe(synth.voices[0])
  })

  it('forwards word boundaries but not sentence boundaries', () => {
    const driver = createWebSpeechDriver(win)
    const h = handlers()
    driver.speak(req('Satu dua.'), h)
    const u = synth.queue[0] as MockUtterance
    u.onboundary?.({ name: 'word', charIndex: 5 })
    u.onboundary?.({ name: 'sentence', charIndex: 0 })
    u.onboundary?.({ charIndex: 7 }) // some engines omit the name
    expect(h.onWord).toHaveBeenCalledTimes(2)
    u.onend?.()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('silences a replaced utterance and waits briefly before speaking the next', () => {
    const driver = createWebSpeechDriver(win)
    const first = handlers()
    const second = handlers()
    driver.speak(req('One.'), first)
    const old = synth.queue[0] as MockUtterance
    driver.speak(req('Two.'), second)
    expect(first.onError).not.toHaveBeenCalled() // the "interrupted" from cancel() is swallowed
    expect(synth.speak).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(50)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    old.onend?.()
    expect(first.onEnd).not.toHaveBeenCalled()
  })

  it('does not cancel when nothing is playing', () => {
    const driver = createWebSpeechDriver(win)
    driver.speak(req('One.'), handlers())
    expect(synth.cancel).not.toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('unsticks a paused synth before speaking', () => {
    synth.paused = true
    createWebSpeechDriver(win).speak(req('One.'), handlers())
    expect(synth.resume).toHaveBeenCalled()
  })

  it('reports errors from the current utterance', () => {
    const h = handlers()
    createWebSpeechDriver(win).speak(req('One.'), h)
    synth.queue[0]?.onerror?.({ error: 'synthesis-failed' })
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'synthesis-failed' }))
  })
})

describe('loadVoices', () => {
  it('returns voices immediately when available', async () => {
    synth.voices = [nativeVoice('Samantha', 'en-US')]
    await expect(loadVoices(synth as unknown as SpeechSynthesis)).resolves.toEqual([
      { id: 'Samantha', name: 'Samantha', lang: 'en-US', local: true, isDefault: false },
    ])
  })

  it('waits for voiceschanged', async () => {
    const p = loadVoices(synth as unknown as SpeechSynthesis)
    synth.voices = [nativeVoice('Google Bahasa Indonesia', 'id-ID', false)]
    synth.dispatchEvent(new Event('voiceschanged'))
    await expect(p).resolves.toHaveLength(1)
  })

  it('gives up after a timeout when voiceschanged never fires', async () => {
    const p = loadVoices(synth as unknown as SpeechSynthesis, 1500)
    vi.advanceTimersByTime(1500)
    await expect(p).resolves.toEqual([])
  })
})
