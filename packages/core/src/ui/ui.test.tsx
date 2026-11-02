import { act } from 'preact/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAx, type AxController } from '../a11y/controller'
import { resolveOptions } from '../options'
import { createReader, type Reader } from '../reader'
import { createFakeDriver, createFakeEngine, type FakeDriver } from '../speech/fake-driver'
import type { Voice } from '../speech/types'
import { savePosition, articleKey } from '../state/positions'
import { mountUI, type MountedUI } from './mount'

const ARTICLE = `<h1>Judul artikel uji</h1><article>
  <p>Kalimat pertama di sini. Kalimat kedua juga ada.</p>
  <p>Paragraf kedua dimulai. Lalu kalimat keempat. Dan yang terakhir.</p>
</article>`

let ui: MountedUI | null
let reader: Reader | null
let ax: AxController | null
let driver: FakeDriver

const mount = async ({ tts = true, a11y = true, lang = 'en', voices = [] as Voice[] } = {}) => {
  document.body.innerHTML = ARTICLE
  const opts = resolveOptions({ lang, contentSelector: 'article', color: '#0a7d4f' })
  driver = createFakeDriver({ wordMs: 100, voices })
  reader = tts ? createReader(opts, vi.fn(), { driver }) : null
  ax = a11y ? createAx(document) : null
  await act(async () => {
    ui = mountUI(document, opts, reader, ax)
    await vi.advanceTimersByTimeAsync(300)
  })
}

const root = () => document.querySelector('lantun-reader')?.shadowRoot as ShadowRoot
const $ = <T extends Element = HTMLElement>(sel: string) => root().querySelector<T>(sel)
const byLabel = (label: string) => root().querySelector<HTMLElement>(`[aria-label="${label}"]`)
const press = async (el: Element | null, key: string) =>
  act(() => {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }))
  })
const click = async (el: Element | null) =>
  act(() => {
    ;(el as HTMLElement | null)?.click()
  })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  document.documentElement.className = ''
})
afterEach(() => {
  act(() => ui?.destroy())
  reader?.destroy()
  ax?.destroy()
  ui = reader = ax = null
  vi.useRealTimers()
})

const play = () => $('[data-lt="play"]')
const tick = async (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe('dock', () => {
  it('sits on the right edge with play, speed and accessibility', async () => {
    await mount()
    expect($('.lt')?.dataset.side).toBe('right')
    expect(play()?.getAttribute('aria-label')).toBe('Play')
    expect(play()?.dataset.tip).toBe('Listen · 1 min')
    expect($('.speed')?.textContent).toBe('1×')
    expect(byLabel('Reading aids and accessibility')).not.toBeNull()
    // Session controls exist but stay folded away until playback starts.
    expect($('.rail')?.hasAttribute('data-active')).toBe(false)
  })

  it('follows the page language', async () => {
    await mount({ lang: 'id' })
    expect(play()?.dataset.tip).toBe('Dengarkan · 1 mnt')
    expect(byLabel('Bantuan membaca dan aksesibilitas')).not.toBeNull()
  })

  it('renders only the enabled features', async () => {
    await mount({ a11y: false })
    expect(byLabel('Reading aids and accessibility')).toBeNull()
    act(() => ui?.destroy())
    reader?.destroy()
    await mount({ tts: false })
    expect(play()).toBeNull()
    expect(byLabel('Reading aids and accessibility')).not.toBeNull()
  })

  it('lives in its own shadow root under <html>, outside the article', async () => {
    await mount()
    const host = document.querySelector<HTMLElement>('lantun-reader')
    expect(host?.parentElement).toBe(document.documentElement)
    // Set through the CSSOM, which a strict CSP allows (a style attribute it would block).
    expect(host?.style.getPropertyValue('position')).toBe('fixed')
    expect(host?.style.getPropertyPriority('position')).toBe('important')
  })

  it('gives every style element it adds the page nonce, for strict CSPs', async () => {
    document.body.innerHTML = ARTICLE
    const opts = resolveOptions({ lang: 'en', contentSelector: 'article', nonce: 'r4nd0m' })
    driver = createFakeDriver({ wordMs: 100 })
    reader = createReader(opts, vi.fn(), { driver })
    ax = createAx(document, opts.nonce)
    await act(async () => {
      ui = mountUI(document, opts, reader, ax)
      await vi.advanceTimersByTimeAsync(300)
    })
    await click(play())
    const styles = [...document.querySelectorAll('style'), ...root().querySelectorAll('style')]
    expect(styles.length).toBeGreaterThanOrEqual(2)
    for (const s of styles) expect(s.nonce).toBe('r4nd0m')
  })

  // jsdom lays nothing out (sizes are 0) in a 1024×768 window, so a position is just x·1024, y·768
  // clamped 12 px inside the edges.
  it('starts flush on the publisher side and keeps where the reader puts it', async () => {
    await mount()
    const dock = () => $('.dock')
    expect(dock()?.dataset.o).toBe('v')
    expect(dock()?.style.left).toBe('1012px')
    act(() => ui?.destroy())
    reader?.destroy()
    localStorage.setItem('lantun:dock', JSON.stringify({ x: 0.3, y: 0.25, hidden: false }))
    await mount()
    expect($('.lt')?.dataset.side).toBe('left')
    expect(dock()?.style.left).toBe('307px')
    expect(dock()?.style.top).toBe('192px')
    // Double-clicking the grip sends it back to the middle of its nearest edge.
    await act(() => {
      $('.grip')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    expect(dock()?.style.left).toBe('12px')
    expect(dock()?.style.top).toBe('384px')
  })

  it('lies flat along the bottom when docked there, with its tab on that edge', async () => {
    localStorage.setItem('lantun:dock', JSON.stringify({ x: 0.5, y: 1, o: 'h', hidden: false }))
    await mount()
    expect($('.dock')?.dataset.o).toBe('h')
    expect($('.lt')?.dataset.side).toBe('bottom')
    expect($('.dock')?.style.top).toBe('756px')
    await click(byLabel('Hide'))
    expect($('.lt')?.dataset.side).toBe('bottom')
    expect($('[data-lt="show"]')).not.toBeNull()
  })

  it('hides into an edge tab and comes back, remembering both', async () => {
    await mount()
    await click(byLabel('Hide'))
    expect($('.rail')).toBeNull()
    expect($('[data-lt="show"]')).not.toBeNull()
    act(() => ui?.destroy())
    reader?.destroy()
    await mount()
    expect($('.rail')).toBeNull()
    await click($('[data-lt="show"]'))
    expect($('.rail')).not.toBeNull()
  })
})

describe('playback', () => {
  it('starts reading with one press and grows the session controls', async () => {
    await mount()
    await click(play())
    expect(driver.spoken[0]?.text).toBe('Kalimat pertama di sini.')
    expect(play()?.getAttribute('aria-label')).toBe('Pause')
    expect($('.rail')?.hasAttribute('data-active')).toBe(true)
    expect($('[role="status"]')?.textContent).toBe('')
    await tick(60)
    expect($('[role="status"]')?.textContent).toBe('Playing')
  })

  it('supports the spec keyboard shortcuts', async () => {
    await mount()
    await click(play())
    const rail = $('.rail')
    await press(rail, 'k')
    expect(reader?.store.get().status).toBe('paused')
    await press(rail, ' ')
    expect(reader?.store.get().status).toBe('playing')
    await press(rail, 'ArrowRight')
    expect(reader?.store.get().index).toBe(1)
    await press(rail, 'ArrowLeft')
    expect(reader?.store.get().index).toBe(0)
  })

  it('exposes progress as an accessible progress bar', async () => {
    await mount()
    await click(play())
    const bar = $('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuetext')).toBe('Sentence 1 of 5')
    await click(byLabel('Next sentence'))
    expect(bar?.getAttribute('aria-valuenow')).toBe('2')
  })

  it('changes speed from the popover and closes it with Escape', async () => {
    await mount()
    const chip = $('.speed')
    await click(chip)
    expect($('[role="dialog"]')).not.toBeNull()
    expect(root().activeElement?.classList.contains('range')).toBe(true)
    const preset = Array.from(root().querySelectorAll('.presets button')).find((b) => b.textContent === '1.5×')
    await click(preset ?? null)
    expect(reader?.store.get().rate).toBe(1.5)
    expect(chip?.textContent).toBe('1.5×')
    await press(root().activeElement, 'Escape')
    expect($('[role="dialog"]')).toBeNull()
    expect(root().activeElement).toBe(chip)
  })

  it('lists voices for the language with clean names, and switches voice', async () => {
    await mount({
      lang: 'id',
      voices: [
        { id: 'a', name: 'Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', lang: 'id-ID', local: false, isDefault: false },
        { id: 'b', name: 'Damayanti', lang: 'id-ID', local: true, isDefault: false },
        { id: 'c', name: 'Samantha', lang: 'en-US', local: true, isDefault: false },
      ],
    })
    await click($('[data-lt="voice"]'))
    expect($('[data-lt="voice"]')?.getAttribute('aria-label')).toBe('Suara · Gadis')
    const options = Array.from(root().querySelectorAll('.voices [role="radio"]'))
    expect(root().activeElement).toBe(options[0])
    expect(options.map((o) => o.querySelector('b')?.textContent)).toEqual(['GadisAlami', 'Damayanti'])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect($('.tip')).toBeNull()
    await click(options[1] ?? null)
    expect(reader?.store.get().voice?.id).toBe('b')
  })

  it('continues a half-read article, with a way back to the start', async () => {
    savePosition(articleKey(window.location), 3, 5, 'Lalu kalimat keempat.')
    await mount()
    await click(play())
    expect(driver.spoken[0]?.text).toBe('Lalu kalimat keempat.')
    expect($('.toast')?.textContent).toContain('Continuing from')
    const startOver = Array.from(root().querySelectorAll('.toast button')).find((b) => b.textContent === 'Start over')
    await click(startOver ?? null)
    expect(driver.spoken.at(-1)?.text).toBe('Kalimat pertama di sini.')
    expect($('.toast')).toBeNull()
  })

  it('keeps only accessibility when the browser cannot speak', async () => {
    document.body.innerHTML = ARTICLE
    const opts = resolveOptions({ lang: 'en', contentSelector: 'article' })
    reader = createReader(opts, vi.fn(), { driver: null })
    ax = createAx(document)
    await act(async () => {
      ui = mountUI(document, opts, reader, ax)
    })
    expect(play()).toBeNull()
    expect(byLabel('Reading aids and accessibility')).not.toBeNull()
  })

  it('renders nothing when there is neither speech nor the accessibility panel', async () => {
    document.body.innerHTML = ARTICLE
    const opts = resolveOptions({ lang: 'en', contentSelector: 'article' })
    reader = createReader(opts, vi.fn(), { driver: null })
    await act(async () => {
      ui = mountUI(document, opts, reader, null)
    })
    expect($('.lt')).toBeNull()
  })
})

describe('HD voices', () => {
  const setupHd = async () => {
    await mount({ voices: [{ id: 's', name: 'Samantha', lang: 'en-US', local: true, isDefault: false }] })
    const engine = createFakeEngine('kitten', {
      voices: [{ id: 'kitten:Bella', name: 'Bella', lang: 'en-US', local: true, isDefault: false, downloadBytes: 31e6 }],
    })
    await act(async () => {
      reader?.addEngine(engine)
      await vi.advanceTimersByTimeAsync(10)
    })
    return engine
  }

  it('lists HD voices first with their download size, keeping the built-in voice selected', async () => {
    await setupHd()
    await click($('[data-lt="voice"]'))
    expect(Array.from(root().querySelectorAll('.group b')).map((g) => g.textContent)).toEqual(['Lifelike voices', 'Built-in voices'])
    const options = Array.from(root().querySelectorAll('.voices .opt'))
    expect($('.group span')?.textContent).toBe('Made on your device · one-time 31 MB download')
    expect(options[0]?.textContent).toContain('Bella')
    expect(options[0]?.getAttribute('aria-checked')).toBe('false')
    expect(options[1]?.getAttribute('aria-checked')).toBe('true')
  })

  it('suggests an HD voice once, a couple of sentences into the first listen', async () => {
    await setupHd()
    await click(play())
    expect($('.toast')).toBeNull()
    // Small steps: one act() renders once, and the hint reacts to the sentence index changing.
    for (let i = 0; i < 6; i++) await tick(200)
    expect(reader?.store.get().index).toBeGreaterThanOrEqual(2)
    expect($('.toast')?.textContent).toContain('Try a lifelike one.')
    // The voice button glows while the hint points at it.
    expect($('[data-lt="voice"]')?.hasAttribute('data-hint')).toBe(true)
    await click(Array.from(root().querySelectorAll<HTMLElement>('.toast .btn')).find((b) => b.textContent === 'Choose voice') ?? null)
    expect($('.voicepop')).not.toBeNull()
    expect($('[data-lt="voice"]')?.getAttribute('aria-expanded')).toBe('true')
    expect(localStorage.getItem('lantun:hint-voice')).toBe('true')
  })

  it('marks the voice button with a dot while a lifelike voice is chosen', async () => {
    await setupHd()
    expect($('[data-lt="voice"] .dot')).toBeNull()
    await act(() => reader?.setVoice('kitten:Bella'))
    expect($('[data-lt="voice"] .dot')).not.toBeNull()
    expect($('[data-lt="voice"]')?.getAttribute('aria-label')).toBe('Voice · Bella, lifelike')
  })

  it('shows download progress on the dock, then explains a fallback', async () => {
    const engine = await setupHd()
    reader?.setVoice('kitten:Bella')
    await click(play())
    await act(() => engine.setStatus({ state: 'loading', progress: 0.42 }))
    expect(play()?.dataset.tip).toBe('Preparing Bella · 42% · one-time download, then it works offline')
    expect($('[role="progressbar"]')?.getAttribute('aria-valuetext')).toBe('Preparing Bella · 42%')
    expect($('.time')?.textContent).toBe('42%')
    expect(byLabel('Next sentence')?.hasAttribute('disabled')).toBe(true)
    await act(() => engine.setStatus({ state: 'error', progress: 0, error: 'slow' }))
    expect($('.toast')?.textContent).toContain('This device is too slow for lifelike voices, so Samantha is reading instead.')
    expect(reader?.store.get().voice?.id).toBe('s')
  })
})

describe('accessibility panel', () => {
  const panelButton = (sel: string, text: string) => Array.from(root().querySelectorAll<HTMLElement>(sel)).find((b) => b.textContent === text) ?? null

  it('applies a profile with one click, explains it, and resets it', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    const lowVision = panelButton('.pchip', 'Low vision')
    expect(root().activeElement).toBe(lowVision)
    await click(lowVision)
    expect(lowVision?.getAttribute('aria-pressed')).toBe('true')
    expect($('.hint')?.textContent).toContain('high contrast')
    expect(document.documentElement.classList.contains('ax-contrast-high')).toBe(true)
    expect(document.documentElement.classList.contains('ax-text-130')).toBe(true)
    expect(byLabel('Reading aids and accessibility, on')?.querySelector('.dot')).not.toBeNull()
    await click($('.reset'))
    expect(document.documentElement.classList.contains('ax-contrast-high')).toBe(false)
    expect(($('.reset') as HTMLButtonElement).disabled).toBe(true)
  })

  it('steps text size with the A buttons', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    await click(byLabel('Larger text'))
    await click(byLabel('Larger text'))
    expect(document.documentElement.classList.contains('ax-text-130')).toBe(true)
    expect($('.val b')?.textContent).toBe('130%')
    await click(byLabel('Smaller text'))
    expect(document.documentElement.classList.contains('ax-text-115')).toBe(true)
  })

  it('cycles line height through its levels and back to off', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    const tile = () => byLabel('Line height, Off') ?? root().querySelector<HTMLElement>('[aria-label^="Line height"]')
    for (const n of [1, 2, 3]) {
      await click(tile())
      expect(tile()?.getAttribute('aria-label')).toBe(`Line height, level ${n} of 3`)
    }
    await click(tile())
    expect(tile()?.getAttribute('aria-label')).toBe('Line height, Off')
    expect(document.documentElement.className).not.toMatch(/ax-line/)
  })

  it('keeps the two fonts exclusive', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    await click(panelButton('[role="switch"]', 'Readable font'))
    await click(panelButton('[role="switch"]', 'Dyslexia font'))
    expect(document.documentElement.classList.contains('ax-font-dyslexic')).toBe(true)
    expect(document.documentElement.classList.contains('ax-font-readable')).toBe(false)
    expect(panelButton('[role="switch"]', 'Readable font')?.getAttribute('aria-checked')).toBe('false')
  })

  it('picks a colour mode from a radio group with arrow keys', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    const group = $('.swatches')
    await press(group, 'ArrowRight')
    expect(document.documentElement.classList.contains('ax-contrast-dark')).toBe(true)
    expect(root().activeElement?.textContent).toBe('AaDark')
  })

  it('tiles render the reading guide', async () => {
    await mount()
    await click(byLabel('Reading aids and accessibility'))
    const guide = panelButton('[role="switch"]', 'Reading guide')
    await click(guide)
    expect(guide?.getAttribute('aria-checked')).toBe('true')
    expect($('.guide')).not.toBeNull()
  })

  it('closes with Escape and returns focus to its button', async () => {
    await mount()
    const button = byLabel('Reading aids and accessibility')
    await click(button)
    await press($('.panel'), 'Escape')
    expect($('.panel')).toBeNull()
    expect(root().activeElement).toBe(button)
  })
})
