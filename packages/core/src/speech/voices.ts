import type { Voice } from './types'

// Android has reported Indonesian as the legacy Java code "in", and uses "_" as a separator.
const LEGACY = new Map([
  ['in', 'id'],
  ['iw', 'he'],
  ['ji', 'yi'],
])

const normalize = (tag: string): string => {
  const [primary = '', ...rest] = tag.toLowerCase().replace(/_/g, '-').split('-')
  return [LEGACY.get(primary) ?? primary, ...rest].join('-')
}

export const primaryLang = (tag: string): string => normalize(tag).split('-')[0] ?? ''

// macOS ships novelty voices ("Bubbles", "Zarvox") that nobody wants reading the news.
const NOVELTY =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Pipe Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Deranged|Hysterical)\b/
// Formant-era voices that sound robotic.
const ROBOTIC = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Fred|Junior|Ralph|Kathy|Princess)\b/
// Neural voices: Edge "Online (Natural)", Apple downloadable "Premium"/"Enhanced".
const NEURAL = /\b(Natural|Neural|Premium|Enhanced)\b/i
// Classic Windows SAPI desktop voices ("Microsoft David - English").
const SAPI = /^Microsoft\s(?!.*\bOnline\b)/
// Chrome's server-side voices. Smoother than the compact on-device voices macOS hands to Chrome
// (Samantha, Damayanti), which are what made the widget sound robotic there.
const GOOGLE = /^Google\s/

// How natural a voice sounds, 0–6 (6: add-on neural voices). Deliberately ranks network voices above robotic local ones;
// see docs/decisions.md for why this departs from the spec's "local first".
export const voiceQuality = (v: Voice): number => {
  if (v.engine) return 6
  if (NEURAL.test(v.name)) return 5
  if (GOOGLE.test(v.name)) return 4
  if (ROBOTIC.test(v.name)) return 0
  if (SAPI.test(v.name)) return 1
  return v.local ? 3 : 2
}

// The right accent outweighs one quality step: a US page should not get "Google UK English" over
// "Google US English" or Samantha.
const score = (v: Voice, wanted: string): number =>
  voiceQuality(v) * 10 + (normalize(v.lang) === wanted ? 12 : 0) + (v.local ? 1 : 0) + (v.isDefault ? 1 : 0)

export const voicesFor = (voices: readonly Voice[], lang: string): Voice[] =>
  voices.filter((v) => primaryLang(v.lang) === primaryLang(lang))

// Voices for the page language, best first, novelty voices removed.
export const listVoices = (voices: readonly Voice[], lang: string): Voice[] => {
  const wanted = normalize(lang)
  return voicesFor(voices, lang)
    .filter((v) => !NOVELTY.test(v.name))
    .sort((a, b) => score(b, wanted) - score(a, wanted) || a.name.localeCompare(b.name))
}

// Add-on voices are never picked on the reader's behalf: they download tens of megabytes first,
// so they need a deliberate choice, unless the browser has no voice of its own for the language.
export const pickVoice = (voices: readonly Voice[], lang: string, preferredId?: string | null): Voice | null => {
  const ranked = listVoices(voices, lang)
  return (preferredId ? ranked.find((v) => v.id === preferredId) : undefined) ?? ranked.find((v) => !v.engine) ?? ranked[0] ?? null
}

export interface VoiceLabel {
  name: string
  region: string
  kind: 'hd' | 'natural' | 'online' | 'device'
}

const regionNames = new Map<string, Intl.DisplayNames | null>()
const regionName = (code: string, uiLang: string): string => {
  if (!regionNames.has(uiLang)) {
    try {
      regionNames.set(uiLang, new Intl.DisplayNames([uiLang], { type: 'region' }))
    } catch {
      regionNames.set(uiLang, null)
    }
  }
  try {
    return regionNames.get(uiLang)?.of(code) ?? code
  } catch {
    return code
  }
}

// "Microsoft Ardi Online (Natural) - Indonesian (Indonesia)" -> { name: "Ardi", region: "Indonesia", kind: "natural" }
export const describeVoice = (v: Voice, uiLang: string): VoiceLabel => {
  const name =
    v.name
      .replace(/^Microsoft\s+/, '')
      .replace(/\s+Online\b/, '')
      .replace(/\s*\((Natural|Neural|Premium|Enhanced)\)/i, '')
      .replace(/\s+-\s+.*$/, '')
      .replace(/\s*\([^)]*\([^)]*\)\)$/, '') // Chrome on macOS: "Eddy (English (US))"
      .trim() || v.name
  const region = normalize(v.lang).split('-')[1]?.toUpperCase()
  return {
    name: v.engine ? v.name : name,
    region: region ? regionName(region, uiLang) : '',
    kind: v.engine ? 'hd' : NEURAL.test(v.name) ? 'natural' : v.local ? 'device' : 'online',
  }
}

export type VoiceTip = 'edge' | 'mac' | 'ios'

// Where a reader stuck with robotic voices can get a natural one. Edge ships neural voices on
// every desktop OS; Apple users can download Enhanced voices instead. Android has no reliable path.
export const voiceTip = (voices: readonly Voice[], ua: string, touchPoints: number): VoiceTip | null => {
  if (!voices.length || voices.some((v) => v.engine || NEURAL.test(v.name))) return null
  const apple = /Macintosh|iPhone|iPad/.test(ua)
  if (/iPhone|iPad/.test(ua) || (apple && touchPoints > 1)) return 'ios'
  if (/Edg\/|Android/.test(ua)) return null
  if (apple && !/Chrome\/|Firefox\//.test(ua)) return 'mac'
  return 'edge'
}
