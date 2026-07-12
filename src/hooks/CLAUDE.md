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
- **`use-mobile.jsx`** — `useIsMobile()` viewport breakpoint (shadcn default).

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
