import { expect, test, type Page } from '@playwright/test'
import { installSpeechStub } from './speech-stub'

const highlightText = (page: Page, name: string) =>
  page.evaluate((n) => {
    const h = (CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights.get(n)
    return h ? Array.from(h, (r) => r.toString()) : null
  }, name)

const articleHtml = (page: Page, selector: string) => page.locator(selector).evaluate((el) => el.innerHTML)

for (const [file, selector] of [
  ['en-news-flood.html', '.read__content'],
  ['id-news-banjir.html', '.read__content'],
  ['en-wp-sourdough.html', '.entry-content'],
] as const) {
  test(`${file}: highlights sentence and word with the Highlight API, DOM untouched`, async ({ page }) => {
    await page.addInitScript(installSpeechStub)
    await page.goto(`/fixtures/${file}`)
    await page.waitForFunction(() => window.LantunReader?.isInitialized())
    const before = await articleHtml(page, selector)

    await page.evaluate(() => {
      const w = window as unknown as { lastWord: string }
      window.LantunReader.on('word', (p) => (w.lastWord = (p as { text: string }).text))
      window.LantunReader.play()
    })
    await expect.poll(() => highlightText(page, 'lantun-word')).toHaveLength(1)
    await page.evaluate(() => window.LantunReader.pause())

    const [word] = (await highlightText(page, 'lantun-word')) ?? []
    expect(word).toBe(await page.evaluate(() => (window as unknown as { lastWord: string }).lastWord))
    const [sentence] = (await highlightText(page, 'lantun-sentence')) ?? []
    expect(sentence).toContain(word)
    expect(await page.locator('#lantun-highlight').count()).toBe(1)
    expect(await page.locator('lantun-overlay').count()).toBe(0)
    expect(await articleHtml(page, selector)).toBe(before)

    await page.evaluate(() => window.LantunReader.destroy())
    expect(await highlightText(page, 'lantun-word')).toBeNull()
    expect(await page.locator('#lantun-highlight').count()).toBe(0)
  })
}

test('auto-scroll follows the reading position', async ({ page }) => {
  await page.addInitScript(installSpeechStub)
  await page.setViewportSize({ width: 1000, height: 600 })
  await page.goto('/fixtures/en-news-flood.html')
  await page.waitForFunction(() => window.LantunReader?.isInitialized())
  expect(await page.evaluate(() => scrollY)).toBe(0)
  await page.evaluate(() => window.LantunReader.play())
  await expect.poll(() => page.evaluate(() => scrollY), { timeout: 5000 }).toBeGreaterThan(200)
})

test('falls back to estimated words when the voice has no boundaries', async ({ page }) => {
  await page.addInitScript(installSpeechStub, { boundaries: false, wordMs: 300 })
  await page.goto('/fixtures/en-wp-dieng.html')
  await page.waitForFunction(() => window.LantunReader?.isInitialized())
  await page.evaluate(() => {
    const w = window as unknown as { estimated: boolean[] }
    w.estimated = []
    window.LantunReader.on('word', (p) => w.estimated.push((p as { estimated: boolean }).estimated))
    window.LantunReader.play()
  })
  await expect.poll(() => highlightText(page, 'lantun-word'), { timeout: 3000 }).toHaveLength(1)
  expect(await page.evaluate(() => (window as unknown as { estimated: boolean[] }).estimated.every(Boolean))).toBe(true)
})
