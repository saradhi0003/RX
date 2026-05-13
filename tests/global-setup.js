// @ts-check
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const STATE_FILE = "tests/.auth/admin.json";

export default async function globalSetup(config) {
  // Sign in as the admin demo user once and save the session so individual
  // tests can reuse it via test.use({ storageState }).
  const baseURL = process.env.RX_TEST_URL || "http://localhost:5175";
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();

  await page.goto("/login");
  await page.getByRole("button", { name: /^admin/i }).first().click();
  await page.waitForURL(/\/Dashboard/, { timeout: 30_000 });
  await ctx.storageState({ path: STATE_FILE });
  await browser.close();
  console.log(`[globalSetup] admin session saved → ${STATE_FILE}`);
}
