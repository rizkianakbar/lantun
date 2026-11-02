import { defineConfig, devices } from '@playwright/test'

// Milestone 8: the production widget.js injected into live article pages (like the bookmarklet).
// Hits the real internet, so it is not part of `pnpm e2e`.
export default defineConfig({
  testDir: 'live',
  workers: 1,
  retries: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    // Sites with a strict CSP would otherwise refuse the injected script.
    bypassCSP: true,
    locale: 'id-ID',
  },
})
