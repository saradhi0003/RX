import { useCallback, useEffect, useRef, useState } from 'react';

type Result<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Asserts the runtime shape of a PostgREST embed.
 *
 * supabase-js types `jobs(title)` as `{title}[]` because an embed *can* be
 * one-to-many. For a many-to-one FK — submissions.candidate_id → candidates.id
 * — PostgREST returns a single object, so the generated type is wrong for the
 * shape we actually get back. Screens declare the true shape and route the
 * query through here rather than widening every embedded field to an array
 * and null-checking a `[0]` that is never an array in practice.
 */
export function asRows<T>(query: PromiseLike<unknown>): PromiseLike<Result<T>> {
  return query as PromiseLike<Result<T>>;
}

/**
 * The list-screen pattern, extracted: debounced search, pull-to-refresh, first
 * load spinner, and an error string that survives a refresh.
 *
 * `run` MUST be stable (wrap it in useCallback) — it is the effect dependency.
 * Screens keep owning their query so PostgREST selects stay visible at the call
 * site; this hook only owns the state machine around them.
 *
 * No client-side tenant filter belongs in any caller: visibility is RLS's job
 * (auth_is_approved(), migration 020). An unapproved account running any of
 * these queries gets [] back, which is the behaviour we inherit on purpose.
 */
export function useRows<T>(
  run: (search: string) => PromiseLike<Result<T>>,
  search = '',
  { debounceMs = 0 }: { debounceMs?: number } = {},
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow early query resolving after a newer one and
  // overwriting fresher rows.
  const seq = useRef(0);

  const load = useCallback(
    async (term: string) => {
      const ticket = ++seq.current;
      const { data, error: err } = await run(term);
      if (ticket !== seq.current) return;

      if (err) setError(humanize(err.message));
      else {
        setError(null);
        setRows(data ?? []);
      }
    },
    [run],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      load(search).finally(() => setLoading(false));
    }, debounceMs);
    return () => clearTimeout(t);
  }, [search, load, debounceMs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(search);
    setRefreshing(false);
  }, [load, search]);

  // Stable, so callers can safely list it in their own dependency arrays.
  const reload = useCallback(() => load(search), [load, search]);

  return { rows, loading, refreshing, error, refresh, reload };
}

/**
 * There is no NetInfo dependency here on purpose — adding a native module to
 * name the failure would force a full rebuild rather than an OTA update. A
 * dropped connection surfaces as a fetch TypeError, which is enough to say the
 * useful thing instead of showing "Network request failed".
 */
export function humanize(message: string): string {
  const offline = /network request failed|failed to fetch|networkerror/i.test(message);
  return offline
    ? "You're offline. Pull down to retry once you have a connection."
    : message;
}
