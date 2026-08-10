# KIMI.md — Recruiter X / TalentStack

Guidance for Kimi Code (and any AI assistant) working in this repo.  
**Goal:** keep turns short, avoid re-reading huge files, and never explore code that is already documented here.

## 1. Read this first, then the nested KIMI.md

- `src/kimi.md` — frontend (Vite + React, entities, UI, hooks).
- `supabase/kimi.md` — backend (Edge Functions, migrations, RLS).
- `mobile/kimi.md` — Expo app.
- `tests/kimi.md` — test commands, patterns, fixtures.
- `scripts/kimi.md` — repo automation scripts.
- `services/kimi.md` — Telegram/Slack/WhatsApp bots.

Only read a nested file if your change touches that directory.  
For cross-cutting changes, read the two or three relevant nested files **in parallel**, not the whole repo.

## 2. One-paragraph project summary

Recruiter X (brand: **TalentStack**) is an AI-assisted recruiting CRM.
- **Frontend:** Vite 6 + React 18 SPA, Tailwind + shadcn/ui.
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions/Deno, Storage).
- **LLM:** multi-provider abstraction (OpenAI / Anthropic / DeepSeek / Alibaba DashScope / local Qwen / Ollama / LM Studio) via `src/lib/llm.js` and `supabase/functions/llmProxy`. **Local-first:** models prefixed `local/` (e.g. `local/google/gemma-4-12b-qat`) route to the LM Studio fleet through `scripts/tunnel-lmstudio.sh` at zero cost; on failure the Edge Function falls back DeepSeek → Qwen → `claude-3-5-haiku-20241022` (whichever keys exist). Runtime model routing is configured in `ai_recruiter_settings`.
- **Comms:** Postmark email, Telegram/Slack/WhatsApp bots.
- **Live deploy:** Vercel (`rx-self.vercel.app`).

Full architecture is in `ARCHITECTURE.md` (very long). Treat it as a reference, not a required read.

## 3. Commands that cover 95% of validation

```bash
npm run dev           # Vite dev server
npm run build         # production build
npm run lint          # ESLint (selected paths)
npm run typecheck     # tsc with checkJs
npm test              # Vitest unit/integration
npm run test:smoke    # Playwright e2e (needs dev server)
```

For mobile:
```bash
cd mobile && npm start
cd mobile && npm run typecheck
cd mobile && npm run build:web
```

## 4. Golden rules (token savers)

1. **Do not dump `ARCHITECTURE.md` into context.** Look up the section you need, or ask for it indirectly via nested KIMI files.
2. **Use aliases and conventions already in place.** Don't invent new patterns when existing ones work:
   - `@/` → `src/`
   - Entities: `import { Candidate } from "@/entities/Candidate"`
   - `cn()` from `@/lib/utils`
   - LLM: `invokeLLM` / `invokeLLMJson` from `@/lib/llm`
3. **Never call `supabase.from(...)` in a component.** Always go through an entity.
4. **Never upload directly to Storage.** Use `UploadFile()` in `src/integrations/Core.js`.
5. **Never add `VITE_*` secrets.** `VITE_SUPABASE_*` are the only public env vars.
6. **DB changes need a migration.** Migration files in `supabase/migrations/` are applied manually; pushing the file does not run it.
7. **RLS is the security boundary.** Add a policy for every new table.

## 5. When you need architecture detail

Look in `ARCHITECTURE.md` by section number only:
- §6 LLM layer
- §7 Auth & security
- §8 Data model
- §9 Frontend design
- §10 Pages
- §11 Components
- §27 Video calls / LiveKit
- §28 Bookings / scheduling

## 6. What not to do (saves tokens)

- Do not run `git` mutations unless the user explicitly asks.
- Do not rewrite code just to change formatting or style.
- Do not add dependencies without confirming the project already uses the same family (check `package.json` first).
- Do not re-read `CLAUDE.md` if you just read `KIMI.md`; they overlap. Prefer `KIMI.md`.
- Do not summarize the whole file tree unless asked.

## 7. Directory quick-map

```
src/            React SPA
supabase/       Edge Functions + migrations
mobile/         Expo React Native
services/       Telegram/Slack/WhatsApp bots (Railway)
tests/          Vitest + Playwright
scripts/        Node automation helpers
base44/         Legacy import entities/functions (read-only)
```

## 8. Asking the user

Ask the user only when:
- The requirement is genuinely ambiguous and changes implementation materially.
- A destructive action (delete table, drop migration, force push, etc.) is requested.
- A new dependency would be required.

Otherwise, decide and act.
