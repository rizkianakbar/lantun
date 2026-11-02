import type { Position, ReaderOptions } from './types'

const bool = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v !== 'false' && v !== '0'

// Used by the script-tag install. Mirrors the option table in docs/mvp-spec.md; unknown attributes are ignored.
export const optionsFromDataset = (ds: DOMStringMap): ReaderOptions => {
  const opts: ReaderOptions = {}
  if (ds.contentSelector) opts.contentSelector = ds.contentSelector
  if (ds.excludeSelectors) {
    opts.excludeSelectors = ds.excludeSelectors.split(',').map((s) => s.trim()).filter(Boolean)
  }
  if (ds.position) opts.position = ds.position as Position
  if (ds.color) opts.color = ds.color
  if (ds.lang) opts.lang = ds.lang
  const tts = bool(ds.tts)
  const a11y = bool(ds.a11y)
  if (tts !== undefined || a11y !== undefined) opts.features = { tts, a11y }
  if (ds.zIndex && Number.isFinite(Number(ds.zIndex))) opts.zIndex = Number(ds.zIndex)
  return opts
}
