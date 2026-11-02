import { isRecord } from '../state/storage'

export type Step = 0 | 1 | 2 | 3
export type FontMode = 'default' | 'readable' | 'dyslexic'
export type ContrastMode = 'default' | 'dark' | 'light' | 'high' | 'invert'

export interface AxSettings {
  text: Step
  line: Step
  spacing: Step
  font: FontMode
  contrast: ContrastMode
  desaturate: boolean
  links: boolean
  cursor: boolean
  guide: boolean
  mask: boolean
  still: boolean
  noImages: boolean
}

export const AX_DEFAULTS: Readonly<AxSettings> = {
  text: 0,
  line: 0,
  spacing: 0,
  font: 'default',
  contrast: 'default',
  desaturate: false,
  links: false,
  cursor: false,
  guide: false,
  mask: false,
  still: false,
  noImages: false,
}

export const TEXT_SIZES = [100, 115, 130, 150] as const

export const PROFILES = {
  lowVision: { text: 2, contrast: 'high', cursor: true, links: true },
  dyslexia: { font: 'dyslexic', line: 1, spacing: 1, guide: true },
  adhd: { mask: true, still: true },
  seizure: { still: true, desaturate: true },
  elderly: { text: 2, font: 'readable', cursor: true },
} satisfies Record<string, Partial<AxSettings>>

export type ProfileId = keyof typeof PROFILES
export const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[]

export const profileSettings = (id: ProfileId): AxSettings => ({ ...AX_DEFAULTS, ...PROFILES[id] })

const KEYS = Object.keys(AX_DEFAULTS) as (keyof AxSettings)[]
const same = (a: AxSettings, b: AxSettings): boolean => KEYS.every((k) => a[k] === b[k])

export const activeProfile = (s: AxSettings): ProfileId | null => PROFILE_IDS.find((id) => same(profileSettings(id), s)) ?? null

export const isDefault = (s: AxSettings): boolean => same(s, AX_DEFAULTS)

const STEPS: readonly unknown[] = [0, 1, 2, 3]
const FONTS: readonly unknown[] = ['default', 'readable', 'dyslexic']
const CONTRASTS: readonly unknown[] = ['default', 'dark', 'light', 'high', 'invert']

// Stored settings are untrusted input: keep only well-formed values.
export const sanitizeAx = (raw: unknown): AxSettings => {
  const s: AxSettings = { ...AX_DEFAULTS }
  if (!isRecord(raw)) return s
  if (STEPS.includes(raw.text)) s.text = raw.text as Step
  if (STEPS.includes(raw.line)) s.line = raw.line as Step
  if (STEPS.includes(raw.spacing)) s.spacing = raw.spacing as Step
  if (FONTS.includes(raw.font)) s.font = raw.font as FontMode
  if (CONTRASTS.includes(raw.contrast)) s.contrast = raw.contrast as ContrastMode
  for (const k of ['desaturate', 'links', 'cursor', 'guide', 'mask', 'still', 'noImages'] as const) {
    if (typeof raw[k] === 'boolean') s[k] = raw[k]
  }
  return s
}

export const ALL_AX_CLASSES: readonly string[] = [
  'ax-text-115',
  'ax-text-130',
  'ax-text-150',
  'ax-line-1',
  'ax-line-2',
  'ax-line-3',
  'ax-spacing-1',
  'ax-spacing-2',
  'ax-spacing-3',
  'ax-font-readable',
  'ax-font-dyslexic',
  'ax-contrast-dark',
  'ax-contrast-light',
  'ax-contrast-high',
  'ax-contrast-invert',
  'ax-desaturate',
  'ax-links',
  'ax-cursor',
  'ax-guide',
  'ax-mask',
  'ax-still',
  'ax-no-images',
]

export const axClasses = (s: AxSettings): string[] => {
  const out: string[] = []
  if (s.text) out.push(`ax-text-${TEXT_SIZES[s.text]}`)
  if (s.line) out.push(`ax-line-${s.line}`)
  if (s.spacing) out.push(`ax-spacing-${s.spacing}`)
  if (s.font !== 'default') out.push(`ax-font-${s.font}`)
  if (s.contrast !== 'default') out.push(`ax-contrast-${s.contrast}`)
  if (s.desaturate) out.push('ax-desaturate')
  if (s.links) out.push('ax-links')
  if (s.cursor) out.push('ax-cursor')
  if (s.guide) out.push('ax-guide')
  if (s.mask) out.push('ax-mask')
  if (s.still) out.push('ax-still')
  if (s.noImages) out.push('ax-no-images')
  return out
}
