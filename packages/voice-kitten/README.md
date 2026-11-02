# @lantun/voice-kitten

Lifelike English voices for [Lantun](https://github.com/rizkianakbar/lantun), generated on the reader's device with Kitten TTS. Nothing downloads until a reader picks one of these voices (about 31 MB, once).

```sh
npm install @lantun/core @lantun/voice-kitten
```

```ts
import { init, registerVoices } from "@lantun/core";
import { kittenVoices } from "@lantun/voice-kitten";

registerVoices(kittenVoices());
init();
```
