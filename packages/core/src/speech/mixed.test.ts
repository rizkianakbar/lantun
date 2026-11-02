import { describe, expect, it, vi } from 'vitest'
import { createFakeDriver, createFakeEngine } from './fake-driver'
import { createMixedDriver } from './mixed'
import type { Voice } from './types'

const v = (id: string, engine?: string): Voice => ({ id, name: id, lang: 'en-US', local: true, isDefault: false, engine })
const handlers = () => ({ onWord: vi.fn(), onEnd: vi.fn(), onError: vi.fn() })

describe('createMixedDriver', () => {
  it('lists built-in and engine voices together', async () => {
    const mixed = createMixedDriver(createFakeDriver({ voices: [v('Samantha')] }))
    mixed.add(createFakeEngine('kitten', { voices: [v('Bella')] }))
    expect((await mixed.getVoices()).map((x) => `${x.id}:${x.engine ?? '-'}`)).toEqual(['Samantha:-', 'Bella:kitten'])
  })

  it('routes each utterance to the engine that owns the voice, cancelling the other', () => {
    const base = createFakeDriver()
    const engine = createFakeEngine('kitten')
    const mixed = createMixedDriver(base)
    mixed.add(engine)
    const cancel = vi.spyOn(base, 'cancel')
    mixed.speak({ text: 'Hi.', lang: 'en', rate: 1, voice: v('Bella', 'kitten') }, handlers())
    expect(engine.spoken).toHaveLength(1)
    expect(cancel).toHaveBeenCalled()
    expect(mixed.reliablePause).toBe(true)
    expect(mixed.slowStart).toBe(true)
    mixed.speak({ text: 'Hi.', lang: 'en', rate: 1, voice: v('Samantha') }, handlers())
    expect(base.spoken).toHaveLength(1)
    expect(mixed.reliablePause).toBe(false)
  })

  it('passes prefetch hints only to engines that support them', () => {
    const engine = createFakeEngine('kitten')
    const mixed = createMixedDriver(createFakeDriver())
    mixed.add(engine)
    mixed.prepare?.({ text: 'Next.', lang: 'en', rate: 1, voice: v('Bella', 'kitten') })
    mixed.prepare?.({ text: 'Other.', lang: 'en', rate: 1, voice: v('Samantha') })
    expect(engine.prepared.map((r) => r.text)).toEqual(['Next.'])
  })

  it('reports an error when nothing can speak the voice', () => {
    const h = handlers()
    createMixedDriver(null).speak({ text: 'Hi.', lang: 'en', rate: 1, voice: null }, h)
    expect(h.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'unsupported' }))
  })
})
