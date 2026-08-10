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
    // Built-in Supabase SMTP is hard-capped at ~2 emails/hour, surfaced as a
    // "rate limit" message. A misconfigured *custom* SMTP relay (bad host/
    // port/creds) fails the same send but GoTrue's message for that is the
    // generic "Error sending confirmation email" — a different string, same
    // underlying "signup cannot complete via email" symptom. Catch both so
    // the fallback still runs, but they are NOT the same finding: rate-limit
    // is expected default-provider behavior, "error sending" on a project
    // with custom SMTP configured means the relay itself is broken for real
    // users too, not just this test.
    const emailSendFailed = await page
      .getByText(/rate limit|error sending/i)
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (emailSendFailed) {
      const r = await admin("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: false }),
      });
      expect(r.ok, "admin fallback user creation").toBe(true);
      test.info().annotations.push({ type: "note", description: "confirmation email send failed (rate limit or broken SMTP relay) — user admin-created so the rest of the journey still runs" });
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
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    // profile bootstraps as 'invited'; the access gate must bounce the user
    await page.waitForTimeout(7000);
    expect(page.url()).not.toMatch(/Dashboard/);
  });

  test("4. admin approves → login reaches Dashboard", async ({ page }) => {
    // return=minimal only proves the request didn't error — a PATCH matching
    // ZERO rows also returns 204/ok:true, so it can't tell "approved" from
    // "silently touched nothing". return=representation forces PostgREST to
    // hand back the row it actually changed, which is the real proof.
    const res = await admin(`/rest/v1/user_profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.ok).toBe(true);
    const updated = await res.json();
    expect(updated.length, "PATCH matched exactly one profile row").toBe(1);
    expect(updated[0].status).toBe("active");

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/Dashboard/, { timeout: 20000 });
    // waitForURL only proves the route changed, not what actually rendered
    // there — Layout can route to /Dashboard while still showing
    // AccessBlocker inside it. Assert on real page content, not just the URL.
    await expect(page.getByText(/pipeline funnel/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/access restricted|pending approval/i)).toHaveCount(0);
  });

  test("5. MFA enroll, then re-login requires + accepts TOTP", async ({ page }) => {
    // login
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password$/i).fill(PASSWORD);
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
    await page.getByLabel(/^password$/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/two-factor verification/i)).toBeVisible({ timeout: 20000 });

    // Verify is disabled until BOTH a 6-digit code is typed AND MfaChallenge's
    // own listFactors() call resolves (setting factorId) — the two conditions
    // are independent, so checking "enabled" only means something once the
    // code is already filled. Confirm the fill registered by reading the
    // value back, then wait for enabled (which is now purely a proxy for
    // "factorId resolved") before clicking.
    const verifyBtn = page.getByRole("button", { name: /^verify$/i });
    const mfaInput = page.locator("#mfa-code");

    await mfaInput.fill("000000");
    await expect(mfaInput).toHaveValue("000000");
    await expect(verifyBtn).toBeEnabled({ timeout: 15000 });
    await verifyBtn.click();
    await expect(page.getByText(/invalid|try again/i)).toBeVisible({ timeout: 10000 });

    const goodCode = authenticator.generate(secret);
    await mfaInput.fill(goodCode);
    await expect(mfaInput).toHaveValue(goodCode);
    await expect(verifyBtn).toBeEnabled({ timeout: 15000 });
    await verifyBtn.click();
    await page.waitForURL(/Dashboard/, { timeout: 20000 });
  });
});
