/**
 * Cross-navigation in-memory cache for Dashboard data.
 * Survives React re-mounts when navigating away and back.
 */

let cache = {
  ts: 0,
  candidates: [],
  jobs: [],
  companies: [],
  applications: [],
  submissions: [],
  tasks: [],
  stats: null,
};

const TTL = 60 * 1000; // 1 minute

export function getDashboardCache() {
  if (cache.stats && Date.now() - cache.ts < TTL) return cache;
  return null;
}

export function setDashboardCache(data) {
  cache = { ...data, ts: Date.now() };
}

export function invalidateDashboardCache() {
  cache = { ts: 0, candidates: [], jobs: [], companies: [], applications: [], submissions: [], tasks: [], stats: null };
}