// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("login page renders with logo + 3 demo accounts", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto("/login");
    await expect(page.locator("img[alt='Recruiter X']")).toBeVisible();
    await expect(page.getByRole("button", { name: /admin/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /recruiter/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /accounts/i }).first()).toBeVisible();
    // "Supabase not connected" banner must NOT be present when env is set.
    await expect(page.getByText(/Supabase not connected/i)).toHaveCount(0);

    // Allow benign warnings (eg. baseline-browser-mapping) but no hard errors.
    const hard = errors.filter((e) => !/baseline-browser|browserslist/i.test(e));
    expect(hard, `Console errors:\n${hard.join("\n")}`).toEqual([]);
  });

  test("admin demo sign-in lands on dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /^admin/i }).first().click();
    // Wait for either Dashboard heading or any header showing user is in
    await page.waitForURL(/\/Dashboard/, { timeout: 30_000 });
    await expect(page.locator("body")).not.toContainText("Sign in to your workspace");
  });
});
