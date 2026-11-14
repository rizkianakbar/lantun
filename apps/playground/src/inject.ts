import * as reader from "@lantun/core";
import { kittenVoices } from "@lantun/voice-kitten";
import { urlOptions } from "./demo.lib";

// Mirrors the CDN loader: fixtures configure the widget with data-* on this script tag.
// Module scripts have no document.currentScript, hence the attribute lookup.
const tag = document.querySelector<HTMLScriptElement>("script[data-lantun]");

declare global {
  interface Window {
    LantunReader: typeof reader;
  }
}

window.LantunReader = reader;
// The demo offers the HD add-on; nothing downloads until a reader picks an HD voice.
reader.registerVoices(kittenVoices());
// The home page's colour and side choices ride along in the URL.
const demo = urlOptions(location.search);

reader.init({
  ...(tag ? reader.optionsFromDataset(tag.dataset) : {}),
  ...(demo.color && { color: demo.color }),
  ...(demo.side && { position: demo.side }),
});

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => reader.destroy());
}
