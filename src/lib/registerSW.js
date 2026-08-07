/**
 * Service worker registration (see public/sw.js).
 *
 * Production only — a worker in dev would serve cached assets over Vite's HMR
 * and make every change look like it didn't apply.
 *
 * Note there is no "new version available, reload now" prompt. The worker never
 * caches index.html, so a deploy is picked up on the next navigation regardless
 * of which worker is in control; a forced reload would only risk blowing away a
 * half-typed candidate or invoice form for no benefit. A waiting worker takes
 * over on its own once every tab is closed.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non-fatal: the app works fine unregistered, it just isn't installable.
      console.warn("[sw] registration failed", err);
    });
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
