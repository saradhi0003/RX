// @ts-check
/**
 * Full new-user journey (L18/L19 end-to-end):
 *   signup → email verification → blocked pending approval → admin approves
 *   → login → MFA (TOTP) enrollment → re-login through the 2FA challenge.
 *
 * Email verification is completed via the Supabase admin API (no inbox
 * needed), which requires RX_SERVICE_ROLE_KEY in the environment:
 *   RX_SERVICE_ROLE_KEY=$(supabase … ) RX_TEST_URL=http://localhost:5173 \
 *     npx playwright test tests/smoke/signup-journey.spec.js
 * The spec is skipped when the key is absent.
 */
import { test, expect } from "@playwright/test";
import { authenticator } from "otplib";

const SRK = process.env.RX_SERVICE_ROLE_KEY;
const SUPA = process.env.RX_SUPABASE_URL || "https://bwjfglerixssibenkjse.supabase.co";
const EMAIL = `rx.journey.${Date.now()}@talentstack.org`;
const PASSWORD = "Jrny!Xk9mQz7Lp2w";

const admin = (path, opts = {}) =>
  fetch(`${SUPA}${path}`, {
    ...opts,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });

test.describe.serial("New-user journey: signup → verify → approve → MFA → login", () => {
  test.skip(!SRK, "RX_SERVICE_ROLE_KEY not set");
  let userId;

  test.afterAll(async () => {
    if (userId) await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  });

  test("1. signup shows verify-email state (no session issued)", async ({ page }) => {
    await page.goto("/Register");
    await page.getByPlaceholder("Jane Doe").fill("Journey Tester");
    await page.getByPlaceholder("jane@company.com").fill(EMAIL);
    await page.getByPlaceholder(/characters/i).fill(PASSWORD);
    await page.getByRole("button", { name: /continue/i }).click();
    // Built-in Supabase SMTP is hard-capped at ~2 emails/hour. If the cap is
    // hit, fall back to admin-creating the (unconfirmed) user so the rest of
    // the journey still runs. With custom SMTP configured this path is unused.
    const rateLimited = await page
      .getByText(/rate limit/i)
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (rateLimited) {
      const r = await admin("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: false }),
      });
      expect(r.ok, "admin fallback user creation").toBe(true);
      test.info().annotations.push({ type: "note", description: "email send rate-limited; user admin-created (configure custom SMTP to exercise the true email path)" });
    } else {
      await expect(page.getByText(/verify your email/i)).toBeVisible({ timeout: 15000 });
    }
  });

  test("2. verify email (admin API stands in for the inbox link)", async () => {
    const res = await admin(`/auth/v1/admin/users?per_page=100`).then((r) => r.json());
    const u = (res.users || []).find((x) => x.email === EMAIL);
    expect(u, "signup created the auth user").toBeTruthy();
    userId = u.id;
    const upd = await admin(`/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ email_confirm: true }),
    });
    expect(upd.ok).toBe(true);
  });

  test("3. verified login is blocked pending admin approval", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    // profile bootstraps as 'invited'; the access gate must bounce the user
    await page.waitForTimeout(7000);
    expect(page.url()).not.toMatch(/Dashboard/);
  });

  test("4. admin approves → login reaches Dashboard", async ({ page }) => {
    const ok = await admin(`/rest/v1/user_profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(ok.ok).toBe(true);
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/Dashboard/, { timeout: 20000 });
  });

  test("5. MFA enroll, then re-login requires + accepts TOTP", async ({ page }) => {
    // login
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/Dashboard/, { timeout: 20000 });

    // enroll at /Security with a real generated code
    await page.goto("/Security");
    await page.getByRole("button", { name: /add authenticator/i }).click();
    const secret = (await page.locator("code").first().textContent({ timeout: 15000 })).trim();
    await page.locator("#enroll-code").fill(authenticator.generate(secret));
    await page.getByRole("button", { name: /verify & enable/i }).click();
    await expect(page.getByText(/now enabled/i)).toBeVisible({ timeout: 15000 });

    // fresh session → challenge → wrong code rejected → correct code passes
    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/two-factor verification/i)).toBeVisible({ timeout: 20000 });
    await page.locator("#mfa-code").fill("000000");
    await page.getByRole("button", { name: /^verify$/i }).click();
    await expect(page.getByText(/invalid|try again/i)).toBeVisible({ timeout: 10000 });
    await page.locator("#mfa-code").fill(authenticator.generate(secret));
    await page.getByRole("button", { name: /^verify$/i }).click();
    await page.waitForURL(/Dashboard/, { timeout: 20000 });
  });
});
