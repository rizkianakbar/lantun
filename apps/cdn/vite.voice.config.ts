import { defineConfig } from "vite";

// The HD voice add-on as its own script tag, so widget.js never carries it.
export default defineConfig({
  build: {
    target: "es2020",
    emptyOutDir: false,
    lib: {
      entry: "src/voice-kitten.ts",
      name: "LantunVoiceKitten",
      formats: ["iife"],
      fileName: () => "voice-kitten.js",
    },
  },
});
