import { CDN, DEFAULT_COLOR } from "./demo.constants";
import type { DemoOptions, Setup, Side, Snippet } from "./demo.types";

// The demo's choices travel in the URL, so a sample article opened from the home page keeps them.
export function urlOptions(search: string): Partial<DemoOptions> {
  const params = new URLSearchParams(search);
  const color = params.get("color");
  const side = params.get("side");
  const out: Partial<DemoOptions> = {};

  if (color && /^#[0-9a-f]{6}$/i.test(color)) out.color = color.toLowerCase();
  if (side === "left" || side === "right") out.side = side as Side;

  return out;
}

export function demoQuery(o: DemoOptions): string {
  const params = new URLSearchParams();

  if (o.color !== DEFAULT_COLOR) params.set("color", o.color);
  if (o.side !== "right") params.set("side", o.side);

  const query = params.toString();

  return query ? `?${query}` : "";
}

// Dark text on light brand colours, white on dark ones (WCAG relative luminance).
export function inkOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;

    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#17171a" : "#ffffff";
}

function changed(o: DemoOptions): [string, string][] {
  const out: [string, string][] = [];

  if (o.color !== DEFAULT_COLOR) out.push(["color", o.color]);
  if (o.side !== "right") out.push(["position", o.side]);

  return out;
}

export function snippet(setup: Setup, o: DemoOptions): Snippet {
  const opts = changed(o);

  if (setup === "script") {
    const widget = opts.length
      ? `<script\n  src="${CDN}widget.js"\n${opts.map(([k, v]) => `  data-${k}="${v}"`).join("\n")}\n></script>`
      : `<script src="${CDN}widget.js"></script>`;

    return { code: `${widget}\n<script src="${CDN}voice-kitten.js"></script>`, lang: "html", file: "index.html" };
  }

  if (setup === "js") {
    const args = opts.length ? `{ ${opts.map(([k, v]) => `${k}: "${v}"`).join(", ")} }` : "";

    return {
      install: "npm install @lantun/core @lantun/voice-kitten",
      lang: "ts",
      file: "main.ts",
      code: `import { init, registerVoices } from "@lantun/core";\nimport { kittenVoices } from "@lantun/voice-kitten";\n\nregisterVoices(kittenVoices());\ninit(${args});`,
    };
  }

  const props = opts.map(([k, v]) => ` ${k}="${v}"`).join("");

  return {
    install: "npm install @lantun/react @lantun/voice-kitten",
    lang: "tsx",
    file: "ArticlePage.tsx",
    code: `import { LantunWidget, registerVoices } from "@lantun/react";\nimport { kittenVoices } from "@lantun/voice-kitten";\n\nregisterVoices(kittenVoices());\n\nexport function ArticlePage() {\n  return (\n    <>\n      <article>…</article>\n      <LantunWidget${props} />\n    </>\n  );\n}`,
  };
}

// Loads the published widget and voices into whatever page it is clicked on, in the chosen look.
// Clicking again removes the old copy first, so it doubles as "reload".
export function bookmarklet(o: DemoOptions, base: string): string {
  const data = changed(o)
    .map(([k, v]) => `s.dataset.${k}='${v}';`)
    .join("");

  return `javascript:(()=>{window.LantunReader?.destroy();const add=(f,w)=>{const s=document.createElement('script');s.src='${base}'+f;if(w){${data}}document.documentElement.appendChild(s)};add('widget.js',1);add('voice-kitten.js')})()`;
}
