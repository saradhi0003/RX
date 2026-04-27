/**
 * Unified in-memory cache for the entire app.
 * Single source of truth for user, roles, quick stats, and dashboard data.
 * Survives React navigation (module-level singleton).
 */

import { base44 } from "@/api/base44Client";
import { getRolesCached } from "@/components/utils/rolesCache";

// ─── User + Role cache ─────────────────────────────────────────────────────────
const USER_TTL = 5 * 60 * 1000; // 5 minutes
let userCache = { user: null, role: null, ts: 0, promise: null };

export async function getUserCached() {
  const now = Date.now();
  if (userCache.user && now - userCache.ts < USER_TTL) {
    return { user: userCache.user, role: userCache.role };
  }
  if (userCache.promise) return userCache.promise;

  userCache.promise = (async () => {
    try {
      const user = await base44.auth.me().catch(() => null);
      let role = null;
      if (user?.role_id) {
        const roles = await getRolesCached().catch(() => []);
        role = roles.find(r => r.id === user.role_id) || null;
      }
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
let qsCache = { data: null, ts: 0, promise: null };

export async function getQuickStatsCached(fetcher) {
  const now = Date.now();
  if (qsCache.data && now - qsCache.ts < QS_TTL) return qsCache.data;
  if (qsCache.promise) return qsCache.promise;

  qsCache.promise = fetcher().then(data => {
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
  candidates: [], jobs: [], companies: [],
  applications: [], submissions: [], tasks: [], stats: null,
};

export function getDashboardCache() {
  if (dashCache.stats && Date.now() - dashCache.ts < DASH_TTL) return dashCache;
  return null;
}

export function setDashboardCache(data) {
  dashCache = { ...data, ts: Date.now() };
}

export function invalidateDashboardCache() {
  dashCache = { ts: 0, candidates: [], jobs: [], companies: [], applications: [], submissions: [], tasks: [], stats: null };
}