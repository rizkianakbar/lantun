import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { installSpeechStub } from './speech-stub'

// The real script-tag install: the built IIFE, configured only by data-* attributes.
const widgetJs = readFileSync(fileURLToPath(new URL('../../cdn/dist/widget.js', import.meta.url)), 'utf8')
const voiceJs = readFileSync(fileURLToPath(new URL('../../cdn/dist/voice-kitten.js', import.meta.url)), 'utf8')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installSpeechStub)
  await page.route('**/cdn/widget.js', (route) => route.fulfill({ body: widgetJs, contentType: 'text/javascript' }))
  await page.route('**/cdn/voice-kitten.js', (route) => route.fulfill({ body: voiceJs, contentType: 'text/javascript' }))
  // Swap the playground's dev loader for the production tag, in <head> and without defer.
  // ?hd=before|after adds the HD voice add-on tag on either side of it.
  await page.route(/\/fixtures\/en-wp-dieng\.html/, async (route) => {
    const params = new URL(route.request().url()).searchParams
    const hd = params.get('hd')
    // ?csp=1 serves the page under a strict policy: no inline styles or scripts without the nonce.
    const nonce = params.get('csp') ? ' nonce="t3st"' : ''
    const widget = `<script src="/cdn/widget.js"${nonce} data-content-selector=".entry-content" data-color="#7c3aed" data-lang="en"></script>`
    const voice = '<script src="/cdn/voice-kitten.js"></script>'
    const tags = hd === 'before' ? voice + widget : hd === 'after' ? widget + voice : widget
    const html = (await (await route.fetch()).text())
      // Vite appends a cache-busting ?t= to the dev script URL.
      .replace(/<script type="module" src="\/src\/inject\.ts[^"]*"[^>]*><\/script>/, '')
      .replace(
        '</title>',
        `</title>${tags}<script${nonce}>window.__early = document.documentElement.className</script>`,
      )
    const headers: Record<string, string> = { 'content-type': 'text/html' }
    if (nonce) headers['content-security-policy'] = "default-src 'self'; script-src 'self' 'nonce-t3st'; style-src 'self' 'nonce-t3st'"
    await route.fulfill({ body: html, headers })
  })
})

test('auto-initialises from data attributes and exposes the global API', async ({ page }) => {
  await page.goto('/fixtures/en-wp-dieng.html')
  await page.locator('lantun-reader [data-lt="play"]').waitFor()
  expect(await page.evaluate(() => Object.keys(window.LantunReader).sort())).toEqual(['destroy', 'init', 'on', 'pause', 'play', 'registerVoices'])
  await page.evaluate(() => window.LantunReader.play())
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken?.[0])).toMatch(/^Nobody tells you/)
  const accent = await page.locator('lantun-reader .play').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(accent).toBe('rgb(124, 58, 237)')
})

test('applies saved accessibility settings before the body is parsed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lantun:ax', JSON.stringify({ contrast: 'high', text: 2 })))
  await page.goto('/fixtures/en-wp-dieng.html')
  expect(await page.evaluate(() => (window as unknown as { __early: string }).__early)).toContain('ax-contrast-high')
  await expect(page.locator('html')).toHaveClass(/ax-text-130/)
})

for (const order of ['before', 'after']) {
  test(`HD voice add-on registers when loaded ${order} widget.js, and downloads nothing until chosen`, async ({ page }) => {
    const fetched: string[] = []
    page.on('request', (r) => {
      if (/huggingface|jsdelivr/.test(r.url())) fetched.push(r.url())
    })
    await page.goto(`/fixtures/en-wp-dieng.html?hd=${order}`)
    await page.locator('lantun-reader [data-lt="voice"]').click()
    await expect(page.locator('lantun-reader .group').first()).toContainText('Lifelike voices')
    await expect(page.locator('lantun-reader .group').first()).toContainText('one-time 31 MB download')
    // HD voices come first: eight of them before the built-in group.
    await expect(page.locator('lantun-reader .voices .opt').nth(7)).toContainText('Female · United States')
    // The reader's own voice stays selected: HD needs a deliberate choice.
    await expect(page.locator('lantun-reader .voices [aria-checked="true"]')).toContainText('Stub')
    await page.waitForTimeout(500)
    expect(fetched).toEqual([])
  })
}

test('works under a strict Content-Security-Policy, reusing the script tag nonce', async ({ page }) => {
  const refused: string[] = []
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to apply/i.test(m.text()) && /lantun|style/i.test(m.text())) refused.push(m.text())
  })
  await page.goto('/fixtures/en-wp-dieng.html?csp=1')
  const play = page.locator('lantun-reader [data-lt="play"]')
  await play.waitFor()
  // Styled, not raw markup: the shadow stylesheet and the host's hardened inline style applied.
  expect(await play.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(124, 58, 237)')
  expect(await page.locator('lantun-reader').evaluate((el) => getComputedStyle(el).position)).toBe('fixed')
  await play.click()
  await page.locator('#lantun-highlight').waitFor({ state: 'attached' })
  expect(await page.evaluate(() => (document.getElementById('lantun-highlight') as HTMLStyleElement).nonce)).toBe('t3st')
  await page.locator('lantun-reader [data-lt="ax"]').click()
  await page.locator('lantun-reader .pchip', { hasText: 'Low vision' }).click()
  await expect.poll(() => page.locator('.entry-content p').first().evaluate((el) => getComputedStyle(el).zoom)).toBe('1.3')
  expect(refused.filter((t) => !/fixtures|assets/.test(t))).toEqual([])
})
