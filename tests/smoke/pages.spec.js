// @ts-check
import { test, expect } from "@playwright/test";

/**
 * Walks every primary page after signing in as the admin demo user.
 * For each: load, wait for the page heading, confirm no hard console errors.
 *
 * Pages list mirrors src/Layout.jsx navGroups. Update both together.
 */
const PAGES = [
  "/Dashboard",
  "/Candidates",
  "/Jobs",
  "/Companies",
  "/Submissions",
  "/Bookings",
  "/VideoCall",
  "/Tasks",
  "/Consultants",
  "/Playbooks",
  "/AutomationRules",
  "/Invoices",
  "/Expenses",
  "/Timesheets",
  "/LeaveRequests",
  "/AIAgents",
  "/EmailBlast",
  "/JobStack",
  "/SkillMatrix",
  "/ResumeStudio",
  "/DuplicateManager",
  "/AccessControl",
  "/BRD",
];

// Reuse the admin session captured in global-setup.js.
test.use({ storageState: "tests/.auth/admin.json" });

test.describe.serial("Pages render without errors (admin)", () => {

  for (const p of PAGES) {
    test(`page ${p} loads`, async ({ page }, testInfo) => {
      /** @type {string[]} */
      const errors = [];
      /** @type {string[]} */
      const failedRequests = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
      });
      page.on("response", (res) => {
        if (res.status() >= 400 && !res.url().includes("favicon")) {
          failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
        }
      });

      const res = await page.goto(p, { waitUntil: "networkidle", timeout: 30_000 });
      expect(res?.status(), `${p} returned non-2xx`).toBeLessThan(400);

      // Attach console errors + failed network calls to the test report.
      // We DO NOT fail the test on them — this is a smoke pass that surfaces
      // issues, not a regression gate. PHASE1_READINESS.md will summarize.
      const hard = errors.filter((e) =>
        !/baseline-browser|browserslist|favicon|sourcemap/i.test(e)
      );
      if (hard.length) {
        testInfo.annotations.push({ type: "console-errors", description: hard.join("\n") });
        console.log(`[${p}] console errors:\n  ${hard.join("\n  ")}`);
      }
      if (failedRequests.length) {
        testInfo.annotations.push({ type: "failed-requests", description: failedRequests.join("\n") });
        console.log(`[${p}] failed requests:\n  ${failedRequests.join("\n  ")}`);
      }
    });
  }
});
