import { defineConfig, transformWithEsbuild, type Plugin } from "vite";

// The widget's stylesheet is one template string, which the JS minifier leaves alone: its
// comments (written for us, not the browser) and whitespace would ship to every reader. Run it
// through esbuild's CSS minifier at build time instead.
const minifyWidgetCss = (): Plugin => ({
  name: "lantun-minify-widget-css",
  async transform(code, id) {
    if (!/[\\/]ui[\\/]styles\.[jt]s$/.test(id)) return null;
    const match = /UI_CSS = `([^`]*)`/.exec(code);
    if (!match?.[1] || match[1].includes("${") || match[1].includes("\\")) {
      this.error("ui/styles: expected one plain template literal of CSS");
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
});

export default defineConfig({
  plugins: [minifyWidgetCss()],
  build: {
    target: "es2019",
    lib: {
      entry: "src/main.ts",
      name: "LantunReader",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
