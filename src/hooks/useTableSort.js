import { useCallback, useMemo, useState } from "react";

/**
 * Client-side sort state + comparator for list tables.
 *
 * Pairs with `<DataTableProvider>` / `<SortableHead>` (see
 * `@/components/common/DataTable`): pass the returned object straight through as
 * the provider's `sort` prop, and render the table body from `sorted`.
 *
 * The comparator handles strings (locale + numeric-aware), numbers, dates, and
 * booleans, and always sorts `null`/`undefined` last regardless of direction.
 * Columns whose display value differs from the raw field (e.g. a joined name)
 * can supply an accessor via `accessors[key]`.
 *
 * @template T
 * @param {T[]} data                      rows to sort (unsorted source list)
 * @param {object}  [opts]
 * @param {string|null} [opts.defaultKey] column key to sort by initially
 * @param {"asc"|"desc"} [opts.defaultOrder="desc"]
 * @param {Record<string, (row: T) => unknown>} [opts.accessors]
 *        stable map of columnKey → value getter; must be memoized by the caller.
 * @returns {{ sorted: T[], sortKey: string|null, sortOrder: "asc"|"desc",
 *            requestSort: (key: string) => void }}
 */
const EMPTY_ACCESSORS = {};

export function useTableSort(
  data,
  { defaultKey = null, defaultOrder = "desc", accessors = EMPTY_ACCESSORS } = {}
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortOrder, setSortOrder] = useState(defaultOrder);

  // First click on a new column sorts ascending; clicking the active column
  // flips direction. (No "off" state — a table always has a stable order.)
  const requestSort = useCallback((key) => {
    if (!key) return;
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortOrder("asc");
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !Array.isArray(data)) return data;
    const get = accessors[sortKey] || ((row) => row?.[sortKey]);
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      let av = get(a);
      let bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always last
      if (bv == null) return -1;
      if (av instanceof Date || bv instanceof Date) {
        av = +new Date(av);
        bv = +new Date(bv);
      }
      if (typeof av === "string" && typeof bv === "string") {
        return (
          av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" }) * dir
        );
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [data, sortKey, sortOrder, accessors]);

  return { sorted, sortKey, sortOrder, requestSort };
}
