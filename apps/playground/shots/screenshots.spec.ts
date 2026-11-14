import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { devices, type Page, test } from "@playwright/test";
import { installSpeechStub } from "../e2e/speech-stub";

const DOCS = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));
const PUBLIC = fileURLToPath(new URL("../public/", import.meta.url));
// Slow enough that a highlighted word holds still for the shot.
const SPEECH = { wordMs: 650, voices: ["Samantha", "Daniel", "Karen", "Moira"] };
const widget = (page: Page, selector: string) => page.locator(`lantun-reader ${selector}`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSpeechStub, SPEECH);
});

async function open(page: Page): Promise<void> {
  await page.goto("/");
  await widget(page, ".dock").waitFor();
  await page.waitForTimeout(900); // entrance animations settle
}

// Starts reading and waits until the highlight sits a few words into the headline.
async function listen(page: Page): Promise<void> {
  await page.locator("#listen").click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(SPEECH.wordMs * 4 + 200);
}

test("playing", async ({ page }) => {
  await open(page);
  await listen(page);
  // Hovering a paragraph shows the "play from here" button beside it.
  await page.locator(".lede").hover({ position: { x: 40, y: 20 } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DOCS}playing.png` });
});

test("dock", async ({ page }) => {
  await open(page);
  await widget(page, '[data-lt="play"]').hover();
  await page.waitForTimeout(700); // tooltip delay
  await page.screenshot({ path: `${DOCS}dock.png` });
});

test("voice", async ({ page }) => {
  await open(page);
  await listen(page);
  await widget(page, '[data-lt="voice"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DOCS}voice.png` });
});

test("accessibility", async ({ page }) => {
  await open(page);
  await widget(page, '[data-lt="ax"]').click();
  await page.locator("lantun-reader .pchip", { hasText: "Dyslexia" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DOCS}accessibility.png` });
});

test.describe("dark", () => {
  test.use({ colorScheme: "dark" });

  test("dark mode", async ({ page }) => {
    await open(page);
    await listen(page);
    await page.screenshot({ path: `${DOCS}dark-mode.png` });
  });
});

test.describe("phone", () => {
  // The iPhone 13's screen and touch, in Chromium like the rest.
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["iPhone 13"].userAgent,
  });

  test("mobile", async ({ page }) => {
    await open(page);
    await listen(page);
    await page.screenshot({ path: `${DOCS}mobile.png` });
  });
});

// The link preview on social sites and chat apps: the real dock, mid-sentence, beside the pitch.
test("share image", async ({ page }) => {
  await open(page);
  await listen(page);
  // Only the dock, not the page behind it.
  await page.evaluate(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  });
  const rail = (await widget(page, ".dock").screenshot({ omitBackground: true })).toString("base64");

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="box-sizing:border-box;width:1200px;height:630px;padding:72px 80px;display:flex;align-items:center;gap:64px;
      background:radial-gradient(120% 90% at 85% 50%,#2a2420 0%,#161513 60%);color:#f4f1ea;font-family:-apple-system,'Segoe UI',sans-serif">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:14px;font-size:30px;font-weight:700;letter-spacing:-.01em">
          ${readFileSync(`${PUBLIC}favicon.svg`, "utf8").replace("<svg ", '<svg width="48" height="48" ')}Lantun
        </div>
        <h1 style="margin:40px 0 24px;font:600 64px/1.05 'Iowan Old Style',Charter,Georgia,serif;letter-spacing:-.025em">
          Turn any article into something people can listen to.</h1>
        <p style="margin:0;font-size:24px;line-height:1.45;color:#b5afa4">One script tag. Word-by-word highlighting, reading aids,
          and lifelike voices that run in the browser. Free and open source.</p>
      </div>
      <img src="data:image/png;base64,${rail}" style="height:420px;flex:none" alt="">
    </div></body></html>`);
  await page.waitForTimeout(200);
  writeFileSync(`${PUBLIC}og.png`, await page.screenshot({ scale: "css" }));
});

// Raster icons from favicon.svg: iOS home screen, the web app manifest, and favicon.ico, which
// browsers request on every page (the sample articles included).
test("icons", async ({ browser }) => {
  const svg = readFileSync(`${PUBLIC}favicon.svg`, "utf8");

  async function png(size: number, bleed = false): Promise<Buffer> {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const body = bleed ? "#161513" : "transparent";

    await page.setContent(
      `<body style="margin:0;background:${body}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`,
    );

    const out = await page.screenshot({ omitBackground: !bleed });

    await page.close();

    return out;
  }

  // iOS rounds the corners itself and wants a full square.
  writeFileSync(`${PUBLIC}apple-touch-icon.png`, await png(180, true));
  writeFileSync(`${PUBLIC}icon-192.png`, await png(192));
  writeFileSync(`${PUBLIC}icon-512.png`, await png(512));

  // An .ico file holding PNG images, read by every browser since 2007.
  const sizes = [32, 48];
  const images = await Promise.all(sizes.map((s) => png(s)));
  const head = Buffer.alloc(6 + 16 * images.length);
  let offset = head.length;

  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  images.forEach((img, i) => {
    const at = 6 + i * 16;

    head.writeUInt8(sizes[i] ?? 0, at);
    head.writeUInt8(sizes[i] ?? 0, at + 1);
    head.writeUInt16LE(1, at + 4);
    head.writeUInt16LE(32, at + 6);
    head.writeUInt32LE(img.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += img.length;
  });
  writeFileSync(`${PUBLIC}favicon.ico`, Buffer.concat([head, ...images]));
});
