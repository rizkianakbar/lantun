import { describe, expect, it } from 'vitest'
import type { Voice } from './types'
import { describeVoice, listVoices, pickVoice, voiceQuality, voicesFor, voiceTip } from './voices'

const v = (id: string, lang: string, local = true, isDefault = false): Voice => ({ id, name: id, lang, local, isDefault })

const VOICES = [
  v('Samantha', 'en-US'),
  v('Google UK English Female', 'en-GB', false),
  v('Daniel', 'en-GB'),
  v('Google Bahasa Indonesia', 'id-ID', false),
  v('Damayanti', 'id-ID'),
  v('Thomas', 'fr-FR'),
]

describe('voicesFor', () => {
  it('lists only voices for the page language', () => {
    expect(voicesFor(VOICES, 'id').map((x) => x.id)).toEqual(['Google Bahasa Indonesia', 'Damayanti'])
  })

  it('understands Android tags like in_ID', () => {
    expect(voicesFor([v('Android', 'in_ID'), v('x', 'en_US')], 'id-ID').map((x) => x.id)).toEqual(['Android'])
  })
})

describe('voiceQuality', () => {
  it('ranks neural > Google > device > other online > SAPI desktop > robotic', () => {
    expect(voiceQuality(v('Microsoft Gadis Online (Natural) - Indonesian (Indonesia)', 'id-ID', false))).toBe(5)
    expect(voiceQuality(v('Ava (Premium)', 'en-US'))).toBe(5)
    expect(voiceQuality(v('Google US English', 'en-US', false))).toBe(4)
    expect(voiceQuality(v('Samantha', 'en-US'))).toBe(3)
    expect(voiceQuality(v('Some Online Voice', 'en-US', false))).toBe(2)
    expect(voiceQuality(v('Microsoft David - English (United States)', 'en-US'))).toBe(1)
    expect(voiceQuality(v('Fred', 'en-US'))).toBe(0)
  })
})

describe('listVoices', () => {
  it('sorts best first and hides novelty voices', () => {
    const list = listVoices(
      [v('Bubbles', 'en-US'), v('Microsoft David - English (United States)', 'en-US'), v('Google US English', 'en-US', false), v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false), v('Samantha', 'en-US')],
      'en-US',
    )
    expect(list.map((x) => x.id)).toEqual([
      'Microsoft Aria Online (Natural) - English (United States)',
      'Google US English',
      'Samantha',
      'Microsoft David - English (United States)',
    ])
  })
})

describe('pickVoice', () => {
  it('prefers Chrome\'s Google voices over compact device voices', () => {
    expect(pickVoice(VOICES, 'id')?.id).toBe('Google Bahasa Indonesia')
  })

  it('prefers local voices over unknown network ones', () => {
    expect(pickVoice([v('Remote', 'id-ID', false), v('Damayanti', 'id-ID')], 'id')?.id).toBe('Damayanti')
  })

  it('prefers a neural voice over everything else', () => {
    const natural = v('Microsoft Ardi Online (Natural) - Indonesian (Indonesia)', 'id-ID', false)
    expect(pickVoice([...VOICES, natural], 'id')?.id).toBe(natural.id)
  })

  it('prefers the exact region among equals', () => {
    expect(pickVoice(VOICES, 'en-GB')?.id).toBe('Google UK English Female')
    // The right accent beats a better voice for another region.
    expect(pickVoice(VOICES, 'en-US')?.id).toBe('Samantha')
  })

  it('honours a saved choice when it still matches the language', () => {
    expect(pickVoice(VOICES, 'id', 'Damayanti')?.id).toBe('Damayanti')
    expect(pickVoice(VOICES, 'id', 'Samantha')?.id).toBe('Google Bahasa Indonesia')
  })

  it('returns null when no voice speaks the language', () => {
    expect(pickVoice(VOICES, 'ja')).toBeNull()
  })
})

describe('describeVoice', () => {
  it.each([
    ['Microsoft Ardi Online (Natural) - Indonesian (Indonesia)', 'id-ID', false, { name: 'Ardi', region: 'Indonesia', kind: 'natural' }],
    ['Ava (Premium)', 'en-US', true, { name: 'Ava', region: 'United States', kind: 'natural' }],
    ['Google UK English Female', 'en-GB', false, { name: 'Google UK English Female', region: 'United Kingdom', kind: 'online' }],
    ['Eddy (English (US))', 'en-US', true, { name: 'Eddy', region: 'United States', kind: 'device' }],
  ] as const)('%s', (name, lang, local, expected) => {
    expect(describeVoice(v(name, lang, local), 'en')).toEqual(expected)
  })
})

describe('voiceTip', () => {
  const plain = [v('Samantha', 'en-US')]
  const UA = {
    chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
    safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0',
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  }

  it('says nothing when a natural voice is already there', () => {
    expect(voiceTip([...plain, v('Ava (Premium)', 'en-US')], UA.chromeMac, 0)).toBeNull()
  })

  it('points each platform at its own natural voices', () => {
    expect(voiceTip(plain, UA.chromeMac, 0)).toBe('edge')
    expect(voiceTip(plain, UA.safariMac, 0)).toBe('mac')
    expect(voiceTip(plain, UA.safariMac, 5)).toBe('ios') // iPadOS reports itself as a Mac
    expect(voiceTip(plain, UA.iphone, 5)).toBe('ios')
    expect(voiceTip(plain, UA.edgeWin, 0)).toBeNull()
    expect(voiceTip(plain, UA.android, 5)).toBeNull()
  })
})
