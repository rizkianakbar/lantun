import { defineConfig } from "vite";
import { workerSource } from "./worker-source";

// The worker is inlined into dist/index.js, so installing the package is all a bundler needs.
export default defineConfig({
  plugins: [workerSource()],
  build: {
    target: "es2020",
    lib: { entry: "src/index.ts", formats: ["es"], fileName: () => "index.js" },
    rollupOptions: { external: ["@lantun/core"] },
  },
});
