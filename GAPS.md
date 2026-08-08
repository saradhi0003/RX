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
  error states** (P1 — worst UX bug in the app; bit us in prod already).
  **Partially fixed 2026-07-11 (feat/ai-core):** `useEntityList` hook +
  `EmptyState` component exist and are live on AIAgents, ApprovalQueue, and the
  LLM cost dashboard. Remaining: roll out to the other ~40 list pages.
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
- ~~`llm_usage` cost data captured but **no cost dashboard**~~ **Done 2026-07-11
  (feat/ai-core):** `LLMCostDashboard` on /SystemHealth — 7d/30d spend, daily
  trend, cost by model, slowest tasks. Client-side aggregation (move to RPC at scale).

### 5. Execution Layer (sends / actions)
**State:** Email/SMS sends via Edge Functions; `recruiter_activities` logged;
automation actions in `executeAutomation.jsx`.
**Gaps:**
- **No retry / dead-letter** for failed sends — a failed send is just a log row (P2)
- ~~No idempotency key on outbound sends~~ **Done 2026-07-11 (feat/ai-core):**
  `sendApprovedDraft` claims the draft atomically (approved → sending; conditional
  update = the lock); concurrent send → 409; network failure releases the lock.

### 6. Retrieval Layer (query / search)
**State:** react-query (`retry:1`, no focus refetch), `$like → ilike` filters,
FTS indexes exist in migration 001.
**Gaps:**
- UI search mostly uses `ilike` — **FTS indexes barely exercised** (P3)
- ~~No vector/semantic search over candidates/resumes~~ **Done 2026-08-08
  (migration 026, applied & verified 12/12).** pgvector 0.8.0 + `doc_chunks`
  (HNSW cosine, `vector(768)`) + `search_candidates_hybrid()` — a three-channel
  RRF fusion over chunk BM25, chunk cosine and the `candidates.fts` tsvector
  that 004 built and nothing ever queried. `SECURITY INVOKER`, no anon EXECUTE,
  `search_path` pinned to `public, extensions, pg_temp` (the `extensions` entry
  is required — Supabase installs `vector` there, and 021's usual `public,
  pg_temp` pin makes the type unresolvable).
  Proven live: with the vector index empty it degrades to the structured
  channel; with embeddings present, a candidate matching two channels correctly
  outranks single-channel matches, and the fused scores match
  `w/(k+rank)` exactly.
  **⚠ Corpus correction:** the plan assumed `resumes.raw_text` held every
  resume. It does not — `resumes` has **0 rows**. The 890 candidates carry the
  text (546 with skills, 558 with a title, 61 with a substantial summary → 556
  embeddable), and 718 `resume_url` values point at Base44 URLs whose files sit
  outside this project. `doc_chunks.source_table` is generic, so resumes slot in
  unchanged when their text lands. Backfill is ~$0.005, and the index is ~3 MB —
  the free-tier storage concern raised during planning was overstated.
  **Remaining:** run the backfill (`embedDocuments` until `remaining: 0`), and
  the UI's `ilike` search still does not use the RPC (deliberately out of scope —
  a separate UX change with its own risk).

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
- ~~No cost ceilings or rate limits~~ **Done 2026-07-11 (feat/ai-core):** daily
  ceiling (`checkDailyCeiling`, `LLM_DAILY_COST_CEILING_USD`) now enforced at
  llmProxy **and** all three aiRecruiter* entry points (429); per-request input
  cap (`LLM_MAX_PROMPT_CHARS`, default 48k chars) inside `invokeLLM`; the client
  surfaces 429 as `LLMBudgetError`.
- ⚠ **The ceiling above was a no-op until 2026-08-08.** `checkDailyCeiling()`
  sums `llm_usage.cost_usd`, but **nothing server-side ever inserted a row** —
  the only writer was `src/lib/llm.js`, which hardcoded `cost_usd: 0` because
  `llmProxy` returned no token data. So `spent` was always `0`, `spent < 10` was
  always true, and the rail never engaged. **Fixed:** new
  `_shared/pricing.ts` (`MODEL_PRICES` + `estimateCost`, longest-prefix match so
  dated snapshots resolve; non-zero fallback so an unknown model cannot silently
  disable the ceiling); the three provider callers in `_shared/llm.ts` now return
  real token counts and `invokeLLM` writes the `llm_usage` row itself (with
  `workspace_id` explicit — service role bypasses the stamp trigger); the client
  skips its duplicate zero-cost insert when the proxy reports `usage_logged`.
  Guarded by `tests/unit/lib/pricing.test.js` (15 tests, runs offline).
  `checkDailyCeiling` now also accepts a `workspaceId` so one tenant cannot
  exhaust another's budget, and prefers an `llm_spend_today()` RPC (added with
  the retrieval migration) over the previous unaggregated full-day row scan.
- No per-user/per-workspace quotas — needs `workspace_id` on `llm_usage`, lands
  with multi-tenancy (P2)

### 10. LLM Context Layer
**State:** Prompt builders assemble job/candidate context; `.slice(0,3000)`
truncation; JSON-mode instructions.
**Gaps:**
- ~~No PII scrubbing~~ **Done 2026-07-11 (feat/ai-core):** `scrubForLLM`
  (`_shared/pii.ts` + `src/utils/piiScrubber.js` mirror) masks emails/phones/
  SSNs/LinkedIn URLs; applied to the match + draft prompt free-text fields.
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
- ~~`scheduledFollowupRun` has no CRON_SECRET gate~~ **Done (earlier pass):**
  `x-cron-secret` header check against the `CRON_SECRET` Edge secret; gate
  disabled with a warning only when the secret is unset (local dev).
- 11 functions insert tenant rows via service-role → must stamp `workspace_id`
  when 012 lands (P0, tied to layer 11)
- Inbound webhooks need a workspace-routing rule post-012 (P0, design decision)

### 14. Agentic Layer (AI recruiter pipeline)
**State:** parse → match → draft → approve → send pipeline works end-to-end;
runs tracked in `ai_recruiter_runs`.
**Gaps:**
- ~~No cost ceiling on sweeps~~ **Done 2026-07-11 (feat/ai-core):** daily ceiling
  checked at every aiRecruiter* entry point; match sweeps already batch 10-wide.
- Runs not resumable after mid-pipeline failure (P2)
- **AI Agents page now DB-backed** (2026-07-11, feat/ai-core): `agents` +
  `agent_runs` tables (migration 017, staged), `Agent`/`AgentRun` entities,
  AIAgents.jsx off mock data. Remaining: the execution engine (`runAgent`
  ReAct loop, P3) — agents persist but do not run yet.
- ⚠ **Verified 2026-08-08: nothing anywhere writes `agent_runs` or
  `approval_items`.** There is no `runAgent`, no tool-calling loop and no
  dispatcher, so a saved agent never executes, the page's "Total Runs" and
  "Success Rate" tiles are permanently 0, and `approval_items` (L15) still has
  no producer. The `"3"` badge on the AI Agents nav item was a hardcoded string
  in `Layout.jsx`, wrong since the day it was written — **removed** 2026-08-08
  rather than left lying; a real count lands with the engine.

### 15. Investigation & Execution Layer (human-in-the-loop)
**State:** Good — ApprovalQueue + DraftEditor + EmailDraftReview enforce human
approval before sends. **Generalized 2026-07-11 (feat/ai-core):** new
`approval_items` table (migration 018, staged) + "Agent Actions" queue tab with
risk tiers, AI confidence, due-time, and bulk-approve-low-risk — any agent/
automation action can now queue for human review, not just email drafts.
**Gaps:**
- No test proving an unapproved draft cannot be sent (approval-bypass audit) (P2)
- Nothing writes to `approval_items` yet — producers land with the agent
  execution engine (P3)

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
- ~~No responsive design at all~~ **Partially done 2026-08-08.** `Layout.jsx`
  had **zero** `@media` rules and a nav that only opened on `onMouseEnter` —
  hover does not exist on touch, so the flyout was effectively unopenable on a
  phone, while the PWA manifest actively invites phone installs. `useIsMobile`
  existed but was imported only by the vendored shadcn `sidebar.jsx`, which no
  page uses. **Fixed:** new `@/hooks/useDevice` (`isMobile/isTablet/isDesktop/
  isTouch/isStandalone/orientation`) driven entirely by `matchMedia` — **no
  user-agent sniffing**, since `(pointer: coarse)` answers the question that
  actually matters and survives a mid-session switch between mouse and touch.
  The rail is now tap-to-open on coarse pointers with a dismiss scrim and Escape
  handling, an off-canvas drawer behind a hamburger under 768px, ≥44px tap
  targets, and `env(safe-area-inset-*)` padding in standalone mode. `FlyoutItem`
  already accepted an `onNavigate` that nothing passed — now wired, so tapping a
  destination dismisses the drawer instead of landing behind it.
  Guarded by `tests/unit/ui/useDevice.test.jsx` (14 tests).
  **Remaining:** per-page data grids still scroll horizontally on a phone rather
  than collapsing to cards (P2), and the bottom tab bar is not built (P3).

### 18b. Signup approval (added 2026-07-06)
**DONE:** new signups get `user_profiles.status='invited'` (migration 016) and are
blocked by the existing Layout/AccessBlocker gate until an admin sets them
Active in Access Control. Demos pre-approved. Server-side RLS enforcement of
approval rides with the 012 policy swap (phase B).

### 18. Login Page
**State:** Password + magic-link + demo accounts; e2e green (2/2); banner when
Supabase unconfigured.
**Gaps:**
- Demo buttons break if "Confirm email" is enabled (documented in AUTH_SETUP.md)
- No rate-limit/captcha on the form (Supabase has server-side limits) (P3)

### 19. MFA Authentication
**State:** **DONE — merged + e2e-verified with real TOTP (2026-07-06)**; was built on branch `feat/auth-mfa-email` — TOTP enroll (QR) /
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
