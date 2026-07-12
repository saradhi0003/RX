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
- **Supabase project is paused** (free tier auto-pause) → the live app shows empty
  data and e2e/DB tests can't run until it's restored.
- **List tables are sortable + resizable** (2026-07-11): shared hooks
  `@/hooks/useTableSort` + `@/hooks/useColumnResize` and
  `DataTableProvider`/`SortableHead` now back every data-grid tab (Invoices,
  Consultants, Recruiters, Expenses, AccessControl, Approvals, Companies, Tasks).
  Column widths persist per-tab in `localStorage`. See
  [src/components/CLAUDE.md](src/components/CLAUDE.md) + [TESTING.md](TESTING.md) §17a.
- **AI-core work on branch `feat/ai-core`** (2026-07-11): LLM cost ceilings at all
  aiRecruiter* entry points + per-request cap + `LLMBudgetError`; PII scrubbing
  (`_shared/pii.ts`, `@/utils/piiScrubber`); `useEntityList` + `EmptyState`
  error-state pattern; AI Agents persisted (migration **017**, staged);
  generic approval queue (`approval_items`, migration **018**, staged);
  LLM cost dashboard on /SystemHealth; atomic send lock in `sendApprovedDraft`.
  **Deploy gate:** migrations 017/018 must be applied to a live/preview DB before
  this branch merges (same precedent as 012). See GAPS.md for per-layer status.
- **P0 work in flight:** P0-2 (camera/mic `Permissions-Policy` fix) is on `main`;
  P0-1 multi-tenancy is on `feat/multi-tenancy-p0-1` (migration 012 + signup
  change + a pending Edge-Function `workspace_id` audit). See the plan in
  ARCHITECTURE.md §24 and the branch.
- **Auth (2026-07-06):** MFA (TOTP) merged + e2e-proven; email verification ON;
  HIBP + password policy; CSP/HSTS headers; **new signups need admin approval**
  (status='invited' → Access Control). See AUTH_SETUP.md + GAPS.md.
