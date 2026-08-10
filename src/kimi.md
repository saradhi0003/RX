# src/kimi.md — Frontend guidance

## Scope

Everything under `src/` is the Vite + React 18 SPA.

## Entry points and routing

- `src/main.jsx` — root render.
- `src/App.jsx` — routes + auth guards.
- `src/pages.config.js` — registers pages, lazy-loaded.
- `src/Layout.jsx` — shell: icon rail, flyout nav, topbar, right preview panel.

Use `PrivateRoute`/`PublicRoute` for auth guards. Auth pages render outside `<Layout>`.

## Data access pattern

All DB access goes through `src/lib/entityFactory.js`. Never call `supabase.from(...)` in a component.

```js
import { Candidate } from "@/entities/Candidate";

const list    = await Candidate.list("-created_at", 200);
const filtered = await Candidate.filter({ status: "active" }, "-created_at");
const created = await Candidate.create({ full_name, email });
const updated = await Candidate.update(id, { status: "placed" });
await Candidate.delete(id);
```

Filter operators: `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$like`, `$or`.  
`-field` means `ORDER BY field DESC`.

## UI / styling

- Tailwind CSS + shadcn/Radix.
- `cn()` helper in `src/lib/utils.js`.
- Brand: purple `#9333EA`, blue `#2563EB`, slate neutrals.
- `src/components/ui/*` is vendored shadcn — don't hand-edit; regenerate with shadcn CLI.
- Use `PageHeader`, `DataTableProvider`, `SortableHead`, `PermissionGate`, and other shared components instead of rebuilding.

## Shared list tables

Don't hand-roll sort/resize. Reuse:
- `@/hooks/useTableSort`
- `@/hooks/useColumnResize`
- `@/components/common/DataTable` (`DataTableProvider`, `SortableHead`)

## Hooks and state

- Page-local state: `useState`/`useEffect`.
- URL-driven state: `useSearchParams` with `{ replace: true }`.
- Server state: TanStack Query, 60s stale time.
- Cross-component refresh: `refreshBus.jsx`.
- Auth: `src/lib/AuthContext.jsx`.
- Permissions: `usePermissions()` from `src/components/common/PermissionsContext.jsx`.

## LLM usage

Use `src/lib/llm.js`. Routes through `llmProxy` Edge Function; keys stay server-side.

```js
import { invokeLLM, invokeLLMJson, invokeLLMStream } from "@/lib/llm";

const text = await invokeLLM({ prompt, system, task: "my_task" });
const data = await invokeLLMJson({ prompt, system });
```

Model resolution:
- If `opts.model` is provided, it is used directly.
- Otherwise `invokeLLM` resolves the model from `ai_recruiter_settings` based on `task`:
  - `parsing` tasks → `parsing_model`
  - `matching` tasks → `matching_model`
  - `drafting` tasks → `drafting_model`
  - `insights` tasks (`pipeline_analysis`, etc.) → `insights_model`
  - everything else → `default_model`
- Cheapest defaults: `deepseek-chat` for most tasks, `gpt-4o-mini` for parsing.

Local/tunnel Qwen: set `VITE_LLM_PROVIDER=openai-compatible` and configure the endpoint in AI Recruiter Settings (or via `VITE_OPENAI_COMPATIBLE_BASE_URL` / `VITE_OPENAI_COMPATIBLE_MODEL`).

`invokeLLMStream` does **not** fall back when streaming.

## File uploads

Always use `UploadFile()` in `src/integrations/Core.js`. Persist the returned `path`, not a signed `file_url`. Render stored files with `<FileLink>` from `src/components/common/FileLink.jsx`.

## Type / JSX conventions

- JSX files, not TSX.
- JSDoc + `jsconfig.json` with `checkJs`.
- No `import React` needed for JSX (React 18 transform).
- Import alias is `@/`.

## Token-saving lookups

- Entities: `src/entities/all.js` lists all entities.
- Pages: `src/pages.config.js`.
- Shared components: `src/components/common/`.
- UI primitives: `src/components/ui/`.
- Hooks: `src/hooks/`.
- Utilities: `src/lib/`.

## Common tasks (cookbook)

### Add a new page
1. Create `src/pages/MyPage.jsx`.
2. Register it in `src/pages.config.js`.
3. Add nav in `src/Layout.jsx` if needed.

### Add a new entity
1. Create `src/entities/MyEntity.js` exporting `createEntity("my_entities")`.
2. Add to `src/entities/all.js`.
3. Reference by `import { MyEntity } from "@/entities/MyEntity"`.

### Add a new shared component
1. Create in `src/components/common/`.
2. Keep styling Tailwind-only; compose with `cn()`.
3. If it's a generic primitive, consider whether shadcn already has it.
