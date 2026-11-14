import { type Fixture, fixtures } from "../fixtures";
import { CDN, COPIED_MS, DEFAULT_COLOR, LOCAL_CDN, SETUPS, SWATCHES, TAGS } from "./demo.constants";
import { bookmarklet, demoQuery, inkOn, snippet, urlOptions } from "./demo.lib";
import type { DemoOptions, Setup } from "./demo.types";
import { highlight, lines } from "./highlight.lib";
import type { Lang } from "./highlight.types";

const root = document.documentElement;
const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const fromUrl = urlOptions(location.search);

let options: DemoOptions = { color: fromUrl.color ?? DEFAULT_COLOR, side: fromUrl.side ?? "right" };
let setup: Setup = "script";

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (cls) node.className = cls;
  if (text) node.textContent = text;

  return node;
}

function fixtureLink(f: Fixture): HTMLLIElement {
  const li = el("li");
  const a = el("a");
  const name = el("span", "name", f.title);
  const tag = el("span", "tag", TAGS[f.layout]);

  a.dataset.file = f.file;
  tag.append(el("span", "arrow", "→"));
  a.append(name, tag);
  li.append(a);

  return li;
}

function refreshLinks(): void {
  const query = demoQuery(options);

  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-file]")) {
    a.href = `/fixtures/${a.dataset.file}${query}`;
  }

  byId("bookmarklet")?.setAttribute("href", bookmarklet(options, local ? LOCAL_CDN : CDN));
}

function swatch(name: string, value: string): HTMLLabelElement {
  const label = el("label", "sw");
  const input = el("input");
  const dot = el("span", "dot");

  input.type = "radio";
  input.name = "color";
  input.value = value;
  input.setAttribute("aria-label", name);
  dot.style.setProperty("--c", value);
  label.append(input, dot);

  return label;
}

function customSwatch(): HTMLLabelElement {
  const label = el("label", "sw custom");
  const input = el("input");

  input.type = "color";
  input.value = options.color;
  input.setAttribute("aria-label", "Custom colour");
  label.append(input, el("span", "dot"));

  // Dragging in the picker recolours the page live; the widget restarts once, on release.
  input.addEventListener("input", () => preview({ color: input.value }));
  input.addEventListener("change", () => update({ color: input.value }));

  return label;
}

function copyButton(text: string): HTMLButtonElement {
  const button = el("button", "copy");

  button.type = "button";
  button.setAttribute("aria-label", "Copy");
  button.innerHTML =
    '<svg class="idle" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>' +
    '<svg class="done" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 8.5 3 3 7-7"/></svg>';

  let reset: ReturnType<typeof setTimeout> | undefined;

  button.addEventListener("click", () => {
    // A denied clipboard (no permission, no secure context) just leaves the button as it was.
    navigator.clipboard?.writeText(text).then(
      () => {
        clearTimeout(reset);
        button.dataset.copied = "";
        button.setAttribute("aria-label", "Copied");
        reset = setTimeout(() => {
          delete button.dataset.copied;
          button.setAttribute("aria-label", "Copy");
        }, COPIED_MS);
      },
      () => undefined,
    );
  });

  return button;
}

// An editor-style block: a tab with the file name and copy button, then numbered, highlighted lines.
function codeBlock(text: string, lang: Lang, file: string): HTMLDivElement {
  const box = el("div", `code ${lang}`);
  const head = el("div", "file");
  const pre = el("pre");
  const code = el("code");

  for (const line of lines(highlight(text, lang))) {
    const row = el("span", "line");

    for (const t of line) row.append(t.kind ? el("span", `t-${t.kind}`, t.text) : t.text);
    code.append(row);
  }

  head.append(el("span", "fname", file), copyButton(text));
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", `${file}, code`);
  pre.append(code);
  box.append(head, pre);

  return box;
}

function renderSnippet(): void {
  const panel = byId("snippets");

  if (!panel) return;

  const s = snippet(setup, options);
  const blocks = [];

  if (s.install) blocks.push(codeBlock(s.install, "sh", "Terminal"));
  blocks.push(codeBlock(s.code, s.lang, s.file));
  panel.replaceChildren(...blocks);
  panel.setAttribute("aria-labelledby", `tab-${setup}`);
}

function markTabs(focus: boolean): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>("#tabs [role=tab]")) {
    const on = tab.dataset.setup === setup;

    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
  }
}

function selectSetup(next: Setup, focus = false): void {
  setup = next;
  markTabs(focus);
  renderSnippet();
}

function renderTabs(): void {
  const list = byId("tabs");

  if (!list) return;

  for (const s of SETUPS) {
    const tab = el("button", undefined, s.label);

    tab.type = "button";
    tab.id = `tab-${s.id}`;
    tab.dataset.setup = s.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "snippets");
    tab.addEventListener("click", () => selectSetup(s.id));
    list.append(tab);
  }

  markTabs(false);

  list.addEventListener("keydown", (e) => {
    const i = SETUPS.findIndex((s) => s.id === setup);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;

    if (!step) return;

    e.preventDefault();
    selectSetup(SETUPS[(i + step + SETUPS.length) % SETUPS.length]?.id ?? "script", true);
  });
}

// A colour of the reader's own lights up the rainbow swatch and clears the presets.
function syncSwatches(): void {
  const custom = !SWATCHES.some((s) => s.value === options.color);
  const label = document.querySelector<HTMLLabelElement>(".sw.custom");
  const dot = label?.querySelector<HTMLElement>(".dot");

  for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=color]")) {
    radio.checked = radio.value === options.color;
  }

  if (!label || !dot) return;

  label.toggleAttribute("data-on", custom);
  dot.style.background = custom ? options.color : "";
  dot.style.setProperty("--c", options.color);
}

// Recolours the page and the code without touching the widget.
function preview(next: Partial<DemoOptions>): void {
  options = { ...options, ...next };
  root.style.setProperty("--accent", options.color);
  root.style.setProperty("--accent-ink", inkOn(options.color));
  syncSwatches();
  history.replaceState(null, "", `${location.pathname}${demoQuery(options)}${location.hash}`);
  refreshLinks();
  renderSnippet();
}

function update(next: Partial<DemoOptions>): void {
  const moved = next.side !== undefined && next.side !== options.side;

  preview(next);

  const reader = window.LantunReader;

  if (!reader) return;

  // A dock the reader dragged keeps its spot over the `position` option; the demo shows the option.
  if (moved) {
    try {
      localStorage.removeItem("lantun:dock");
    } catch {
      // Storage blocked: the dock stays where it was.
    }
  }

  reader.destroy();
  reader.init({ contentSelector: "#page", color: options.color, position: options.side });
}

for (const f of fixtures) {
  byId(f.layout === "hostile" ? "hostile" : f.lang)?.append(fixtureLink(f));
}

const swatches = byId("swatches");

swatches?.append(...SWATCHES.map((s) => swatch(s.name, s.value)), customSwatch());
swatches?.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;

  if (input.type === "radio") update({ color: input.value });
});

for (const input of document.querySelectorAll<HTMLInputElement>("input[name=side]")) {
  input.checked = input.value === options.side;
  input.addEventListener("change", () => update({ side: input.value as DemoOptions["side"] }));
}

byId("listen")?.addEventListener("click", () => window.LantunReader?.play());

renderTabs();
preview({});
