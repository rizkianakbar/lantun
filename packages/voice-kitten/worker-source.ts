import { dirname, resolve } from "node:path";
import { build } from "esbuild";
import type { Plugin } from "vite";

const SUFFIX = "?worker-source";

// `import { source } from './worker?worker-source'` gives the worker bundled and minified as a
// string. Vite's own ?worker&inline embeds it base64-encoded, which gzips about a third worse;
// a plain string keeps voice-kitten.js inside its size budget.
export const workerSource = (): Plugin => ({
  name: "lantun-worker-source",
  resolveId(id, importer) {
    if (id.endsWith(SUFFIX) && importer) return resolve(dirname(importer), id);
    return null;
  },
  async load(id) {
    if (!id.endsWith(SUFFIX)) return null;
    const file = id.slice(0, -SUFFIX.length);
    const out = await build({
      entryPoints: [/\.[jt]s$/.test(file) ? file : `${file}.ts`],
      bundle: true,
      write: false,
      format: "esm",
      minify: true,
      target: "es2020",
    });
    return `export const source = ${JSON.stringify(out.outputFiles[0]?.text ?? "")}`;
  },
});
