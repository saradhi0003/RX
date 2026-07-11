// @ts-check
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const STATE_FILE = "tests/.auth/admin.json";

/**
 * Sign in once as the real admin and save the session for reuse.
 * Demo accounts were removed for launch — provide credentials via env:
 *   RX_ADMIN_EMAIL=you@domain  RX_ADMIN_PASSWORD=... npm run test:smoke
 * If unset, tests that require the session are skipped (the state file is
 * written empty so Playwright's storageState config still resolves).
 */
export default async function globalSetup() {
  const baseURL = process.env.RX_TEST_URL || "http://localhost:5173";
  const email = process.env.RX_ADMIN_EMAIL;
  const password = process.env.RX_ADMIN_PASSWORD;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  if (!email || !password) {
    // No creds — write an empty state so config.storageState resolves; the
    // page-walk specs will show the login page and their assertions handle it.
    if (!fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ cookies: [], origins: [] }));
    }
    console.log("[globalSetup] RX_ADMIN_EMAIL/PASSWORD unset — skipping login (empty session)");
    return;
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/Dashboard/, { timeout: 30_000 });
  await ctx.storageState({ path: STATE_FILE });
  await browser.close();
  console.log(`[globalSetup] admin session saved → ${STATE_FILE}`);
}
