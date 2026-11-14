import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installSpeechStub } from "./speech-stub";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSpeechStub, { wordMs: 120 });
});

test("the home page reads its own intro, and has no axe violations", async ({ page }) => {
  await page.goto("/");
  await page.locator("lantun-reader .dock").waitFor();
  await page.waitForTimeout(600); // entrance animations
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);

  await page.locator("#listen").click();
  await expect(page.locator('lantun-reader [data-lt="play"]')).toHaveAttribute("aria-label", "Pause");
  const first = await page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken?.[0]);
  expect(first).toContain("Turn any article");
});

test("colour and side follow through to the widget, the code and the sample links", async ({ page }) => {
  await page.goto("/");
  await page.locator("lantun-reader .dock").waitFor();
  await page.locator('input[name=color][value="#e11d48"]').check();
  await page.locator(".seg label", { hasText: "Left" }).click();

  await expect(page.locator("lantun-reader .lt")).toHaveAttribute("data-side", "left");
  await expect(page.locator("#snippets pre")).toContainText('data-color="#e11d48"');
  await expect(page.locator("#snippets pre")).toContainText('data-position="left"');
  // Highlighted like an editor, one numbered line per element, without changing the text.
  await expect(page.locator("#snippets .t-tag").first()).toHaveText("script");
  await expect(page.locator("#snippets .t-attr", { hasText: "data-color" })).toHaveCount(1);
  expect(await page.locator("#snippets .line").count()).toBe(6);
  expect(await page.locator("a[data-file]").first().getAttribute("href")).toContain("?color=%23e11d48&side=left");

  // A sample opened from here keeps the choices.
  await page.locator("a[data-file]").first().click();
  await expect(page.locator("lantun-reader .lt")).toHaveAttribute("data-side", "left");
});
