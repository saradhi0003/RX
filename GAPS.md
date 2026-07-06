# Recruiter X — 20-Layer Gap Analysis

End-to-end review of the application across the 20-layer model (2026-07-05).
Each layer: what exists today, the gaps found, and a priority.

- **P0** — blocks correctness/security for real use; fix first
- **P1** — security/correctness risk; fix soon
- **P2** — quality/scale; schedule
- **P3** — nice-to-have

Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md) (system design),
[TESTING.md](TESTING.md) (how to test each layer),
[AUTH_SETUP.md](AUTH_SETUP.md) (MFA/email-verification dashboard steps).

---

## Layer-by-layer

### 1. Frontier Layer (SPA shell / routing)
**State:** Solid — lazy-loaded routes via [src/pages.config.js](src/pages.config.js),
auth guards in [src/App.jsx](src/App.jsx), 404 handling, Suspense loader.
**Gaps:**
- No React **error boundary** — a render error white-screens the app (P2)
- `VisualEditAgent` + `NavigationTracker` ship in the prod bundle (P3)

### 2. Data Layer
**State:** Clean single pattern — [src/lib/entityFactory.js](src/lib/entityFactory.js)
over Supabase; RLS decides visibility; MSW-tested.
**Gaps:**
- Entity `throw`s are swallowed by most callers → **blank tables instead of
  error states** (P1 — worst UX bug in the app; bit us in prod already)
- No pagination — hard `limit 200` default (P2)

### 3. Semantic Layer (matching / scoring)
**State:** Live LLM matching (`aiRecruiterMatchCandidates`, AdvancedScoring,
MatchExplanationCard) with min-score filtering + ranking.
**Gaps:**
- No eval harness / golden tests for match quality — regressions invisible (P2)
- Score calibration unvalidated (a "72" means nothing verified) (P3)

### 4. Business Intelligence Layer
**State:** Dashboard + PipelineAnalytics + widgets render green in e2e.
**Gaps:**
- All aggregation client-side over `limit 200` fetches — wrong at scale (P2)
- `llm_usage` cost data captured but **no cost dashboard** (P2)

### 5. Execution Layer (sends / actions)
**State:** Email/SMS sends via Edge Functions; `recruiter_activities` logged;
automation actions in `executeAutomation.jsx`.
**Gaps:**
- **No retry / dead-letter** for failed sends — a failed send is just a log row (P2)
- No idempotency key on outbound sends (double-click → double-send risk) (P2)

### 6. Retrieval Layer (query / search)
**State:** react-query (`retry:1`, no focus refetch), `$like → ilike` filters,
FTS indexes exist in migration 001.
**Gaps:**
- UI search mostly uses `ilike` — **FTS indexes barely exercised** (P3)
- No vector/semantic search over candidates/resumes (P3 — future)

### 7. Strategies (rules / playbooks / scoring profiles)
**State:** AutomationRules + Playbooks + MatchingProfileEditor CRUD all work.
**Gaps:**
- Rule evaluator has **zero tests** and no dry-run preview (P2)
- No versioning/audit of strategy changes (P3)

### 8. API Layer
**State:** Supabase REST + 17 Edge Functions; security headers via vercel.json.
**Gaps:**
- ~~healthCheck shallow + SystemHealth shape mismatch~~ — **fixed this pass**
- No contract tests for Edge Function request/response shapes (P2)
- CORS is `*` on all functions (P2 — tighten to app origins)

### 9. LLM Reasoning Layer
**State:** Strong — [src/lib/llm.js](src/lib/llm.js) routes via `llmProxy`
(keys server-side), fallback chain, streaming, cost logging to `llm_usage`.
**Gaps:**
- **No cost ceilings or rate limits** — a runaway loop can spend without bound
  (P1; StockAnalysis has `*_COST_CEILING` — port the concept) (P1)
- No per-user/per-workspace quotas (P2)

### 10. LLM Context Layer
**State:** Prompt builders assemble job/candidate context; `.slice(0,3000)`
truncation; JSON-mode instructions.
**Gaps:**
- **No PII scrubbing** before sending candidate data to providers (P2)
- No prompt snapshot/golden tests — silent prompt drift (P2)

### 11. Database Backend
**State:** 46 tables, migrations 001–011 applied, FTS indexes, triggers.
**Gaps:**
- **Multi-tenancy: every RLS policy is `auth.uid() IS NOT NULL`** — any signed-in
  user sees all data. Migration `012_multitenancy.sql` is ready on branch
  `feat/multi-tenancy-p0-1`; needs preview-DB verification + merge (**P0**)
- Free-tier auto-pause (~7 days idle) took prod down once already — Pro plan or
  keep-alive (P1, operational)

### 12. Backend Functions (Edge)
**State:** 17 functions, shared client/LLM/error modules; now a central
[env.ts](supabase/functions/_shared/env.ts) (this pass).
**Gaps:**
- **`scheduledFollowupRun` has no CRON_SECRET gate** — anyone with the URL can
  trigger the send run (P1)
- 11 functions insert tenant rows via service-role → must stamp `workspace_id`
  when 012 lands (P0, tied to layer 11)
- Inbound webhooks need a workspace-routing rule post-012 (P0, design decision)

### 14. Agentic Layer (AI recruiter pipeline)
**State:** parse → match → draft → approve → send pipeline works end-to-end;
runs tracked in `ai_recruiter_runs`.
**Gaps:**
- **No cost ceiling / concurrency cap on sweeps** (StockAnalysis:
  `PER_SWEEP_COST_CEILING`, `SWEEP_CONCURRENCY=3`) (P1)
- Runs not resumable after mid-pipeline failure (P2)

### 15. Investigation & Execution Layer (human-in-the-loop)
**State:** Good — ApprovalQueue + DraftEditor + EmailDraftReview enforce human
approval before sends.
**Gaps:**
- No test proving an unapproved draft cannot be sent (approval-bypass audit) (P2)

### 16. Orchestration Layer
**State:** Inbound webhooks → classify → route; daily follow-up cron; unique
`message_id` gives idempotent inbound ingestion.
**Gaps:**
- Cron endpoint unauthenticated (ties to CRON_SECRET, P1)
- No retry/dead-letter for failed pipeline stages (P2)

### 17. UX/UI
**State:** 23/23 pages load clean in e2e; TalentStack design system; keyboard
shortcuts; command palette.
**Gaps:**
- **Blank rows on error/logged-out** instead of empty/error states (P1, same as L2)
- Main bundle 808 kB + VideoCall 654 kB — needs `manualChunks` (P2)
- No a11y pass (roles/contrast audit) (P3)

### 18. Login Page
**State:** Password + magic-link + demo accounts; e2e green (2/2); banner when
Supabase unconfigured.
**Gaps:**
- Demo buttons break if "Confirm email" is enabled (documented in AUTH_SETUP.md)
- No rate-limit/captcha on the form (Supabase has server-side limits) (P3)

### 19. MFA Authentication
**State:** **Built** on branch `feat/auth-mfa-email` — TOTP enroll (QR) /
challenge / route-guard enforcement + Security page + 6 unit tests.
**Gaps:**
- Needs preview verification + merge + the AUTH_SETUP.md dashboard steps (**P0-user**)
- No e2e with a real TOTP secret yet (otplib helper planned, P2)

### 20. API Keys Health ("all keys return results")
**State (after this pass):** **Implemented** — central env modules
([_shared/env.ts](supabase/functions/_shared/env.ts) server,
[src/lib/env.js](src/lib/env.js) client) + upgraded `healthCheck` that
live-probes OpenAI, Anthropic, LiveKit, email provider, DB, storage and returns
`{ok, message, latency_ms}` per service + env-presence map; rendered on
**/SystemHealth**. Also fixed the SystemHealth shape mismatch (page expected
objects, function returned booleans).
**Gaps:**
- Needs `supabase functions deploy healthCheck` + secrets set to go live
- Playwright assertion on /SystemHealth (planned in TESTING.md) (P2)

---

## Recommended fix order

1. **Merge `feat/auth-mfa-email`** (L19) — user does AUTH_SETUP.md dashboard steps
2. **Multi-tenancy** (L11/L12) — preview-test migration 012, add workspace
   stamping to the 11 service-role functions, decide inbound routing, merge
   `feat/multi-tenancy-p0-1`
3. **CRON_SECRET gate + LLM/agent cost ceilings** (L12/L9/L14) — small, high value
4. **Error surfacing / empty states** (L2/L17) — kills the "blank rows" class of bugs
5. P2s: contract tests, retry/dead-letter, cost dashboard, bundle split,
   PII scrubbing, eval harness, rule-evaluator tests
6. P3s as they come up

*Generated 2026-07-05 on branch `feat/env-health`.*
