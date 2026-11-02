import { render } from 'preact'
import type { AxController } from '../a11y/controller'
import { contrast, css, resolveColor, textOn, type RGB } from '../highlight/colors'
import type { Reader } from '../reader'
import type { ResolvedOptions } from '../types'
import { createStyle, setImportant } from '../dom'
import { App } from './App'
import { stringsFor } from './i18n'
import { UI_CSS } from './styles'

export const HOST_TAG = 'lantun-reader'

const SURFACE: RGB = [22, 21, 19]
const FALLBACK: RGB = [245, 184, 65]

// The brand colour has to read on our dark surface; very dark brands are lifted toward white.
export const uiAccent = (brand: RGB): RGB => {
  let c = brand
  for (let i = 0; i < 10 && contrast(c, SURFACE) < 3; i++) c = c.map((v) => Math.round(v + (255 - v) * 0.15)) as RGB
  return c
}

export interface MountedUI {
  destroy(): void
}

export const mountUI = (doc: Document, opts: ResolvedOptions, reader: Reader | null, ax: AxController | null): MountedUI => {
  const host = doc.createElement(HOST_TAG)
  // Inline !important beats any page rule, including `* { all: unset !important }`. `filter` is
  // left out on purpose: the a11y dark/invert modes counter-filter the host from the stylesheet.
  // view-transition-name makes the widget its own layer, so it holds still while the page
  // crossfades between reading-aid looks (a11y/styles.ts).
  setImportant(
    host,
    `position:fixed;inset:0;z-index:${opts.zIndex};pointer-events:none;display:block;margin:0;padding:0;border:0;` +
      'width:auto;height:auto;max-width:none;max-height:none;background:none;opacity:1;visibility:visible;' +
      'transform:none;overflow:visible;clip-path:none;contain:none;view-transition-name:lantun-ui',
  )
  const shadow = host.attachShadow({ mode: 'open' })
  const style = createStyle(doc, UI_CSS, opts.nonce)
  const container = doc.createElement('div')
  shadow.append(style, container)
  // A child of <html>, not <body>: page rules like `body > *` never match it.
  doc.documentElement.append(host)

  const accent = uiAccent(resolveColor(opts.color, doc) ?? FALLBACK)
  render(
    <App
      reader={reader}
      ax={ax}
      t={stringsFor(opts.lang)}
      lang={opts.lang}
      side={opts.position}
      accent={css(accent)}
      accentInk={css(textOn(accent))}
    />,
    container,
  )

  return {
    destroy() {
      render(null, container)
      host.remove()
    },
  }
}
