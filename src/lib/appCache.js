/**
 * Unified in-memory cache for the entire app.
 * Single source of truth for user, roles, quick stats, and dashboard data.
 * Survives React navigation (module-level singleton).
 */

import { supabase } from "@/lib/supabase";

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { userCache.promise = null; return { user: null, role: null }; }

      // Pull profile + role definitions in parallel.
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", authUser.id).single(),
        supabase.from("app_settings").select("value").eq("key", "roles_definitions").maybeSingle(),
      ]);
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
