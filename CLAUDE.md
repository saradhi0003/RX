# CLAUDE.md — Recruiter X

Guidance for Claude Code (and developers) working in this repo. Nested
`CLAUDE.md` files add directory-specific detail — read the one closest to the
files you're editing.

## What this is
Recruiter X (branded **TalentStack**) — an AI-assisted recruiting CRM. Vite +
React 18 SPA on a Supabase backend (Postgres + Auth + Edge Functions + Storage),
a tri-provider LLM abstraction (OpenAI / Anthropic / Ollama) with server-side
keys, and LiveKit video calls. Live on Vercel at `rx-self.vercel.app`.

**Deep design doc:** [ARCHITECTURE.md](ARCHITECTURE.md). **Testing:**
[TESTING.md](TESTING.md).

## Commands
```bash
npm run dev            # Vite dev server (http://localhost:5173)
npm run build          # production build → dist/
npm run lint           # ESLint (src/components, src/pages, Layout only)
npm run typecheck      # tsc over JS via jsconfig (checkJs)
npm test               # Vitest unit/integration (jsdom + MSW)
npm run test:smoke     # Playwright e2e (needs a dev server up)
npm run test:all       # vitest + playwright

cd mobile && npm start        # Expo dev server (the mobile client)
cd mobile && npm run typecheck   # tsc over the Expo app
cd mobile && npm run build:web   # expo export — CI parity check
```

## Architecture in one screen
- **Entry/routing:** [src/main.jsx](src/main.jsx) → [src/App.jsx](src/App.jsx).
  Pages are registered + lazy-loaded in [src/pages.config.js](src/pages.config.js).
  `PrivateRoute`/`PublicRoute` guard auth. Auth pages render outside `<Layout>`.
- **Data access:** never call `supabase.from(...)` in a component. Use an entity:
  `import { Candidate } from "@/entities/Candidate"` → `Candidate.list/filter/get/
  create/update/delete`. All entities are one line over
  [src/lib/entityFactory.js](src/lib/entityFactory.js).
- **Visibility = RLS.** There is **no app-level org filter**; the DB decides what
  rows a user sees. (Multi-tenant `workspace_id` scoping is in progress on branch
  `feat/multi-tenancy-p0-1` — see ARCHITECTURE.md §24 and the migration.)
- **LLM:** use [src/lib/llm.js](src/lib/llm.js) (`invokeLLM/invokeLLMJson/
  invokeLLMStream`). It routes through the `llmProxy` Edge Function so **API keys
  stay server-side**. Don't add `VITE_*` LLM keys — only `VITE_SUPABASE_*` are
  meant to be public/bundled.
- **Backend logic:** Supabase Edge Functions (Deno) in
  [supabase/functions/](supabase/functions/); schema/RLS in
  [supabase/migrations/](supabase/migrations/).
- **Second client:** [mobile/](mobile/) is an Expo app on the **same** Supabase
  project, functions and RLS — no backend is duplicated. See
  [mobile/README.md](mobile/README.md).
- **File uploads:** always via `UploadFile()` in
  [src/integrations/Core.js](src/integrations/Core.js) — never
  `supabase.storage.upload` directly. The `uploads` bucket is private and keyed
  on `<user-id>/…` (migration 023). **Persist the returned `path`, not
  `file_url`** (a signed URL that expires in an hour), and render stored
  references with [`<FileLink>`](src/components/common/FileLink.jsx).

## Conventions
- **Import alias:** `@/` → `src/` (configured in vite, vitest, jsconfig).
- **Styling:** Tailwind + shadcn/Radix. Compose classes with `cn()` from
  [src/lib/utils.js](src/lib/utils.js). Brand palette (purple `#9333EA`, blue
  `#2563EB`, slate) is themed via CSS vars in [tailwind.config.js](tailwind.config.js).
- **UI primitives:** `src/components/ui/*` is vendored shadcn — don't hand-edit;
  regenerate via the shadcn CLI ([components.json](components.json)).
- **List tables:** don't hand-roll per-page sort/resize. Reuse the shared hooks
  (`@/hooks/useTableSort`, `@/hooks/useColumnResize`) + `DataTableProvider`/
  `SortableHead` (`@/components/common/DataTable`). See
  [src/components/CLAUDE.md](src/components/CLAUDE.md) → "Shared list tables".
- **JSX, not TSX.** Types are checked from JSDoc via `checkJs` (jsconfig).
- **React 18 transform:** no `import React` needed just to render JSX.
- **Dates:** Base44-compat alias — rows expose `created_date` (mirrors
  `created_at`); the factory adds it. Prefer `created_at` in new DB code.

## Guardrails (read before you change these)
- **`main` auto-deploys to Vercel prod on push.** Anything requiring a DB
  migration (e.g. a schema change + the code that depends on it) must ship
  together and be verified on a preview Supabase first — keep it on a branch
  until then. Precedent: `feat/multi-tenancy-p0-1`.
- **Env keys:** `VITE_*` vars are inlined into the browser bundle at build time.
  Never put a secret behind a `VITE_` prefix. Server secrets go in Supabase Edge
  Function secrets.
- **Migrations are additive + ordered** (`00N_name.sql`) and applied manually to
  Supabase — pushing a migration file does NOT run it.
- **RLS is the security boundary.** When adding a table, add a policy; don't rely
  on the client filtering.
- Don't commit `.env.local`, `data-import/` (PII), or test artifacts (gitignored).

## Current state / gotchas (2026-07-11)
- **Supabase is LIVE again (verified 2026-08-07).** The long-standing "project is
  paused" note above this line was stale: `/auth/v1/health` returns GoTrue
  v2.195.0 and PostgREST answers on every table. Free tier still auto-pauses
  after ~7 days idle, so re-probe before believing either state.
  RLS re-verified the same day — the anon/publishable key reads `[]` from
  `candidates`, `jobs`, `companies`, `user_profiles` and `invoices`, i.e. 020's
  `auth_is_approved()` gate is holding.
- **Installable PWA (2026-08-07):** `public/manifest.webmanifest` + `public/icons/`
  + a hand-rolled worker in [public/sw.js](public/sw.js), registered from
  [src/lib/registerSW.js](src/lib/registerSW.js) in **prod only** (a worker in dev
  fights Vite HMR). No `vite-plugin-pwa` — zero new deps.
  **It is app-shell only, not offline-first, and must stay that way:** the worker
  touches same-origin GETs only, so no Supabase row data, token or PII can reach
  CacheStorage. Navigations are network-first (`public/offline.html` is the
  fallback) and `index.html` is never cached, so a Vercel deploy goes live
  immediately; only content-hashed `/assets/*` is cache-first. Bump `VERSION` in
  `sw.js` to invalidate its caches; `unregisterServiceWorker()` is the escape
  hatch if a bad worker ever ships. `vercel.json` serves `sw.js` `must-revalidate`
  — keep it that way or a broken worker sticks. Guarded by
  `tests/unit/lib/pwa.test.js` (static, so it runs while Supabase is paused).
- **List tables are sortable + resizable** (2026-07-11): shared hooks
  `@/hooks/useTableSort` + `@/hooks/useColumnResize` and
  `DataTableProvider`/`SortableHead` now back every data-grid tab (Invoices,
  Consultants, Recruiters, Expenses, AccessControl, Approvals, Companies, Tasks).
  Column widths persist per-tab in `localStorage`. See
  [src/components/CLAUDE.md](src/components/CLAUDE.md) + [TESTING.md](TESTING.md) §17a.
- **AI-core work on branch `feat/ai-core`** (2026-07-11): LLM cost ceilings at all
  aiRecruiter* entry points + per-request cap + `LLMBudgetError`; PII scrubbing
  (`_shared/pii.ts`, `@/utils/piiScrubber`); `useEntityList` + `EmptyState`
  error-state pattern; AI Agents persisted (migration **017**); generic approval
  queue (`approval_items`, migration **018**);
  LLM cost dashboard on /SystemHealth; atomic send lock in `sendApprovedDraft`.
  017/018 were **applied** on 2026-07-27, clearing that deploy gate. See GAPS.md
  for per-layer status.
- **P0 work in flight:** P0-2 (camera/mic `Permissions-Policy` fix) is on `main`;
  P0-1 multi-tenancy is on `feat/multi-tenancy-p0-1` (migration 012 + signup
  change + a pending Edge-Function `workspace_id` audit). See the plan in
  ARCHITECTURE.md §24 and the branch.
- **Auth (2026-07-06):** MFA (TOTP) merged + e2e-proven; email verification ON;
  HIBP + password policy; CSP/HSTS headers; **new signups need admin approval**
  (status='invited' → Access Control). See AUTH_SETUP.md + GAPS.md.
- **Approval gate moved into the DB (2026-07-27, `feat/ai-core`):** the gate was
  UI-only — 002's policies are `USING (auth.uid() IS NOT NULL)`, so an 'invited'
  user could read the whole CRM via PostgREST. Migration **020** compiles
  `auth_is_approved()` into every policy, hardens `auth_is_admin()`, and blocks
  self-approval via `user_profiles`; `functions/_shared/auth.ts`
  (`requireApprovedUser`) is the Edge-Function twin, since the service role
  bypasses RLS. **Migrations 017–022 are APPLIED** to the live project as of
  2026-07-27 and verified end-to-end; re-verify with the curl tests in
  AUTH_SETUP.md §4 after any policy change.
- **FinTracker feature port (2026-07-29, `feat/ai-core`):** the enterprise
  features built in FinTracker, re-expressed for this stack. Pattern doc
  vendored at [skills/mfa-totp/](skills/mfa-totp/) — **read it before touching
  any auth gate.**
  - **Idle sign-out** — `@/hooks/useIdleLogout`, wired once in `AuthContext`;
    20 min, persisted clock. AUTH_SETUP.md §6.
  - **Upload storage (migration 023) — APPLIED & verified 2026-08-03.** Before
    that the `uploads` bucket **never existed** on the live project, so every
    upload path failed with "Bucket not found"; the `{file_url}` destructuring
    bug (`UploadFile()` returned `{url, path}`) turned that into a silent
    `undefined` at all eight call sites. 023 creates it private + capped with
    policies on `auth_is_approved()` and writes scoped to `<uid>/…`.
    **Still open:** legacy `resume_url` values point at publicly-readable Base44
    URLs outside this project. AUTH_SETUP.md §7.
  - **Expo mobile app** — [mobile/](mobile/), biometric lock + upload pipeline.
    Needs `eas init` before it can build. AUTH_SETUP.md §8.
  - Feature A (MFA + approval gate) and SMTP layer 2 were **already done** here;
    the `/services` bots hold no service-role key (they post to
    `channelMessageWebhook` with a shared secret), so the backend twin is the
    Edge Functions, already gated.
  - Still outstanding, manual: Supabase Auth **custom SMTP** (§5 layer 1). This
    line used to also list migration 023 — applied 2026-08-03, along with 024.

## Verified against the live DB (2026-08-08)
Re-probed the project directly rather than trusting the notes above; three
things the docs got wrong:
- **023 and 024 are applied** (2026-08-03). Several docs still said "staged".
- **`agents` / `agent_runs` / `approval_items` are not workspace-scoped.** 024's
  `tenant_tables[]` array omits them. Their policy *name* is still
  `*_all_authenticated`, but 020 rewrote the *body* to `auth_is_approved()` — so
  the approval gate holds and only cross-tenant isolation is missing.
  **Audit policy bodies, not names.** Fixed by migration **025** (written, not
  yet applied — all three tables are empty, so it is a zero-risk apply).
- **`checkDailyCeiling()` was a no-op** — nothing server-side ever wrote to
  `llm_usage`. Fixed; see GAPS.md L9.
- `vector` 0.8.0, `pg_cron` and `pgmq` are **available but not installed**.
