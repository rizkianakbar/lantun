import { defineConfig, devices } from "@playwright/test";

// E2E_PORT points the suite at another dev server, e.g. while one is already running on 5173.
const base = `http://localhost:${process.env.E2E_PORT ?? 5173}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: base },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: base,
    reuseExistingServer: !process.env.CI,
  },
});
