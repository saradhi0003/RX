import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { getUserCached, invalidateUserCache } from "@/lib/appCache";
import { invalidateRolesCache } from "@/components/utils/rolesCache";

const DEFAULT_PERM = { view: false, create: false, update: false, delete: false, scope: "own" };

const Ctx = createContext({
  me: null,
  role: null,
  isAdmin: false,
  can: () => false,
  scopeFor: () => "own",
  listFilterFor: () => null,
});

export function PermissionsProvider({ children }) {
  const [me, setMe] = useState(null);
  const [role, setRole] = useState(null);

  const loadUserAndRole = useCallback(async () => {
    const { user, role: r } = await getUserCached();
    setMe(user);
    setRole(r);
  }, []);

  useEffect(() => { loadUserAndRole(); }, [loadUserAndRole]);

  // Live-update roles when Access Control saves and broadcasts a cache-bust signal
  useEffect(() => {
    const onStorage = async (e) => {
      if (e.key === "roles_cache_bust") {
        invalidateRolesCache();
        invalidateUserCache();
        await loadUserAndRole();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadUserAndRole]);

  const isAdmin = useMemo(() => {
    const byBuiltin = (me?.role || "").toLowerCase() === "admin";
    const byRoleName = (role?.name || "").toLowerCase() === "admin";
    return !!me && (byBuiltin || byRoleName);
  }, [me, role]);

  const can = useCallback((entity, action = "view") => {
    if (isAdmin) return true;
    const p = (role?.permissions || {})[entity];
    if (!p) return false;
    return !!({ ...DEFAULT_PERM, ...p }[action]);
  }, [isAdmin, role]);

  const scopeFor = useCallback((entity) => {
    if (isAdmin) return "all";
    const p = (role?.permissions || {})[entity];
    return p?.scope || "own";
  }, [isAdmin, role]);

  const listFilterFor = useCallback((entity) => {
    if (!me) return null;
    const scope = scopeFor(entity);
    if (scope === "all") return null;
    switch (entity) {
      case "Task":       return { assigned_to: me.email };
      case "Submission": return { recruiter_id: me.id };
      default:           return { created_by: me.email };
    }
  }, [me, scopeFor]);

  const value = useMemo(
    () => ({ me, role, isAdmin, can, scopeFor, listFilterFor }),
    [me, role, isAdmin, can, scopeFor, listFilterFor]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissions() {
  return useContext(Ctx);
}