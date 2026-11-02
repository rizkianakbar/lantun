import { defineConfig, type Plugin, transformWithEsbuild } from "vite";

// The widget's stylesheet is one template string, which the JS minifier leaves alone: its
// comments (written for us, not the browser) and whitespace would ship to every reader. Run it
// through esbuild's CSS minifier at build time instead.
function minifyWidgetCss(): Plugin {
  return {
    name: "lantun-minify-widget-css",
    async transform(code, id) {
      if (!/[\\/]ui[\\/]ui\.styles\.[jt]s$/.test(id)) return null;
      const match = /UI_CSS = `([^`]*)`/.exec(code);
      if (!match?.[1] || match[1].includes("${") || match[1].includes("\\")) {
        this.error("ui.styles: expected one plain template literal of CSS");
      }
      const css = (
        await transformWithEsbuild(match[1], "widget.css", {
          loader: "css",
          minify: true,
        })
      ).code.trim();
      return {
        code: code.replace(match[0], () => `UI_CSS = \`${css}\``),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [minifyWidgetCss()],
  build: {
    // ES2020 (optional chaining, ??) ships untranspiled: every browser with speechSynthesis
    // and the APIs core relies on has it, and the helpers it replaces cost ~1 kB gzipped.
    target: "es2020",
    lib: {
      entry: "src/main.ts",
      name: "LantunReader",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
