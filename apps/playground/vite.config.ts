import { resolve } from "node:path";
import { defineConfig } from "vite";
import { fixtures } from "./fixtures.ts";

// Vite only builds index.html by default; each fixture is its own page, so list them as inputs.
const pages = Object.fromEntries(
  fixtures.map((f) => [f.file.replace(/\.html$/, ""), resolve(import.meta.dirname, "fixtures", f.file)]),
);

export default defineConfig({
  build: {
    rolldownOptions: {
      input: { index: resolve(import.meta.dirname, "index.html"), ...pages },
    },
  },
});
