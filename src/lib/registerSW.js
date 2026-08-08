/**
 * Service worker registration (see public/sw.js).
 *
 * Production only — a worker in dev would serve cached assets over Vite's HMR
 * and make every change look like it didn't apply.
 *
 * UPDATE HANDLING
 * This used to register and nothing else, on the reasoning that the worker
 * never caches index.html so a deploy lands on the next navigation anyway, and
 * a waiting worker "takes over on its own once every tab is closed". Both
 * clauses assume a browser tab. In an installed PWA neither holds: reopening
 * from the home screen usually restores the last page WITHOUT a navigation, and
 * the last client may never close — so the old worker can stay in control, and
 * the user sees a build they already replaced with no way to tell.
 *
 * So now: check for a new worker whenever the app becomes visible, promote it
 * the moment it is installed, and refresh once when it takes control. The
 * refresh is deliberately narrow — it fires only when a NEW worker replaces an
 * existing one, never on first install, and never on a page that is already
 * running the current build.
 */

/** Guards against a reload loop if controllerchange fires more than once. */
let reloading = false;

export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Captured before any update can land. A first-ever install also fires
  // controllerchange (the worker calls clients.claim()), and reloading a
  // first-time visitor for no reason would be a bug, not an update.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register("/sw.js");
    } catch (err) {
      // Non-fatal: the app works fine unregistered, it just isn't installable.
      console.warn("[sw] registration failed", err);
      return;
    }

    /** Hand control to a worker that has finished installing. */
    const promote = (worker) => {
      if (!worker || worker.state !== "installed") return;
      // No existing controller means this is a first install: it will activate
      // by itself, and skipping ahead would only cause a pointless reload.
      if (!navigator.serviceWorker.controller) return;
      worker.postMessage({ type: "SKIP_WAITING" });
    };

    // Already waiting from a previous session that never closed its last tab.
    promote(registration.waiting);

    registration.addEventListener("updatefound", () => {
      const next = registration.installing;
      if (!next) return;
      next.addEventListener("statechange", () => promote(next));
    });

    // Reopening an installed PWA typically restores the last page without a
    // navigation, so nothing would otherwise look for a new build. Ask.
    const checkForUpdate = () => {
      if (document.visibilityState !== "visible") return;
      registration.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", checkForUpdate);
    checkForUpdate();
  });
}

/**
 * Tears down the worker and every cache it owns. Kept as an escape hatch — if a
 * bad worker ever ships, calling this from the console (or a temporary import)
 * un-sticks clients that would otherwise hold it until all tabs close.
 */
export async function unregisterServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}
