import { render } from "preact";
import type { AxController } from "../a11y/a11y.types";
import { css, resolveColor, textOn } from "../lib/color";
import { createStyle, setImportant } from "../lib/dom";
import { DEFAULT_RGB } from "../options/options.constants";
import type { ResolvedOptions } from "../options/options.types";
import type { Reader } from "../reader/reader.types";
import { App } from "./app";
import { HOST_STYLE, HOST_TAG } from "./ui.constants";
import { stringsFor } from "./ui.i18n";
import { uiAccent } from "./ui.lib";
import { UI_CSS } from "./ui.styles";

export interface MountedUI {
  destroy(): void;
}

export function mountUI(
  doc: Document,
  opts: ResolvedOptions,
  reader: Reader | null,
  ax: AxController | null,
): MountedUI {
  const host = doc.createElement(HOST_TAG);
  const shadow = host.attachShadow({ mode: "open" });
  const container = doc.createElement("div");
  const accent = uiAccent(resolveColor(opts.color, doc) ?? DEFAULT_RGB);

  setImportant(host, `${HOST_STYLE};z-index:${opts.zIndex}`);
  shadow.append(createStyle(doc, UI_CSS, opts.nonce), container);
  // A child of <html>, not <body>: page rules like `body > *` never match it.
  doc.documentElement.append(host);

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
  );

  return {
    destroy() {
      render(null, container);
      host.remove();
    },
  };
}
