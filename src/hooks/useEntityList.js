import { useCallback, useEffect, useState } from "react";

/**
 * Standard list-loading state for entity-backed pages (GAPS.md Layer 2 fix:
 * entity errors must surface, not silently render a blank table).
 *
 * Pair with `<EmptyState>` (`@/components/common/EmptyState`) for the
 * error/empty renders.
 *
 * @template T
 * @param {() => Promise<T[]>} fetcher
 *        async function returning the rows, e.g. `() => Agent.list()`.
 *        Re-created references re-fetch — memoize with useCallback, or pass
 *        `deps` and an inline function.
 * @param {unknown[]} [deps] extra dependencies that should trigger a reload
 * @returns {{ data: T[], loading: boolean, error: string|null, reload: () => Promise<void> }}
 */
export function useEntityList(fetcher, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || "Failed to load data");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
