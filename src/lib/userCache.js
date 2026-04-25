/**
 * Shared in-memory cache for the current user + role.
 * Prevents duplicate UserEntity.me() / getRolesCached() calls
 * across Layout, PermissionsContext, Dashboard, etc.
 */
import { base44 } from "@/api/base44Client";
import { getRolesCached } from "@/components/utils/rolesCache";

let cache = { user: null, role: null, ts: 0, promise: null };
const TTL = 60 * 1000; // 1 minute

export async function getUserCached() {
  const now = Date.now();
  if (cache.user && now - cache.ts < TTL) return { user: cache.user, role: cache.role };
  // Deduplicate concurrent calls
  if (cache.promise) return cache.promise;
  cache.promise = (async () => {
    try {
      const user = await base44.auth.me().catch(() => null);
      let role = null;
      if (user?.role_id) {
        const roles = await getRolesCached().catch(() => []);
        role = roles.find(r => r.id === user.role_id) || null;
      }
      cache = { user, role, ts: Date.now(), promise: null };
      return { user, role };
    } catch {
      cache.promise = null;
      return { user: null, role: null };
    }
  })();
  return cache.promise;
}

export function invalidateUserCache() {
  cache = { user: null, role: null, ts: 0, promise: null };
}

export function getCachedUser() {
  return cache.user;
}