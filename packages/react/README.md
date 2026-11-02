# @lantun/react

The Lantun read-aloud widget as a React component.

```sh
npm install @lantun/react @lantun/voice-kitten
```

```tsx
import { LantunWidget, registerVoices } from "@lantun/react";
import { kittenVoices } from "@lantun/voice-kitten";

registerVoices(kittenVoices()); // lifelike voices; browser voices often sound robotic

<LantunWidget contentSelector="article" color="#7c3aed" />;
```

Options, screenshots and the script-tag setup: [github.com/rizkianakbar/lantun](https://github.com/rizkianakbar/lantun#readme)
