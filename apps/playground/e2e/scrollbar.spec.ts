import { expect, test } from "@playwright/test";
import { installSpeechStub } from "./speech-stub";

// A classic, space-taking scrollbar, as on Windows or with "always show scrollbars" on macOS.
// Headless Chromium hides scrollbars unless told not to; WebKit's are always overlays.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSpeechStub, { wordMs: 120 });
});

test("the dock and its panels stay clear of a visible page scrollbar", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "only Chromium shows a space-taking scrollbar here");
  await page.goto("/fixtures/en-news-flood.html");
  await page.waitForTimeout(500); // entrance animation

  const visible = await page.evaluate(() => document.documentElement.clientWidth);
  const dock = await page.locator("lantun-reader .dock").boundingBox();

  if (!dock) throw new Error("no dock");
  expect(page.viewportSize()?.width ?? 0).toBeGreaterThan(visible);
  expect(visible - (dock.x + dock.width)).toBeCloseTo(12, 0);

  await page.locator('lantun-reader [data-lt="voice"]').click();
  const pop = await page.locator("lantun-reader .voicepop").boundingBox();

  if (!pop) throw new Error("no popover");
  expect(pop.x + pop.width).toBeLessThanOrEqual(visible);
});
