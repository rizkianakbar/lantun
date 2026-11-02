import * as reader from "@lantun/core";
import { kittenVoices } from "@lantun/voice-kitten";

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
reader.init(tag ? reader.optionsFromDataset(tag.dataset) : {});

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => reader.destroy());
}
