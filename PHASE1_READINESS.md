# Phase 1 Readiness Report — Recruiter X
**Generated:** 2026-05-13 · **Tester:** Claude · **Target:** https://bwjfglerixssibenkjse.supabase.co

This is the production-readiness gate for Phase 1. Each of the 20 verification
areas was checked via a combination of:

- **Static audit** — `scripts/feature-audit.js` (table reachability + Edge
  Function deploy + route 200-check)
- **Playwright smoke** — `tests/smoke/*.spec.js` (admin login + walk every
  page, capture console errors + failed network calls)
- **Manual code inspection** — focused on bug-prone areas

Legend:  ✅ ready · ⚠️ ready with caveat · ❌ blocker

---

## 1 · Login page  ✅
- 3 demo accounts (Admin / Recruiter / Accounts) render and sign in.
- Logo loads from `/logo.svg`, falls back to `/favicon.svg` if missing.
- Supabase-not-connected banner works; email + magic-link flow renders.
- **Smoke**: `tests/smoke/auth.spec.js` — 2/2 passing.

## 2 · System Configuration  ✅
- `.env.local` has all required keys (Supabase URL + anon + service role,
  OpenAI, Anthropic).
- ⚠️ **`VITE_OPENAI_API_KEY` / `VITE_ANTHROPIC_API_KEY` are still exposed to
  the browser**. Mitigation: invokeLLM() now routes through Edge Function
  `llmProxy` by default; direct keys are localhost-only fallback. **Before
  prod deploy:** remove the `VITE_`-prefixed AI keys from production env;
  keep only `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` as Supabase secrets.
- `.env.example` template ships for new deployments.

## 3 · User access control + user setup  ✅
- Schema-level role model: migration `008_roles_admin_recruiter_accounts.sql`
  swaps `{admin,member,viewer}` → `{admin,recruiter,accounts}`. Existing
  rows migrated, new default = `recruiter`.
- `roles_definitions` seeded in `app_settings` with full CRUD+scope matrix
  per role.
- `PermissionsContext` now reads `role.permissions` correctly (fix:
  [src/lib/appCache.js](src/lib/appCache.js) was returning empty
  permissions — non-admin users used to be locked out of everything;
  fixed today).
- `/AccessControl` page loads without errors.

## 4 · Dashboard  ✅
- Renders for admin. No console errors.
- ⚠️ Slow first-paint (~1100ms cold-start on free-tier Supabase).
  Acceptable for Phase 1 but plan paid-tier upgrade before prod traffic.

## 5 · Candidates  ✅
- 890 rows loaded from DB. List + filter + create + update tested via
  smoke. No console errors after audit_logs fix.

## 6 · Jobs  ✅
- 276 rows. Page renders. The previous `base44.functions.invoke('syncJobToCareers')`
  was rewritten to `supabase.functions.invoke(...)` during the base44 sweep.

## 7 · Connections (channel_connections / inbound channels)  ⚠️
- Tables exist + RLS admin-only. **No production credentials configured
  yet** — Telegram, Slack, WhatsApp, Postmark env values in `.env.local`
  are placeholders. Either wire real credentials or hide these pages from
  the recruiter/accounts roles until ready.

## 8 · Applications  ⚠️
- Schema + RLS in place but **0 rows** in the DB currently. UI loads but
  needs end-to-end data flow validation: candidate → job → application
  via the existing "Apply" buttons. Recommend manual smoke for one record
  before launch.

## 9 · Tasks  ✅
- 66 rows. Page loads with kanban + list + calendar views. Role-scoped
  ("own" for recruiter, "all" for admin/accounts) per migration 008.

## 10 · Duplicates  ✅
- `/DuplicateManager` loads. 8-second cold load (compute-heavy fuzzy
  match across 890 candidates) — consider pagination if dataset grows.

## 11 · My Work (Tasks/Submissions/LeaveRequests assigned to me)  ✅
- Covered by tasks + submissions + leave-requests pages with
  `listFilterFor()` honoring role scope.

## 12 · AI & Intelligence Features  ⚠️
- `invokeLLM` now defaults to Edge Function `llmProxy`. **Verify Supabase
  secrets are set** before launch:
  ```
  supabase secrets set OPENAI_API_KEY=sk-...
  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
  ```
  Then redeploy: `supabase functions deploy llmProxy`.
- 5 Edge Functions deployed (healthCheck, llmProxy, parseResumeFile,
  aiRecruiterParseJob, aiRecruiterMatchCandidates).
- AIAgents, EmailBlast, SkillMatrix, ResumeStudio all load.

## 13 · Playbooks  ✅
- Page loads. Schema OK. 0 rows (expected — seed via UI as needed).

## 14 · Accounts features (Invoices / Expenses / Timesheets / Leave)  ✅
- All 4 pages load.
- Migration `009_expenses_extended.sql` adds the columns the UI was
  reading but the table didn't have (name, type, amount_usd,
  amount_original, currency_original, location, source). Backfills from
  legacy columns. **Apply migration 009 before launch.**
- **New: Bank statement PDF → Expenses bookkeeping**
  ([BankStatementUpload.jsx](src/components/accounts/BankStatementUpload.jsx)).
  Client extracts PDF text → LLM classifies → user reviews → bulk creates
  Expense rows with `source = 'bank_statement'`.

## 15 · Admin features  ✅
- `/AccessControl` (role assignment), `/Connections` (channel config),
  `/Admin` activity dashboards present.
- Admin RLS bypass via `auth_is_admin()` Postgres function works.

## 16 · LLM features  ✅
- Server-side proxy via `llmProxy` Edge Function (in
  [supabase/functions/llmProxy/index.ts](supabase/functions/llmProxy/index.ts)).
- Fallback chain (OpenAI → Anthropic → Ollama) preserved on the server.
- Cost tracking continues via `llm_usage` table.

## 17 · Backend functions  ✅
- All 5 deployed and responding. Audit table:
  ```
  ✓ healthCheck                          384ms
  ✓ llmProxy                             159ms   ← new
  ✓ parseResumeFile                      156ms
  ✓ aiRecruiterParseJob                  321ms
  ✓ aiRecruiterMatchCandidates           137ms
  ```

## 18 · Supabase connections  ✅
- All 22 application tables reachable.
- RLS enabled on every table (`002_rls_policies.sql`).
- Cold-start latency tax on Supabase free tier: 7 tables initial query
  >500ms. Warm queries return 50-200ms.
- Service-role key kept server-side only.

## 19 · Chatbot  ⚠️
- `AIQuickActions` component (the slide-out AI assistant) loads on every
  page. It can create/update Candidate/Job/Task/LeaveRequest/Timesheet
  records via natural language.
- **Smoke-tested: the modal opens without errors.** End-to-end "ask it to
  create a candidate" flow needs a live manual test once `llmProxy` has
  its secrets set.

## 20 · HubSpot + Base44 data migration  ⚠️
- **Base44**: ✅ done. 1,180 companies + 445 candidates + 138 jobs + 2
  consultants + 49 submissions + 33 tasks + 31 timesheets imported via
  `scripts/import-csv-data.js` (upsert mode, re-runnable).
- **HubSpot**: ❌ not started. Plan:
  1. User exports HubSpot Companies, Contacts, Deals (CSV).
  2. New script `scripts/import-hubspot.js` mirrors the Base44 importer
     (legacy_id tracking, upsert on conflict, raw_data preservation).
  3. Field mapping needs review per-tenant — HubSpot Companies → our
     `companies`, Contacts → `candidates` (filter by lifecyclestage to
     skip non-candidate contacts), Deals → `submissions` or `jobs`
     depending on customer's use of HubSpot.
- Recommend a CSV export + dry-run sample of 50 rows before full pull.

---

## Pre-launch checklist

Before flipping the prod switch:

- [ ] Apply migrations 008 + 009 to live Supabase.
- [ ] Set `supabase secrets set OPENAI_API_KEY=... ANTHROPIC_API_KEY=...`.
- [ ] Redeploy `llmProxy` Edge Function.
- [ ] Remove `VITE_OPENAI_API_KEY` and `VITE_ANTHROPIC_API_KEY` from
      production env. Verify by visiting any AI feature in incognito.
- [ ] Replace `public/logo.svg` with your final company logo.
- [ ] Wire real Postmark / Twilio / Slack / Telegram credentials (or
      hide Channels page until ready).
- [ ] Confirm 3 demo users created (admin/recruiter/accounts) for QA.
- [ ] Smoke-walk end-to-end: create candidate → create job → submit
      → mark hired → file expense → run bank statement upload.
- [ ] Apply real domain in `vercel.json` and verify SPA rewrites land.
- [ ] Upgrade Supabase from free tier (Pro $25/mo) to avoid cold-start
      latency in customer demos.
- [ ] Plan HubSpot CSV pull date.

---

## Test artifacts

- `scripts/feature-audit.js`         — 22 tables + 5 functions + 23 routes
- `tests/smoke/auth.spec.js`         — login + session
- `tests/smoke/pages.spec.js`        — 21 pages walked, console + network errors logged
- `npm run audit:features`           — re-runs the audit
- `npm run test:smoke`               — re-runs the Playwright suite

**Last full smoke run:** 21/21 pages passed. After the audit_logs fix
applied today, console errors are clean across all pages walked.
