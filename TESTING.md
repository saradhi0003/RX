# Recruiter X — Testing Guide

How to test every layer of Recruiter X. The app is a Vite + React SPA on a
Supabase backend (Postgres + Auth + Edge Functions + Storage), with a
tri-provider LLM abstraction and LiveKit video. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

---

## 1. Test stack (installed)

| Tool | Purpose | Scope |
|------|---------|-------|
| **Vitest** 3 | Unit + integration test runner (jsdom) | logic, components |
| **@testing-library/react** + **user-event** | Render + interact with components | UI |
| **@testing-library/jest-dom** | DOM matchers (`toBeInTheDocument`, …) | UI |
| **jsdom** | Headless DOM for Vitest | UI |
| **MSW** 2 | Mock Supabase REST/Auth + LLM HTTP | data / API / LLM |
| **Playwright** | End-to-end browser flows | e2e / smoke |

### Layout
```
tests/
  unit/                 # Vitest — fast, mocked, no network
    setup.js            #   global setup (jest-dom + MSW lifecycle)
    msw/                #   mock network layer
      server.js
      handlers.js       #   default Supabase/LLM route mocks
    lib/   data/   ui/  #   tests grouped by layer
  smoke/                # Playwright — real browser, real (or seeded) backend
    auth.spec.js
    pages.spec.js
  global-setup.js       # Playwright: sign in once, reuse session
```

### Commands
```bash
npm test                # Vitest once (CI mode)
npm run test:watch      # Vitest watch mode
npm run test:ui         # Vitest browser UI
npm run test:coverage   # Vitest + v8 coverage (src/lib, src/entities, src/api)
npm run test:smoke      # Playwright (needs a dev server running)
npm run test:smoke:headed
npm run test:all        # Vitest then Playwright
```
> Playwright assumes a dev server is already up (`webServer: undefined`). Start
> one with `npm run dev` (or set `RX_TEST_URL`) before `test:smoke`.

### First-run install (already done here)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom msw
npx playwright install   # one-time: download browser binaries for e2e
```

---

## 2. Layer-by-layer test plan

Each layer below lists: **what it is in this app → where it lives → how to test
it → the tool.** Layers marked ⚠ are *not fully implemented yet*; the entry is a
forward test plan for when they land.

### 1. Frontier Layer (frontend shell / presentation surface)
- **Is:** the SPA entry, routing, route guards, lazy page loading, error/404.
- **Where:** [src/main.jsx](src/main.jsx), [src/App.jsx](src/App.jsx),
  [src/pages.config.js](src/pages.config.js), `PrivateRoute`/`PublicRoute`.
- **Test:** render `<App/>` in `MemoryRouter`; assert an unauthenticated visit to
  a protected route redirects to `/Login`, and an authed visit renders the page.
- **Tool:** Vitest + RTL (mock `useAuth`), plus Playwright for the real redirect.

### 2. Data Layer
- **Is:** `createEntity(table)` CRUD shim over Supabase + Base44-compat
  normalization (`created_at → created_date`, `$gt/$in/$like/$or` filters).
- **Where:** [src/lib/entityFactory.js](src/lib/entityFactory.js),
  [src/entities/](src/entities/), [src/lib/supabase.js](src/lib/supabase.js).
- **Test:** call `Candidate.list()/filter()/get()/create()` against MSW-mocked
  REST; assert query params, normalization, and error propagation.
- **Tool:** Vitest + MSW. **Example:** [tests/unit/data/entityFactory.test.js](tests/unit/data/entityFactory.test.js).

### 3. Semantic Layer (matching / meaning)
- **Is:** candidate↔job matching, scoring, skills extraction — the "does this
  candidate mean a fit" logic.
- **Where:** [src/components/ai/AdvancedCandidateMatching.jsx](src/components/ai/AdvancedCandidateMatching.jsx),
  `AdvancedScoring.jsx`, `src/components/ai-recruiter/MatchExplanationCard.jsx`,
  Edge fn `aiRecruiterMatchCandidates`.
- **Test:** unit-test the score-shaping/threshold/sort logic with fixed LLM JSON
  (mock `invokeLLMJson`); assert min-score filtering and ranking. Golden-file the
  match-explanation formatting.
- **Tool:** Vitest (mock the LLM module).

### 4. Business Intelligence Layer
- **Is:** dashboards, pipeline analytics, charts, LLM cost rollups.
- **Where:** [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx),
  [src/pages/PipelineAnalytics.jsx](src/pages/PipelineAnalytics.jsx),
  `src/components/dashboard/WidgetRenderer.jsx`, `llm_usage` table.
- **Test:** feed known row sets to the aggregation helpers; assert counts, funnel
  math, and currency/date formatting. Render charts and assert series/labels (not
  pixels). Follow the **dataviz** skill for any new chart.
- **Tool:** Vitest + RTL.

### 5. Execution Layer (actions / side-effects)
- **Is:** turning decisions into effects — sending email/SMS, status changes,
  running an automation rule's actions.
- **Where:** [src/components/automation/executeAutomation.jsx](src/components/automation/executeAutomation.jsx),
  `src/integrations/Core` (`SendEmail`, `SendSMS`, `UploadFile`), Edge fns
  `sendApprovedDraft`, `scheduledFollowupRun`.
- **Test:** mock the integration surface; assert the right action fires with the
  right payload and that a failed action is surfaced (not swallowed).
- **Tool:** Vitest (mock `@/api/integrations`) + Playwright for a full send.

### 6. Retrieval Layer (fetch / query / search)
- **Is:** react-query fetching, caching, and full-text search retrieval.
- **Where:** [src/lib/query-client.js](src/lib/query-client.js),
  `entityFactory.filter()`, `$like` → `ilike`, DB FTS indexes (migration 001),
  `src/components/playbooks/PlaybookSmartSearch.jsx`.
- **Test:** assert `filter({name:{$like:"%foo%"}})` issues an `ilike`; assert
  query cache keys and `retry:1` behavior; search returns expected rows via MSW.
- **Tool:** Vitest + MSW.

### 7. Strategies
- **Is:** configurable rule sets — automation rules, playbooks, scoring profiles,
  AI recruiter settings.
- **Where:** [src/pages/AutomationRules.jsx](src/pages/AutomationRules.jsx),
  `src/pages/Playbooks.jsx`, `src/components/ai/MatchingProfileEditor.jsx`,
  `ai_recruiter_settings` table.
- **Test:** unit-test the rule evaluator (trigger + condition → matched actions)
  with table-driven cases, including no-match and multi-condition.
- **Tool:** Vitest.

### 8. API Layer
- **Is:** the app's data/integration API surface + Edge Function HTTP contracts.
- **Where:** [src/api/entities.js](src/api/entities.js),
  [src/api/integrations.js](src/api/integrations.js), Supabase REST,
  `supabase/functions/*` HTTP handlers, [vercel.json](vercel.json) headers/rewrites.
- **Test:** contract-test each Edge Function (valid request → shape; bad/no-auth →
  4xx). Assert CORS + security headers. MSW for client-side; `supabase functions
  serve` + `curl`/Playwright APIRequest for the real functions.
- **Tool:** Vitest + MSW (client), Playwright `request` / curl (server).

### 9. LLM Reasoning Layer
- **Is:** the model calls that reason — scoring, drafting, classifying.
- **Where:** [src/lib/llm.js](src/lib/llm.js) (`invokeLLM/Json/Stream`),
  `supabase/functions/_shared/llm.ts`, `supabase/functions/llmProxy`.
- **Test:** mock the provider HTTP; assert (a) proxy path is used by default,
  (b) fallback chain advances on primary failure, (c) streaming accumulates,
  (d) cost logging fires non-blocking. Do **not** assert on live model text.
- **Tool:** Vitest + MSW. See §3 for the eval harness for prompt quality.

### 10. LLM Context Layer
- **Is:** prompt/context assembly — system prompts, the candidate/job context
  strings, truncation, JSON-mode instructions.
- **Where:** `aiRecruiterMatchCandidates` (`jobContext`/`candidateContext`),
  `_shared/classifier.ts`, `src/components/ai/*` prompt builders.
- **Test:** snapshot the assembled prompt for fixed inputs; assert required
  fields present, PII/secrets absent, and length caps applied (`.slice(0,3000)`).
- **Tool:** Vitest (golden/snapshot tests).

### 11. Database Backend
- **Is:** Postgres schema, migrations, **RLS**, triggers, indexes, views.
- **Where:** [supabase/migrations/](supabase/migrations/) (001–012).
- **Test:** apply migrations to a **local/preview** Supabase; assert tables,
  constraints, and triggers exist. **RLS isolation test** (critical for the
  multi-tenant work): two users in two workspaces cannot read each other's rows;
  an insert auto-stamps `workspace_id`. Run `npm run typecheck`-style parse first.
- **Tool:** `supabase db reset` on a local stack + Vitest/psql assertions.
  ⚠ Blocked while the prod DB is paused — run against a preview project.

### 12. Backend Functions (Supabase Edge Functions)
- **Is:** Deno functions: `llmProxy`, `livekitToken`, `transcribeRecording`,
  `scheduledFollowupRun`, the `aiRecruiter*` set, inbound webhooks.
- **Where:** [supabase/functions/](supabase/functions/).
- **Test:** `supabase functions serve <name>` then POST fixtures; assert status,
  JSON shape, auth enforcement, and that **service-role inserts set
  `workspace_id`** (post-012). Unit-test pure helpers in `_shared/` with Vitest.
- **Tool:** Supabase CLI + curl/Playwright request; Vitest for `_shared`.

### 14. Agentic Layer
- **Is:** multi-step AI agents — the AI recruiter run (parse → match → draft →
  approve → send) and the agent builder.
- **Where:** [src/pages/AIRecruiter.jsx](src/pages/AIRecruiter.jsx),
  `src/components/agents/AIAgentBuilder.jsx`,
  `src/components/ai/CandidateWorkflowAgent.jsx`,
  `src/components/ai-recruiter/*`.
- **Test:** drive the state machine with mocked LLM + data; assert each stage
  transitions and persists a `recruiter_activities` row; assert a mid-pipeline
  failure halts safely and is visible.
- **Tool:** Vitest (mock LLM + entities) + Playwright for the happy path.

### 15. Investigation & Execution Layer
- **Is:** the review/approval gate between AI proposal and real action — humans
  investigate a draft/match, then execute (approve → send).
- **Where:** [src/pages/ApprovalQueue.jsx](src/pages/ApprovalQueue.jsx),
  `src/components/approval-queue/DraftEditor.jsx`,
  `src/components/ai-recruiter/EmailDraftReview.jsx`, `sendApprovedDraft`.
- **Test:** assert an unapproved draft cannot be sent; edits persist; approve
  triggers exactly one send + status change; reject leaves no side-effects.
- **Tool:** Vitest + Playwright.

### 16. Orchestration Layer
- **Is:** wiring pipelines together — inbound → classify → route → create;
  cron-driven follow-ups; the refresh/event bus.
- **Where:** ARCHITECTURE.md §4, `scheduledFollowupRun`, inbound webhooks,
  `src/components/common/refreshBus`, `src/components/automation/*`.
- **Test:** end-to-end pipeline with mocked stages; assert ordering, idempotency
  (replayed webhook doesn't double-insert — `message_id` unique), and cron
  windowing.
- **Tool:** Vitest (integration) + Supabase CLI for the cron function.

### 17. UX/UI
- **Is:** components, pages, responsiveness, keyboard shortcuts, accessibility.
- **Where:** [src/components/](src/components/), [src/pages/](src/pages/),
  [src/Layout.jsx](src/Layout.jsx).
- **Test:** RTL render + interaction (roles, labels, focus); a11y assertions;
  Playwright for responsive + visual smoke across the page set.
- **Tool:** Vitest + RTL (**example:** [tests/unit/ui/button.test.jsx](tests/unit/ui/button.test.jsx)),
  Playwright [tests/smoke/pages.spec.js](tests/smoke/pages.spec.js).

### 18. Login Page
- **Is:** email/password sign-in, magic-link (OTP email), demo-account buttons,
  the "Supabase not connected" banner.
- **Where:** [src/pages/Login.jsx](src/pages/Login.jsx),
  [src/lib/AuthContext.jsx](src/lib/AuthContext.jsx).
- **Test:** render Login (in `MemoryRouter`); assert form + demo buttons; with
  `isSupabaseConfigured=false` the banner shows and submit is blocked; mock
  `supabase.auth.signInWithPassword` success → redirect. E2e via the existing
  Playwright [auth.spec.js](tests/smoke/auth.spec.js).
- **Tool:** Vitest + RTL, Playwright.

### 19. MFA Authentication ✅ (implemented + e2e)
- **Journey spec:** [tests/smoke/signup-journey.spec.js](tests/smoke/signup-journey.spec.js)
  drives signup → email verification (admin API stands in for the inbox) →
  blocked pending admin approval → approve → MFA enroll (real TOTP via otplib)
  → re-login through the challenge. Needs `RX_SERVICE_ROLE_KEY` env; skips
  without it. Note: built-in Supabase SMTP is capped ~2 emails/hour — with the
  cap hit the spec falls back to admin-created users; add custom SMTP
  (Resend/Postmark) to exercise the true email path.

### 19-legacy. MFA (original plan, superseded)
- **Status:** Login currently supports password + **magic-link OTP**
  (`signInWithOtp`) only — there is **no TOTP/MFA enrollment or challenge**.
  (`input-otp` is a UI primitive, not MFA.)
- **Plan for when added (Supabase MFA / `auth.mfa.*`):** unit-test the
  enroll→challenge→verify state machine (mock `mfa.enroll/challengeAndVerify`);
  assert a user with `aal2` required cannot reach protected routes at `aal1`;
  wrong code → error, no session upgrade. E2e enroll + login-with-code flow.
- **Tool:** Vitest + RTL, Playwright. **Track as a feature + its tests.**

### 20. API Keys / Integrations Health ("all keys return results")
- **Is:** a live connectivity check that each configured secret actually works:
  Supabase URL+anon key, OpenAI, Anthropic, LiveKit, email provider.
- **Where:** [src/pages/SystemHealth.jsx](src/pages/SystemHealth.jsx),
  Edge fn `healthCheck`, `scripts/feature-audit.js`.
- **Test:** an integration smoke that pings each provider through its Edge
  Function and asserts a 2xx + expected shape. Keep keys **server-side** (only
  `VITE_SUPABASE_*` are public) — never assert on raw keys, only on responses.
- **Tool:** Playwright `request` / a Node script hitting `healthCheck`; run in CI
  with test keys. ⚠ Depends on a live backend (blocked while DB is paused).
  Verify per [ARCHITECTURE.md §24](ARCHITECTURE.md) that the built bundle carries
  the right `VITE_SUPABASE_*` values (curl the deployed JS, grep the host/key).

---

## 3. LLM quality (evals) — beyond pass/fail

For layers 3, 9, 10, 14 the risk isn't a thrown error, it's a *bad answer*. Add a
small eval harness: a folder of `{input, rubric}` fixtures scored by an
LLM-as-judge (`gpt-4o-mini`), tracked over time. Keep evals **out of** `npm test`
(they cost money + vary) — run them on demand / nightly. Assert only structural
guarantees (valid JSON, score in range, required fields) in the unit suite.

## 4. CI ordering & gates
1. `npm run lint` · `npm run typecheck`
2. `npm test` (Vitest — must pass; the correctness gate)
3. `npm run build` (must succeed)
4. `npm run test:smoke` (Playwright — needs a preview backend)
5. RLS isolation + integrations health (needs a live/preview Supabase)

## 5. Known blockers (2026-06-21)
- **Supabase project paused** → layers 11, 12, 20 and Playwright e2e can't run
  against the real backend until restored. Vitest + MSW layers run fully offline.
- **Multi-tenancy (migration 012)** lives on branch `feat/multi-tenancy-p0-1`;
  its RLS isolation test (layer 11) is the acceptance gate before merge.
