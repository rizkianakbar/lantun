# @lantun/react

**A read-aloud widget for React: text-to-speech with sentence and word highlighting, plus reading aids for low vision, dyslexia and ADHD.**

Drop `<LantunWidget />` on an article page. Readers get a small dock: press play to hear the article as it highlights along, or open the reading aids for text size, spacing, a dyslexia font, colour modes and more. It runs entirely in the browser, with no backend or account.

**[Try the live demo →](https://lantun.rzknkbr.xyz)** Open any sample article and press play.

<img src="https://raw.githubusercontent.com/rizkianakbar/lantun/v0.1.2/docs/screenshots/playing-dark.png" alt="Lantun reading an article aloud, highlighting the current sentence and word">

## Install

```sh
npm install @lantun/react @lantun/voice-kitten
```

Requires React 17 or later. `@lantun/voice-kitten` is optional but recommended. Browser voices often sound robotic, while these natural voices run on the reader's device and download nothing until a reader picks one.

## Usage

```tsx
import { LantunWidget, registerVoices } from "@lantun/react";
import { kittenVoices } from "@lantun/voice-kitten";

registerVoices(kittenVoices());

export function ArticlePage() {
  return (
    <>
      <article>…</article>
      <LantunWidget contentSelector="article" color="#7c3aed" />
    </>
  );
}
```

`<LantunWidget />` renders nothing in your tree. It starts the widget on mount, restarts it only when its props change, and removes it on unmount. It is safe under `StrictMode`. Render one per page.

## Props

All props are optional.

| Prop               | Default                     | What it does                                            |
| ------------------ | --------------------------- | ------------------------------------------------------- |
| `contentSelector`  | auto-detected               | Where the article body is.                              |
| `excludeSelectors` | `[]`                        | Selectors that are never read aloud.                    |
| `position`         | `"right"`                   | Dock side: `"right"` or `"left"`.                       |
| `color`            | `"#f5b841"`                 | Highlight and accent colour; any CSS colour.            |
| `lang`             | `<html lang>`, then `en`    | Article language; picks the voices and the UI language. |
| `features`         | `{ tts: true, a11y: true }` | Turn listening or reading aids off.                     |
| `zIndex`           | `2147483000`                | Stacking order of the dock.                             |
| `nonce`            | none                        | CSP nonce for Lantun's `<style>` elements.              |

To skip one element without a selector, add `data-reader-skip` to it.

Need `play()`, `pause()` or events such as `on("end", …)`? Import them from [`@lantun/core`](https://www.npmjs.com/package/@lantun/core), which this package installs for you.

## A closer look

<table>
  <tr>
    <td width="50%"><img src="https://raw.githubusercontent.com/rizkianakbar/lantun/v0.1.2/docs/screenshots/dock-dark.png" alt="The idle dock on the right edge, its play button showing a one-minute listening time"></td>
    <td width="50%"><img src="https://raw.githubusercontent.com/rizkianakbar/lantun/v0.1.2/docs/screenshots/voice-dark.png" alt="The voice picker with lifelike and built-in voices"></td>
  </tr>
  <tr>
    <td><b>Quiet until needed.</b> A slim dock shows how long the article takes to hear. Drag it to any edge, or tuck it away.</td>
    <td><b>Lifelike voices.</b> Natural English voices made on the reader's device, downloaded once and only when chosen.</td>
  </tr>
  <tr>
    <td><img src="https://raw.githubusercontent.com/rizkianakbar/lantun/v0.1.2/docs/screenshots/accessibility-dark.png" alt="The reading aids panel with the Dyslexia profile on"></td>
    <td align="center"><img src="https://raw.githubusercontent.com/rizkianakbar/lantun/v0.1.2/docs/screenshots/mobile-dark.png" width="240" alt="Lantun on a phone, the dock lying flat along the bottom while the headline is read aloud"></td>
  </tr>
  <tr>
    <td><b>Reading aids.</b> Text size, spacing, readable and dyslexia fonts, colour modes, reading guide and mask, and more.</td>
    <td><b>On phones.</b> The dock lies flat along the bottom, in thumb reach.</td>
  </tr>
</table>

## Links

- [Live demo](https://lantun.rzknkbr.xyz)
- [GitHub](https://github.com/rizkianakbar/lantun) (full docs and screenshots)
- [Issues](https://github.com/rizkianakbar/lantun/issues)

MIT licensed.
