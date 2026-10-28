/**
 * Unified in-memory cache for the entire app.
 * Single source of truth for user, roles, quick stats, and dashboard data.
 * Survives React navigation (module-level singleton).
 */

import { supabase } from "@/lib/supabase";

// ─── Own profile: one request, shared ──────────────────────────────────────────
// AuthContext, this cache and User.me() each used to fetch the signed-in
// user's user_profiles row themselves, and AuthContext did it twice (once from
// getSession, once from the INITIAL_SESSION event) — four identical requests
// on every app load, all on the path to first paint. Concurrent callers now
// share one request, and a successful answer is reused briefly. A failed one
// is never reused, so the next caller retries (see the PGRST116 note below).
const PROFILE_REUSE_MS = 10 * 1000;
/** @type {Map<string, { promise: Promise<any>, pending: boolean, ts: number }>} */
const profileFetches = new Map();

/** @param {string} userId → `{ data, error }`, exactly as `.single()` returns it */
export function fetchOwnProfile(userId) {
  const hit = profileFetches.get(userId);
  if (hit && (hit.pending || Date.now() - hit.ts < PROFILE_REUSE_MS)) return hit.promise;

  const entry = { promise: /** @type {Promise<any>} */ (Promise.resolve()), pending: true, ts: 0 };
  entry.promise = Promise.resolve(
    supabase.from("user_profiles").select("*").eq("id", userId).single(),
  ).then(
    (res) => {
      entry.pending = false;
      entry.ts = Date.now();
      if (res?.error) profileFetches.delete(userId);
      return res;
    },
    (err) => {
      profileFetches.delete(userId);
      throw err;
    },
  );
  profileFetches.set(userId, entry);
  return entry.promise;
}

// ─── User + Role cache ─────────────────────────────────────────────────────────
const USER_TTL = 5 * 60 * 1000; // 5 minutes

/** @type {{ user: any; role: any; ts: number; promise: Promise<any> | null }} */
let userCache = { user: null, role: null, ts: 0, promise: null };

export async function getUserCached() {
  const now = Date.now();
  if (userCache.user && now - userCache.ts < USER_TTL) {
    return { user: userCache.user, role: userCache.role };
  }
  if (userCache.promise) return userCache.promise;

  userCache.promise = (async () => {
    try {
      // The local session, not getUser(): getUser() is a network round trip
      // to re-validate a JWT that AuthContext has already accepted, and it sat
      // in front of every page's first data load. This only decides what the
      // UI shows — every row is still authorised by RLS against that JWT.
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) { userCache.promise = null; return { user: null, role: null }; }

      // Pull profile + role definitions in parallel.
      const [profileRes, rolesRes] = await Promise.all([
        fetchOwnProfile(authUser.id),
        supabase.from("app_settings").select("value").eq("key", "roles_definitions").maybeSingle(),
      ]);

      // PGRST116 ("0 rows") is the one error .single() throws that genuinely
      // means "no profile yet" — everything else (a JWT that hasn't finished
      // propagating right after sign-in, a network blip, RLS hiccup) is a
      // fetch failure, not a verdict. Treating both the same used to build a
      // `user` object with no `status` field at all (spreading `...null` from
      // profileRes.data drops it silently) and then CACHE that broken object
      // for the full 5-minute TTL — so a real, approved user who merely hit
      // a timing race on first load got treated as unrecognized for 5
      // minutes straight, on every subsequent read, not just once. Layout's
      // isBlocked gate correctly fails closed on an unknown status, which
      // means an unrelated fetch hiccup here was enough to force a
      // just-logged-in, fully-approved user straight back out via
      // AccessBlocker's auto-logout. Bail out without writing the cache so
      // the next call retries instead of serving the poisoned result.
      if (profileRes.error && profileRes.error.code !== "PGRST116") {
        userCache.promise = null;
        return { user: null, role: null };
      }

      const profile = profileRes.data;
      const roleDefs = Array.isArray(rolesRes.data?.value) ? rolesRes.data.value : [];
      const roleName = profile?.role || "recruiter";
      const matched = roleDefs.find((r) => r?.name === roleName);

      const user = { ...authUser, ...profile, email: authUser.email };
      const role = profile
        ? { name: roleName, id: roleName, permissions: matched?.permissions || {} }
        : null;
      userCache = { user, role, ts: Date.now(), promise: null };
      return { user, role };
    } catch {
      userCache.promise = null;
      return { user: null, role: null };
    }
  })();
  return userCache.promise;
}

export function invalidateUserCache() {
  userCache = { user: null, role: null, ts: 0, promise: null };
  profileFetches.clear();
}

export function getCachedUser() {
  return userCache.user;
}

// ─── Quick Stats cache ─────────────────────────────────────────────────────────
const QS_TTL = 3 * 60 * 1000; // 3 minutes

/** @type {{ data: any; ts: number; promise: Promise<any> | null }} */
let qsCache = { data: null, ts: 0, promise: null };

/** @param {() => Promise<any>} fetcher */
export async function getQuickStatsCached(fetcher) {
  const now = Date.now();
  if (qsCache.data && now - qsCache.ts < QS_TTL) return qsCache.data;
  if (qsCache.promise) return qsCache.promise;

  qsCache.promise = fetcher().then(/** @param {any} data */ data => {
    qsCache = { data, ts: Date.now(), promise: null };
    return data;
  }).catch(() => {
    qsCache.promise = null;
    return qsCache.data || { activeJobs: 0, newCandidates: 0, thisMonthPlacements: 0 };
  });
  return qsCache.promise;
}

export function invalidateQuickStatsCache() {
  qsCache = { data: null, ts: 0, promise: null };
}

// ─── Dashboard data cache ──────────────────────────────────────────────────────
const DASH_TTL = 2 * 60 * 1000; // 2 minutes
let dashCache = {
  ts: 0,
  candidates: /** @type {any[]} */ ([]),
  jobs: /** @type {any[]} */ ([]),
  companies: /** @type {any[]} */ ([]),
  applications: /** @type {any[]} */ ([]),
  submissions: /** @type {any[]} */ ([]),
  tasks: /** @type {any[]} */ ([]),
  stats: /** @type {any} */ (null),
};

export function getDashboardCache() {
  if (dashCache.stats && Date.now() - dashCache.ts < DASH_TTL) return dashCache;
  return null;
}

/** @param {any} data */
export function setDashboardCache(data) {
  dashCache = { ...data, ts: Date.now() };
}

export function invalidateDashboardCache() {
  dashCache = { ts: 0, candidates: [], jobs: [], companies: [], applications: [], submissions: [], tasks: [], stats: null };
}
