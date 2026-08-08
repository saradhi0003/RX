/*
 * Recruiter X service worker — app-shell only.
 *
 * Deliberately NOT offline-first: this is a CRM over a live Postgres, so stale
 * candidate/invoice data is worse than no data. The rules:
 *   - Only same-origin GETs are ever touched. Supabase, LiveKit and every other
 *     cross-origin call goes straight to the network, uncached. No row data,
 *     no auth tokens, no PII ever lands in CacheStorage.
 *   - Navigations are network-first so a Vercel deploy is live immediately;
 *     offline.html is the fallback.
 *   - /assets/* is content-hashed by Vite and therefore immutable → cache-first.
 *
 * Bump VERSION to invalidate every cache this worker owns.
 */

// v2: purges the rx-v1 asset cache, which could still be holding chunks from
// before the phone tab bar shipped on clients whose worker never rotated.
const VERSION = "rx-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";

// Small, stable, and safe to serve from cache. Not index.html — see above.
const SHELL = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individual puts: one 404 in SHELL shouldn't fail the whole install.
      .then((cache) =>
        Promise.all(
          SHELL.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => {}),
          ),
        ),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Lets the page hand control to a waiting worker on demand. Nothing calls this
// automatically — see src/lib/registerSW.js for why we don't force-reload.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

/** Always try the network; fall back to the offline page. */
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return (
      cached ??
      new Response("Offline", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      })
    );
  }
}

/** Serve from cache when present, otherwise fetch and populate. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // 206s and errors are not safe to replay from cache.
  if (response.status === 200) cache.put(request, response.clone());
  return response;
}
