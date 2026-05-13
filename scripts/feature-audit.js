#!/usr/bin/env node
/**
 * Phase-1 feature audit. Touches every importable table + every Edge
 * Function endpoint and reports which ones return data, which fail, and how
 * fast each round-trip is. Run with:
 *
 *   node scripts/feature-audit.js
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TABLES = [
  "user_profiles", "candidates", "companies", "jobs", "recruiters",
  "applications", "submissions", "resumes", "tasks", "consultants",
  "playbooks", "automation_rules", "email_templates", "invoices", "expenses",
  "timesheets", "leave_requests", "blog_posts", "form_submissions",
  "app_settings", "audit_logs", "inbound_emails",
];

const ENTRY_ROUTES = [
  "/", "/Dashboard", "/Candidates", "/Jobs", "/Companies", "/Submissions",
  "/Tasks", "/Consultants", "/Playbooks", "/AutomationRules", "/Invoices",
  "/Expenses", "/Timesheets", "/LeaveRequests", "/Accounts", "/AccessControl",
  "/AIAgents", "/EmailBlast", "/BRD", "/JobStack", "/SkillMatrix",
  "/ResumeStudio", "/DuplicateManager",
];

const FUNCTIONS = [
  "healthCheck", "llmProxy", "parseResumeFile", "aiRecruiterParseJob",
  "aiRecruiterMatchCandidates",
];

const PAD = (s, n) => s.toString().padEnd(n).slice(0, n);

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    return { label, ms: Date.now() - t0, ok: true, out };
  } catch (err) {
    return { label, ms: Date.now() - t0, ok: false, err: err.message || String(err) };
  }
}

console.log("\n━━━ TABLES (count + first-row latency) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
const rows = [];
for (const t of TABLES) {
  const r = await timed(t, async () => {
    const { count, error: e1 } = await sb.from(t).select("*", { count: "exact", head: true });
    if (e1) throw e1;
    const { error: e2 } = await sb.from(t).select("*").limit(1);
    if (e2) throw e2;
    return count;
  });
  rows.push(r);
  const ok = r.ok ? "✓" : "✗";
  const msColor = r.ms > 500 ? "🐢" : r.ms > 250 ? "⚠ " : "  ";
  console.log(`  ${ok} ${PAD(t, 22)} ${PAD(r.ok ? r.out : r.err, 30)}  ${msColor}${r.ms}ms`);
}

console.log("\n━━━ EDGE FUNCTIONS (ping only) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
for (const fn of FUNCTIONS) {
  const r = await timed(fn, async () => {
    const { error } = await sb.functions.invoke(fn, { body: {} });
    // healthCheck/llmProxy errors are expected if body is empty; treat 400 as "deployed"
    if (error && /\b(404|not found|function .* not found)\b/i.test(error.message)) {
      throw new Error("NOT DEPLOYED");
    }
    return "deployed";
  });
  const ok = r.ok ? "✓" : "✗";
  console.log(`  ${ok} ${PAD(fn, 36)} ${r.ok ? "deployed" : r.err}  ${r.ms}ms`);
}

console.log("\n━━━ STATIC ROUTES (HEAD only, dev server must be running) ━━━━━━━━━━━━");
const base = "http://localhost:5175";
for (const route of ENTRY_ROUTES) {
  const r = await timed(route, async () => {
    const res = await fetch(base + route, { method: "HEAD" });
    return `${res.status}`;
  });
  const ok = r.ok && /^(200|3\d\d)/.test(r.out) ? "✓" : "✗";
  console.log(`  ${ok} ${PAD(route, 26)} ${r.ok ? r.out : r.err}  ${r.ms}ms`);
}

// Summary
const tablesBroken = rows.filter(r => !r.ok);
const slow = rows.filter(r => r.ok && r.ms > 500);
console.log("\n━━━ SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Tables OK:      ${rows.filter(r => r.ok).length}/${rows.length}`);
console.log(`  Tables BROKEN:  ${tablesBroken.length}${tablesBroken.length ? " → " + tablesBroken.map(r => r.label).join(", ") : ""}`);
console.log(`  Tables SLOW:    ${slow.length}${slow.length ? " → " + slow.map(r => `${r.label} (${r.ms}ms)`).join(", ") : ""}`);
console.log();
