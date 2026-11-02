import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveOptions } from './options'
import { createReader, type Reader } from './reader'
import { createFakeDriver, createFakeEngine, type FakeDriverOptions } from './speech/fake-driver'
import type { SpeechDriver, Voice } from './speech/types'

const ARTICLE = `<article>
  <p>Kalimat pertama di sini. Kalimat kedua juga ada.</p>
  <p>Paragraf kedua dimulai. Lalu kalimat keempat. Dan yang terakhir.</p>
</article>`

const opts = resolveOptions({ lang: 'id', contentSelector: 'article' })
const readers: Reader[] = []

const setup = (driver: SpeechDriver | null = createFakeDriver({ wordMs: 100 }), html = ARTICLE) => {
  document.body.innerHTML = html
  const emit = vi.fn()
  const reader = createReader(opts, emit, { driver })
  readers.push(reader)
  return { reader, emit, s: () => reader.store.get() }
}

const voice = (name: string, lang = 'id-ID', local = true): Voice => ({ id: name, name, lang, local, isDefault: false })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  readers.splice(0).forEach((r) => r.destroy())
  vi.useRealTimers()
})

describe('createReader', () => {
  it('prepares the article in idle time so the length is known before play', () => {
    const { s } = setup()
    expect(s().total).toBe(0)
    vi.advanceTimersByTime(250)
    expect(s().total).toBe(5)
    expect(s().duration).toBeGreaterThan(0)
  })

  it('plays through, tracking position and time left, then resets', () => {
    const { reader, emit, s } = setup()
    reader.play()
    expect(s().status).toBe('playing')
    const before = s().remaining
    vi.advanceTimersByTime(1500)
    expect(s().index).toBeGreaterThan(0)
    expect(s().progress).toBeGreaterThan(0)
    expect(s().remaining).toBeLessThan(before)
    vi.runAllTimers()
    expect(s()).toMatchObject({ status: 'ended', index: 0, progress: 0 })
    expect(emit).toHaveBeenCalledWith('end', undefined)
  })

  it('offers to resume where the reader left off, and forgets it after finishing', () => {
    const first = setup()
    first.reader.play()
    vi.advanceTimersByTime(1300) // past the paragraph break, into sentence 3
    first.reader.pause()
    const reached = first.s().index
    expect(reached).toBeGreaterThan(1)
    first.reader.destroy()

    const second = setup(createFakeDriver({ wordMs: 100 }))
    vi.advanceTimersByTime(250)
    expect(second.s().resume?.index).toBe(reached)
    second.reader.play(reached)
    expect(second.s().resume).toBeNull()
    vi.runAllTimers()
    second.reader.destroy()

    const third = setup()
    vi.advanceTimersByTime(250)
    expect(third.s().resume).toBeNull()
  })

  it('starts from the selected sentence', () => {
    const driver = createFakeDriver()
    const { reader } = setup(driver)
    const p = document.querySelectorAll('p')[1]?.firstChild as Text
    const range = document.createRange()
    range.setStart(p, p.data.indexOf('Lalu'))
    range.setEnd(p, p.data.indexOf('Lalu') + 4)
    document.getSelection()?.addRange(range)
    reader.play()
    expect(driver.spoken[0]?.text).toBe('Lalu kalimat keempat.')
    // A selection left on the page does not drag later resumes back to it.
    reader.seek(0)
    reader.pause()
    reader.play()
    expect(driver.spoken.at(-1)?.text).toBe('Kalimat pertama di sini.')
    document.getSelection()?.removeAllRanges()
  })

  it('clamps speed even before playback has started', () => {
    const { reader, s } = setup()
    reader.setRate(9)
    expect(s().rate).toBe(3)
  })

  it('seeks by fraction of the article', () => {
    const { reader, s } = setup()
    reader.seekTo(0.99)
    expect(s().index).toBe(4)
    reader.seekTo(0)
    expect(s().index).toBe(0)
  })

  it('persists speed and the chosen voice per language', async () => {
    const voices = [voice('Damayanti'), voice('Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', 'id-ID', false), voice('Bubbles', 'id-ID')]
    const { reader, s } = setup(createFakeDriver({ voices }))
    await vi.advanceTimersByTimeAsync(0)
    expect(s().voices.map((v) => v.name)).toEqual(['Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', 'Damayanti'])
    expect(s().voice?.name).toContain('Gadis')
    reader.setVoice('Damayanti')
    reader.setRate(1.75)
    expect(s()).toMatchObject({ rate: 1.75 })
    reader.destroy()

    const again = setup(createFakeDriver({ voices }))
    await vi.advanceTimersByTimeAsync(0)
    expect(again.s()).toMatchObject({ rate: 1.75 })
    expect(again.s().voice?.id).toBe('Damayanti')
  })

  it('slower speed means more time left', () => {
    const { reader, s } = setup()
    vi.advanceTimersByTime(250)
    const atOne = s().duration
    reader.setRate(0.5)
    expect(s().duration).toBeCloseTo(atOne * 2)
  })

  it('reports unsupported browsers and pages without an article', () => {
    const none = setup(null)
    expect(none.s().issue).toBe('unsupported')
    none.reader.play()
    expect(none.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'unsupported' }))

    const empty = setup(createFakeDriver(), '<article></article>')
    empty.reader.play()
    expect(empty.s().issue).toBe('no-content')
    expect(empty.emit).toHaveBeenCalledWith('error', expect.objectContaining({ code: 'no-content' }))
  })

  it('re-extracts when the article is replaced (client-side navigation)', () => {
    const driver = createFakeDriver()
    const { reader } = setup(driver)
    vi.advanceTimersByTime(250)
    document.body.innerHTML = '<article><p>Artikel baru sama sekali.</p></article>'
    reader.play()
    expect(driver.spoken[0]?.text).toBe('Artikel baru sama sekali.')
  })

  it('keeps resume positions per URL across client-side navigation', () => {
    const { reader, s } = setup()
    reader.play()
    vi.advanceTimersByTime(1300)
    reader.pause()
    const firstUrl = window.location.href
    const saved = () => JSON.stringify(localStorage.getItem('lantun:positions'))
    expect(saved()).toContain(firstUrl)

    history.pushState(null, '', '/next-article')
    document.body.innerHTML = '<article><p>Artikel baru dimulai. Kalimat kedua artikel baru. Kalimat ketiga.</p></article>'
    reader.play()
    vi.advanceTimersByTime(800)
    reader.pause()
    expect(s().index).toBeGreaterThan(0)
    // The new article saved under its own URL; the first article's position is untouched.
    expect(saved()).toContain('/next-article')
    expect(saved()).toContain(firstUrl)
    history.pushState(null, '', firstUrl)
  })

  it('pauses on pagehide', () => {
    const { reader, s } = setup()
    reader.play()
    window.dispatchEvent(new Event('pagehide'))
    expect(s().status).toBe('paused')
  })

  it('highlights the current sentence and word, and clears at the end', () => {
    class FakeHighlight extends Set<Range> {
      priority = 0
    }
    const registry = new Map<string, FakeHighlight>()
    const win = Object.assign(Object.create(window), { CSS: { highlights: registry }, Highlight: FakeHighlight, location: window.location }) as Window
    document.body.innerHTML = ARTICLE
    const reader = createReader(opts, vi.fn(), { driver: createFakeDriver({ wordMs: 100 }), win })
    readers.push(reader)
    reader.play()
    vi.advanceTimersByTime(150)
    expect([...(registry.get('lantun-sentence') ?? [])][0]?.toString()).toBe('Kalimat pertama di sini.')
    expect([...(registry.get('lantun-word') ?? [])][0]?.toString()).toBe('pertama')
    vi.runAllTimers()
    expect(registry.get('lantun-word')?.size).toBe(0)
    reader.destroy()
    expect(registry.size).toBe(0)
  })

  it('falls back to estimated words for a voice without boundaries', () => {
    const { reader, emit } = setup(createFakeDriver({ boundaries: false, wordMs: 400 }))
    reader.play()
    vi.runAllTimers()
    const words = emit.mock.calls.filter(([e]) => e === 'word').map(([, p]) => p)
    expect(words.length).toBeGreaterThan(0)
    expect(words.every((w) => w.estimated)).toBe(true)
  })

  it('reports not-allowed so the UI can ask for a click', () => {
    const { reader, s } = setup(createFakeDriver({ failures: ['not-allowed'] } satisfies FakeDriverOptions))
    reader.play()
    vi.runAllTimers()
    expect(s()).toMatchObject({ issue: 'not-allowed', status: 'idle' })
  })
})

describe('add-on voice engines', () => {
  const hd = (name: string) => ({ ...voice(name), downloadBytes: 28e6 })

  it('lists engine voices but never picks one for the reader', async () => {
    const { reader, s } = setup(createFakeDriver({ voices: [voice('Damayanti')] }))
    reader.addEngine(createFakeEngine('kitten', { voices: [hd('Bella')] }))
    await vi.advanceTimersByTimeAsync(10)
    expect(s().voices.map((x) => x.id)).toEqual(['Bella', 'Damayanti'])
    expect(s().voice?.id).toBe('Damayanti')
    expect(s().engine).toBeNull()
  })

  it('speaks through the engine once chosen, prefetches the next sentence, and tracks its status', async () => {
    const engine = createFakeEngine('kitten', { voices: [hd('Bella')] })
    const { reader, s } = setup(createFakeDriver({ voices: [voice('Damayanti')] }))
    reader.addEngine(engine)
    await vi.advanceTimersByTimeAsync(300)
    reader.setVoice('Bella')
    expect(s().engine).toEqual({ state: 'idle', progress: 0 })
    // Choosing the voice already gets the first sentence synthesising.
    expect(engine.prepared[0]?.text).toBe('Kalimat pertama di sini.')
    reader.play()
    expect(engine.spoken[0]?.text).toBe('Kalimat pertama di sini.')
    expect(engine.prepared[1]?.text).toBe('Kalimat kedua juga ada.')
    engine.setStatus({ state: 'loading', progress: 0.4 })
    expect(s().engine).toEqual({ state: 'loading', progress: 0.4 })
  })

  it('hands over to a built-in voice when the engine is too slow, and forgets the choice', async () => {
    const engine = createFakeEngine('kitten', { voices: [hd('Bella')] })
    const { reader, s } = setup(createFakeDriver({ voices: [voice('Damayanti')] }))
    reader.addEngine(engine)
    await vi.advanceTimersByTimeAsync(300)
    reader.setVoice('Bella')
    reader.play()
    engine.setStatus({ state: 'error', progress: 0, error: 'slow' })
    expect(s().voice?.id).toBe('Damayanti')
    expect(s().fallback).toEqual({ reason: 'slow', voice: expect.objectContaining({ id: 'Damayanti' }) })
    expect(JSON.parse(localStorage.getItem('lantun:settings') ?? '{}').voices?.id).toBeUndefined()
  })

  it('makes a browser without speech usable once an engine registers', async () => {
    const { reader, s } = setup(null)
    expect(s().issue).toBe('unsupported')
    reader.addEngine(createFakeEngine('kitten', { voices: [hd('Bella')] }))
    await vi.advanceTimersByTimeAsync(300)
    expect(s().issue).toBeNull()
    expect(s().total).toBe(5)
    expect(s().voice?.id).toBe('Bella')
  })
})
