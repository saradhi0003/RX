// @ts-check
import { defineConfig, devices } from "@playwright/test";

/**
 * Recruiter X smoke test config.
 * Run:  npm run test:smoke
 * One-off page:  npx playwright test tests/smoke/dashboard.spec.js
 */
export default defineConfig({
  testDir: "./tests/smoke",
  globalSetup: "./tests/global-setup.js",
  fullyParallel: false,            // dev server is single-tenant
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,                  // some pages do AI calls
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.RX_TEST_URL || "http://localhost:5175",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Don't spin up its own dev server — assume one is already running.
  webServer: undefined,
});
