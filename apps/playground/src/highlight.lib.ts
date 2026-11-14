import type { Lang, Rule, Token, TokenKind } from "./highlight.types";

// Just enough grammar for the snippets this page shows, not a general highlighter.
const STRING = /"[^"\n]*"/y;

const SCRIPT: Rule[] = [
  [STRING, "string"],
  [/(<\/?)([A-Z][\w.]*)/y, "punct", "type"],
  [/(<\/?)([a-z][\w-]*)/y, "punct", "tag"],
  [/<\/?>|\/>|>/y, "punct"],
  [/\b(?:import|export|from|return)\b/y, "keyword"],
  [/\bfunction\b/y, "storage"],
  [/[A-Za-z_$][\w$-]*(?==)/y, "attr"],
  [/[A-Za-z_$][\w$]*(?=\()/y, "fn"],
  [/[A-Za-z_$][\w$]*/y, "var"],
];

const RULES: Record<Lang, Rule[]> = {
  ts: SCRIPT,
  tsx: SCRIPT,
  html: [
    [/(<\/?)([a-z][\w-]*)/y, "punct", "tag"],
    [/\/?>/y, "punct"],
    [/[a-z][\w-]*(?==)/y, "attr"],
    [STRING, "string"],
  ],
  sh: [[/^[\w-]+/y, "fn"]],
};

const OPEN = "([{";
const CLOSE = ")]}";
const BRACKETS: TokenKind[] = ["b1", "b2", "b3"];

export function highlight(code: string, lang: Lang): Token[] {
  const rules = RULES[lang];
  const out: Token[] = [];
  let plain = "";
  let depth = 0;
  let i = 0;

  function flush(): void {
    if (plain) out.push({ text: plain });
    plain = "";
  }

  outer: while (i < code.length) {
    for (const [re, ...kinds] of rules) {
      re.lastIndex = i;

      const m = re.exec(code);

      if (!m?.[0]) continue;

      flush();

      if (m.length > 1) {
        m.slice(1).forEach((text, g) => {
          if (text) out.push({ text, kind: kinds[g] });
        });
      } else {
        out.push({ text: m[0], kind: kinds[0] });
      }

      i += m[0].length;
      continue outer;
    }

    const ch = code[i] ?? "";

    // Bracket pairs take a colour by nesting depth, as VS Code draws them.
    if (lang !== "html" && (OPEN.includes(ch) || CLOSE.includes(ch))) {
      flush();
      if (CLOSE.includes(ch)) depth = Math.max(0, depth - 1);
      out.push({ text: ch, kind: BRACKETS[depth % BRACKETS.length] });
      if (OPEN.includes(ch)) depth++;
    } else {
      plain += ch;
    }

    i++;
  }

  flush();

  return out;
}

// Splits tokens at newlines, so each line can be its own element with a line number.
export function lines(tokens: Token[]): Token[][] {
  const out: Token[][] = [[]];

  for (const t of tokens) {
    t.text.split("\n").forEach((text, n) => {
      if (n > 0) out.push([]);
      if (text) out.at(-1)?.push({ text, kind: t.kind });
    });
  }

  return out;
}
