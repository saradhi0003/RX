# src/hooks — reusable React hooks

Small, framework-level hooks shared across pages/components. Domain state (auth,
permissions, refresh bus) lives elsewhere — `@/lib` and `@/components/common`.
JSX-bearing hooks must use the **`.jsx`** extension (the Vite/rollup build fails on
JSX in a `.js` file).

## Hooks
- **`useTableSort.js`** — client-side sort for list tables. Returns `{ sorted,
  sortKey, sortOrder, requestSort }`; comparator is string (locale + numeric-aware),
  number, Date, and boolean aware and always sorts null/undefined last. New column →
  ascending, active column → flip. Pass `accessors` (memoized) for columns whose
  display value differs from the raw field.
- **`useColumnResize.jsx`** — drag-to-resize column widths for any table (shadcn
  `<th>` or a raw grid `<div>`). Returns `{ widthFor, ResizeHandle }`. Widths are held
  in a **module-level store keyed by `tableId`** and persisted to `localStorage`
  (`rx.tablewidths.<tableId>`), so all consumers of a table share one source of truth
  and concurrent column edits don't clobber each other.
- **`useEntityList.js`** — standard list-loading state (`{data, loading, error,
  reload}`) for entity-backed pages; pairs with
  `@/components/common/EmptyState` so errors surface instead of blank tables
  (GAPS.md Layer 2). Used on AIAgents, ApprovalQueue, LLMCostDashboard.
- **`use-mobile.jsx`** — `useIsMobile()` viewport breakpoint (shadcn default).
- **`useIdleLogout.js`** — signs the user out after 20 min idle. Supabase
  refreshes the JWT forever on an open tab, so without this an unattended
  machine keeps a live CRM session. Wired once in
  [`../lib/AuthContext.jsx`](../lib/AuthContext.jsx) (driven by
  `isAuthenticated`) — **don't call it per page.** The last-activity clock is
  persisted to `localStorage` (`rx_last_activity`), so idle time while the tab
  was *closed* still counts; two racers (a 30 s interval **and** a
  `visibilitychange` re-check) decide expiry, because mobile browsers freeze
  timers while backgrounded. `consumeIdleNotice()` lets `Login.jsx` explain the
  sign-out once instead of bouncing silently. Ported from FinTracker —
  see [`../../skills/mfa-totp/`](../../skills/mfa-totp/).

Related: the two table hooks are consumed by
[`../components/common/DataTable.jsx`](../components/common/DataTable.jsx)
(`DataTableProvider` + `SortableHead`). See
[../components/CLAUDE.md](../components/CLAUDE.md) → "Shared list tables" for the
per-page rollout pattern. `useDebouncedValue` currently lives in
`../components/common/`, not here.

## Tests
Vitest + RTL under `tests/unit/ui/` — e.g. `useTableSort.test.js`,
`useColumnResize.test.jsx`. Test behavior/persistence, not pixel layout (jsdom has
none). See [../../TESTING.md](../../TESTING.md) §17a.
