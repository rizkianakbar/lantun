# @lantun/core

Read any article aloud, with each sentence and word highlighted, plus reading aids for low vision, dyslexia and ADHD.

```sh
npm install @lantun/core @lantun/voice-kitten
```

```ts
import { init, registerVoices } from "@lantun/core";
import { kittenVoices } from "@lantun/voice-kitten";

registerVoices(kittenVoices()); // lifelike voices; browser voices often sound robotic
init({ contentSelector: "article", color: "#7c3aed" });
```

Options, screenshots and the script-tag setup: [github.com/rizkianakbar/lantun](https://github.com/rizkianakbar/lantun#readme)
