import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { installSpeechStub } from "./speech-stub";

const widget = (page: Page, selector: string) => page.locator(`lantun-reader ${selector}`);
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []);

const axe = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).include("lantun-reader").analyze();
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSpeechStub, { wordMs: 120 });
});

test("widget UI has zero axe violations in every state", async ({ page }) => {
  await page.goto("/fixtures/en-wp-sourdough.html");
  await widget(page, '[data-lt="play"]').waitFor();
  expect(await axe(page)).toEqual([]);

  await widget(page, '[data-lt="play"]').click();
  await widget(page, ".rail[data-active]").waitFor();
  expect(await axe(page)).toEqual([]);

  await widget(page, ".speed").click();
  await widget(page, ".speedpop").waitFor();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await widget(page, '[data-lt="voice"]').click();
  await widget(page, ".voicepop").waitFor();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await widget(page, '[data-lt="ax"]').click();
  await widget(page, ".panel").waitFor();
  await widget(page, ".pchip").first().click();
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");

  await widget(page, '[data-lt="hide"]').click();
  await widget(page, '[data-lt="show"]').waitFor();
  expect(await axe(page)).toEqual([]);
});

test("docks in the middle of the right edge, and can be dragged", async ({ page }) => {
  await page.goto("/fixtures/en-news-flood.html");
  const rail = widget(page, ".dock");
  await rail.waitFor();
  await page.waitForTimeout(500); // entrance animation
  const box = await rail.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("no box");
  expect(viewport.width - (box.x + box.width)).toBeCloseTo(12, 0);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2);

  const grip = await widget(page, ".grip").boundingBox();
  if (!grip) throw new Error("no grip");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 120, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(400); // glide into place
  const moved = await rail.boundingBox();
  expect((moved?.y ?? 0) - box.y).toBeCloseTo(120, -1);
  // Still within the snap distance of the edge, so it stays flush.
  expect(moved?.x).toBeCloseTo(box.x, 0);
  await page.reload();
  await page.waitForTimeout(500);
  expect(((await rail.boundingBox())?.y ?? 0) - box.y).toBeCloseTo(120, -1);

  // Anywhere on screen: left free in the middle, and popovers open on the side with room.
  const g2 = await widget(page, ".grip").boundingBox();
  if (!g2) throw new Error("no grip");
  await page.mouse.move(g2.x + g2.width / 2, g2.y + g2.height / 2);
  await page.mouse.down();
  await page.mouse.move(400, g2.y + g2.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const free = await rail.boundingBox();
  expect((free?.x ?? 0) + (free?.width ?? 0) / 2).toBeCloseTo(
    400 + (box.x + box.width / 2 - (g2.x + g2.width / 2)),
    -1,
  );
  await widget(page, '[data-lt="ax"]').click();
  const panel = await widget(page, ".panel").boundingBox();
  expect(panel?.x).toBeGreaterThan((free?.x ?? 0) + (free?.width ?? 0));
  await page.keyboard.press("Escape");

  // Dropped on the bottom edge it lies flat, and panels open above it.
  const g3 = await widget(page, ".grip").boundingBox();
  if (!g3) throw new Error("no grip");
  await page.mouse.move(g3.x + g3.width / 2, g3.y + g3.height / 2);
  await page.mouse.down();
  await page.mouse.move(640, (viewport?.height ?? 720) - 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await expect(rail).toHaveAttribute("data-o", "h");
  const flat = await rail.boundingBox();
  expect((viewport?.height ?? 0) - ((flat?.y ?? 0) + (flat?.height ?? 0))).toBeCloseTo(12, 0);
  await widget(page, '[data-lt="ax"]').click();
  const above = await widget(page, ".panel").boundingBox();
  expect((above?.y ?? 0) + (above?.height ?? 0)).toBeLessThanOrEqual((flat?.y ?? 0) - 11);
});

test("keyboard only: play, pause, skip, open and close panels", async ({ page }) => {
  await page.goto("/fixtures/en-news-flood.html");
  const play = widget(page, '[data-lt="play"]');
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(play).toHaveAttribute("aria-label", "Pause");
  await page.keyboard.press("k");
  await expect(play).toHaveAttribute("aria-label", "Play");
  await page.keyboard.press("ArrowRight");
  await expect(widget(page, '[role="progressbar"]')).toHaveAttribute("aria-valuenow", "2");
  await widget(page, '[data-lt="ax"]').focus();
  await page.keyboard.press("Enter");
  await expect(widget(page, ".pchip").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(widget(page, ".panel")).toHaveCount(0);
  await expect(widget(page, '[data-lt="ax"]')).toBeFocused();
});

test("play from here: hover button in the margin", async ({ page }) => {
  await page.goto("/fixtures/en-wp-dieng.html");
  await widget(page, '[data-lt="play"]').waitFor();
  const para = page.locator(".entry-content p").nth(2);
  const box = await para.boundingBox();
  if (!box) throw new Error("no paragraph");
  await page.mouse.move(box.x + 60, box.y + 8);
  const button = widget(page, ".here.on");
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => spoken(page)).toContainEqual(expect.stringMatching(/^The walk up Sikunir hill/));
  await expect(widget(page, ".rail[data-active]")).toBeVisible();
});

test("play from here: text selection chip", async ({ page }) => {
  await page.goto("/fixtures/id-news-banjir.html");
  await widget(page, '[data-lt="play"]').waitFor();
  await page.evaluate(() => {
    const p = document.querySelectorAll(".read__content p")[4]?.firstChild as Text;
    const r = document.createRange();
    r.setStart(p, 10);
    r.setEnd(p, 30);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(r);
  });
  await widget(page, ".selchip").click();
  await expect.poll(() => spoken(page)).toContainEqual(expect.stringMatching(/^Kepala Pusat Data/));
});

test("text size zooms text blocks and survives a reload", async ({ page }) => {
  await page.goto("/fixtures/en-wp-sourdough.html");
  await widget(page, '[data-lt="ax"]').click();
  await widget(page, '[aria-label="Larger text"]').click();
  await widget(page, '[aria-label="Larger text"]').click();
  const zoom = () =>
    page
      .locator(".entry-content p")
      .first()
      .evaluate((el) => getComputedStyle(el).zoom);
  // Polled: the change lands at the end of the crossfade's first frame, not synchronously.
  await expect.poll(zoom).toBe("1.3");
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/ax-text-130/);
  expect(await zoom()).toBe("1.3");
});

test("survives a hostile `* { all: unset }` page", async ({ page }) => {
  await page.goto("/fixtures/hostile-reset.html");
  const rail = widget(page, ".rail");
  await rail.waitFor();
  const style = await widget(page, ".speed").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      size: cs.fontSize,
      height: cs.height,
      family: cs.fontFamily,
      rail: getComputedStyle(el.parentElement as Element).backgroundColor,
    };
  });
  expect(style).toMatchObject({
    rail: "rgb(22, 21, 19)",
    size: "10px",
    height: "32px",
  });
  expect(style.family).not.toContain("Comic");
  const play = widget(page, '[data-lt="play"]');
  // Really on top and clickable, not just present.
  const box = await play.boundingBox();
  if (!box) throw new Error("no play button box");
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x as number, y as number)?.tagName,
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  expect(hit).toBe("LANTUN-READER");
  await play.click();
  await expect(widget(page, ".rail[data-active]")).toBeVisible();
});

test("destroy() leaves the page exactly as it was", async ({ page }) => {
  await page.goto("/fixtures/en-news-flood.html");
  await widget(page, '[data-lt="play"]').waitFor();
  const before = await page.evaluate(() => document.body.innerHTML);
  await widget(page, '[data-lt="play"]').click();
  await widget(page, '[data-lt="ax"]').click();
  await widget(page, ".sw").filter({ hasText: "Dark" }).click();
  await page.evaluate(() => window.LantunReader.destroy());
  const after = await page.evaluate(() => ({
    body: document.body.innerHTML,
    hosts: document.querySelectorAll("lantun-reader, lantun-overlay").length,
    styles: document.querySelectorAll("#lantun-ax, #lantun-highlight").length,
    classes: Array.from(document.documentElement.classList).filter((c) => c.startsWith("ax-")),
    highlights: (CSS as unknown as { highlights: Map<string, unknown> }).highlights.size,
  }));
  expect(after).toEqual({
    body: before,
    hosts: 0,
    styles: 0,
    classes: [],
    highlights: 0,
  });
});

test("the dock and an open panel hold still, frame by frame, whatever is switched in the panel", async ({ page }) => {
  await page.goto("/fixtures/en-wp-font-size.html");
  await widget(page, '[data-lt="ax"]').click();
  await widget(page, ".panel").waitFor();
  await page.waitForTimeout(500); // entrance animations
  // Record where the dock and panel are painted on every frame from here on.
  await page.evaluate(() => {
    const root = document.querySelector("lantun-reader")?.shadowRoot;
    const seen = new Set<string>();
    (window as unknown as { __seen: Set<string> }).__seen = seen;
    const tick = (): void => {
      for (const sel of [".dock", ".panel"]) {
        const el = root?.querySelector(sel);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        seen.add(`${sel} ${Math.round(r.x)},${Math.round(r.y)} ${cs.transform} ${cs.opacity}`);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  const chip = (name: string) => widget(page, ".pchip").filter({ hasText: name });
  // Seizure-safe and ADHD switch "pause animations" on; leaving them switches it back off.
  for (const name of ["Dyslexia", "Seizure-safe", "Dyslexia", "ADHD", "Low vision"]) {
    await chip(name).click();
    await page.waitForTimeout(450);
  }
  const seen = await page.evaluate(() => [...(window as unknown as { __seen: Set<string> }).__seen]);
  expect(seen.filter((s) => s.startsWith(".dock"))).toHaveLength(1);
  expect(seen.filter((s) => s.startsWith(".panel"))).toHaveLength(1);
});
