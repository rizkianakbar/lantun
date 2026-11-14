import { defineConfig, devices } from "@playwright/test";

// `pnpm --filter playground screenshots`: renders the README screenshots (docs/screenshots) and the
// site's share image and icons (public/) from the landing page. Not part of `pnpm e2e`.
const base = `http://localhost:${process.env.E2E_PORT ?? 5173}`;

export default defineConfig({
  testDir: "shots",
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: base,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
  webServer: {
    command: "pnpm dev",
    url: base,
    reuseExistingServer: true,
  },
});
