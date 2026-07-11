// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("login page renders with the email/password form (demo accounts removed)", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto("/login");
    await expect(page.locator("img[alt='Recruiter X']")).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // Demo accounts are gone for launch.
    await expect(page.getByText(/try a demo account/i)).toHaveCount(0);
    // "Supabase not connected" banner must NOT be present when env is set.
    await expect(page.getByText(/Supabase not connected/i)).toHaveCount(0);

    const hard = errors.filter((e) => !/baseline-browser|browserslist/i.test(e));
    expect(hard, `Console errors:\n${hard.join("\n")}`).toEqual([]);
  });

  test("admin sign-in lands on dashboard", async ({ page }) => {
    const email = process.env.RX_ADMIN_EMAIL;
    const password = process.env.RX_ADMIN_PASSWORD;
    test.skip(!email || !password, "RX_ADMIN_EMAIL/PASSWORD not set");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(/** @type {string} */(email));
    await page.getByLabel(/password/i).fill(/** @type {string} */(password));
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/Dashboard/, { timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText("Sign in to your workspace");
  });
});
