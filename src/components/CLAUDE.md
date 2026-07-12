# src/components — UI building blocks

Organized by domain: `candidates/`, `jobs/`, `companies/`, `submissions/`,
`ai/`, `ai-recruiter/`, `agents/`, `automation/`, `playbooks/`, `dashboard/`,
`approval-queue/`, `channel-inbox/`, `emails/`, `recruiters/`, `accounts/`,
`resume/`, `previews/`, `mobile/`, `common/`, `notifications/`, and **`ui/`**.

## `ui/` is special — don't hand-edit
`components/ui/*` is vendored **shadcn/Radix** (New York style). Regenerate/add
via the shadcn CLI per [../../components.json](../../components.json). Treat as a
library; wrap it, don't fork it.

## Conventions
- Class names via `cn()` (`@/lib/utils`); use the Tailwind CSS-variable tokens
  (`bg-primary`, `text-muted-foreground`, …) so light/dark + brand theming work.
- Icons: `lucide-react`. Toasts: `@/components/ui/toaster` (or `sonner`).
- Data via entities + react-query; lift server calls out of leaf components.
- Prefer composition over deep prop drilling; shared state via context in
  `common/` (`PermissionsContext`, refresh bus) or `@/lib/appCache`.
- Keep a domain component's Supabase/LLM access behind the entity/`llm.js` layer.

## Notable domains
- **ai/** and **ai-recruiter/** — scoring, matching, drafting, the AI recruiter
  run UI (Semantic / Agentic / Investigation layers in TESTING.md).
- **approval-queue/** — the human review gate before actions execute.
- **automation/** — `executeAutomation.jsx` runs rule actions (Execution layer).

## Shared list tables — sortable + resizable columns
Every list tab uses one shared behavior. **Don't re-roll per-page sort/resize.**
Three pieces (the hooks live in `@/hooks` — see [../hooks/CLAUDE.md](../hooks/CLAUDE.md)):
- `useTableSort(rows, { defaultKey, defaultOrder, accessors })` → `{ sorted,
  sortKey, sortOrder, requestSort }`. `accessors` (memoize it) only for columns
  whose display value ≠ the raw field (a joined company/role name, a nested value).
- `useColumnResize(tableId)` → `{ widthFor, ResizeHandle }`. Widths persist to
  `localStorage` under `rx.tablewidths.<tableId>` via a **module-level store keyed
  by `tableId`** — pick a stable, unique `tableId` per table.
- `DataTableProvider` + `SortableHead` (in [common/DataTable.jsx](common/DataTable.jsx)).

Two integration paths:
1. **shadcn `<Table>` pages** (Invoices, Consultants, Recruiters, Expenses,
   AccessControl, Approvals): wrap `<Table>` in `<DataTableProvider tableId sort={…}>`,
   replace each `<TableHead>` with `<SortableHead columnKey="field">` (action/checkbox
   columns get `sortable={false}`), render the body from `sort.sorted`.
2. **bespoke CSS-grid list pages** (Companies, Tasks): no `<th>` to swap. Call
   `useColumnResize(tableId)` once, build `gridTemplateColumns` from `widthFor(key) ??
   default` and apply it to **both** the header and every row, and drop a
   `<ResizeHandle colKey>` into each header cell (make the cell `position:relative` +
   `className="group"`); wire header clicks to the page's existing `handleSort`.

Out of scope: card/kanban views (no columns) and matrix tables (SkillMatrix/BRD).

## Tests
Component tests: Vitest + React Testing Library under `tests/unit/ui/`
(example: `tests/unit/ui/button.test.jsx`). Assert roles/labels and behavior, not
pixels. See [../../TESTING.md](../../TESTING.md).
