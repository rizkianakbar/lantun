import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { installSpeechStub } from "../e2e/speech-stub";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const widgetJs = readFileSync(here("../../cdn/dist/widget.js"), "utf8");

interface Site {
  name: string;
  lang: "id" | "en";
  kind: "news" | "wordpress" | "reference";
  start: string;
  // Article URLs change daily, so news sites start at the homepage and follow the first link
  // that looks like an article.
  article?: RegExp;
}

const SITES: Site[] = [
  {
    name: "detik.com",
    lang: "id",
    kind: "news",
    start: "https://news.detik.com/",
    article: /detik\.com\/.+\/d-\d{6,}\//,
  },
  {
    name: "kompas.com",
    lang: "id",
    kind: "news",
    start: "https://www.kompas.com/",
    article: /kompas\.com\/.*read\/\d{4}\/\d{2}\/\d{2}\//,
  },
  {
    name: "cnnindonesia.com",
    lang: "id",
    kind: "news",
    start: "https://www.cnnindonesia.com/nasional",
    article: /cnnindonesia\.com\/.+\/\d{14}-\d+-\d+\//,
  },
  {
    name: "antaranews.com",
    lang: "id",
    kind: "news",
    start: "https://www.antaranews.com/",
    article: /antaranews\.com\/berita\/\d+\//,
  },
  {
    name: "id.wikipedia.org",
    lang: "id",
    kind: "reference",
    start: "https://id.wikipedia.org/wiki/Candi_Borobudur",
  },
  {
    name: "bbc.com",
    lang: "en",
    kind: "news",
    start: "https://www.bbc.com/news",
    article: /bbc\.com\/news\/articles\/[a-z0-9]+$/,
  },
  {
    name: "theguardian.com",
    lang: "en",
    kind: "news",
    start: "https://www.theguardian.com/international",
    article: /theguardian\.com\/[a-z-]+\/\d{4}\/[a-z]{3}\/\d{2}\/[a-z0-9-]+$/,
  },
  {
    name: "npr.org",
    lang: "en",
    kind: "news",
    start: "https://www.npr.org/sections/news/",
    article: /npr\.org\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\//,
  },
  {
    name: "wordpress.org/news",
    lang: "en",
    kind: "wordpress",
    start: "https://wordpress.org/news/",
    article: /wordpress\.org\/news\/\d{4}\/\d{2}\/[a-z0-9-]+\/$/,
  },
  {
    name: "en.wikipedia.org",
    lang: "en",
    kind: "reference",
    start: "https://en.wikipedia.org/wiki/Speech_synthesis",
  },
];

interface Row {
  site: Site;
  url: string;
  sentences: string[];
  error?: string;
}
const rows: Row[] = [];

const openArticle = async (page: Page, site: Site): Promise<string> => {
  await page.goto(site.start, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!site.article) return page.url();
  const href = await page.$$eval(
    "a[href]",
    (as, source) => as.map((a) => (a as HTMLAnchorElement).href).find((h) => new RegExp(source).test(h)),
    site.article.source,
  );
  if (!href) throw new Error("no article link found on the start page");
  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 30_000 });
  return page.url();
};

// Bot-protection interstitials are not article pages; report them instead of "passing" on them.
const assertNotChallenged = async (page: Page): Promise<void> => {
  const title = await page.title();
  if (/just a moment|attention required|verifikasi|access denied/i.test(title))
    throw new Error(`blocked by bot protection ("${title}")`);
};

for (const site of SITES) {
  test(`${site.name} (${site.lang}, ${site.kind})`, async ({ page }, info) => {
    await page.addInitScript(installSpeechStub, { wordMs: 4 });
    const row: Row = { site, url: site.start, sentences: [] };
    rows.push(row);
    try {
      row.url = await openArticle(page, site);
      await page.waitForTimeout(1500); // let late-loading article bodies settle
      await assertNotChallenged(page);
      await page.addScriptTag({ content: widgetJs });
      await page.locator('lantun-reader [data-lt="launch"]').waitFor({ timeout: 10_000 });
      row.sentences = await page.evaluate(
        () =>
          new Promise<string[]>((resolve) => {
            const out: string[] = [];
            const r = (
              window as unknown as {
                LantunReader: {
                  on: (e: string, cb: (p: { text: string }) => void) => void;
                  play: () => void;
                  pause: () => void;
                };
              }
            ).LantunReader;
            r.on("sentence", (p) => {
              out.push(p.text);
              if (out.length === 3) {
                r.pause();
                resolve(out);
              }
            });
            r.on("error", () => resolve(out));
            r.play();
            setTimeout(() => resolve(out), 8000);
          }),
      );
      await page.screenshot({ path: info.outputPath("page.png") });
    } catch (err) {
      row.error = (err as Error).message.split("\n")[0];
    }
    expect(row.error ?? "").toBe("");
    expect(row.sentences.length).toBeGreaterThan(0);
  });
}

test.afterAll(() => {
  const latest = new Map(rows.map((r) => [r.site.name, r]));
  const lines = [
    "# Live-site check",
    "",
    `Generated by \`pnpm live-check\` on ${new Date().toISOString().slice(0, 10)}: the production \`widget.js\` injected into live pages`,
    "(the same thing the bookmarklet does), speech stubbed, recording the first sentences the widget reads.",
    "",
    "| Site | Lang | Type | Result | First sentences read |",
    "| --- | --- | --- | --- | --- |",
    ...[...latest.values()].map((r) => {
      const result = r.error ? `❌ ${r.error}` : r.sentences.length ? "✅" : "❌ nothing read";
      const text = r.sentences.map((s) => s.replace(/\|/g, "\\|").slice(0, 140)).join(" / ");
      return `| [${r.site.name}](${r.url}) | ${r.site.lang} | ${r.site.kind} | ${result} | ${text} |`;
    }),
    "",
  ];
  mkdirSync(here("../../../docs"), { recursive: true });
  writeFileSync(here("../../../docs/live-check.md"), lines.join("\n"));
});
