import { expect, test } from '@playwright/test'
import { fixtures } from '../fixtures'

for (const f of fixtures) {
  test(`${f.file} loads the widget without errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`/fixtures/${f.file}`)

    await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${f.lang}(-|$)`))
    await expect(page.locator('h1').first()).toBeVisible()
    await page.waitForFunction(() => window.LantunReader?.isInitialized())
    expect(errors).toEqual([])
  })
}
