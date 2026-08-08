import { lazy } from "react";

/**
 * `React.lazy` that survives a deploy.
 *
 * THE FAILURE THIS FIXES
 * Vite content-hashes every code-split chunk, and the entry bundle hardcodes
 * those filenames. A tab opened before a deploy is still running the old entry
 * bundle, so the first navigation to a route whose chunk was never loaded asks
 * for a filename the new deployment no longer serves. The dynamic import
 * rejects and the ErrorBoundary shows "Something went wrong" — with the user
 * one manual reload away from a working app, which is a bad way to learn that
 * we shipped.
 *
 * Browsers word it differently ("Importing a module script failed" on Safari,
 * "Failed to fetch dynamically imported module" on Chrome), hence the pattern
 * match rather than an equality check.
 *
 * A reload does cost unsaved form state — but the alternative here is the error
 * page, which loses it anyway. This is why the reload is scoped to chunk-load
 * failures rather than wired into service-worker updates generally: on a
 * healthy tab nothing reloads.
 */

const RELOAD_FLAG = "rx.chunk_reload";

const CHUNK_ERROR = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|dynamically imported module|loading chunk \d+ failed/i;

/** @param {unknown} err */
export function isChunkLoadError(err) {
  if (!err) return false;
  const message = typeof err === "string" ? err : (/** @type {any} */ (err).message || "");
  return CHUNK_ERROR.test(String(message));
}

/** sessionStorage throws in Safari private mode — never let that mask the real error. */
function flag(action, value) {
  try {
    if (action === "get") return sessionStorage.getItem(RELOAD_FLAG);
    if (action === "set") return sessionStorage.setItem(RELOAD_FLAG, value);
    return sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    return null;
  }
}

/**
 * @template {{default: any}} T
 * @param {() => Promise<T>} factory
 * @returns {React.LazyExoticComponent<any>}
 */
export function lazyWithReload(factory) {
  return lazy(() =>
    factory().then(
      (mod) => {
        // A chunk loaded, so whatever went wrong before is behind us and the
        // next deploy is allowed its own single reload.
        flag("remove");
        return mod;
      },
      (err) => {
        if (!isChunkLoadError(err)) throw err;
        // Already reloaded once and still failing — this is not a stale-chunk
        // problem. Reloading again would spin forever, so surface it.
        if (flag("get")) throw err;
        flag("set", "1");
        window.location.reload();
        // The reload is underway; never resolving keeps Suspense showing its
        // fallback instead of flashing the error boundary on the way out.
        return new Promise(() => {});
      }
    )
  );
}
