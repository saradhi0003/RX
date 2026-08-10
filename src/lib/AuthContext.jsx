import { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { mfaStatus } from "@/lib/mfa";
import { useIdleLogout, resetIdleClock } from "@/hooks/useIdleLogout";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // MFA / assurance level: mfaChallengeRequired === true means the user has a
  // verified 2nd factor but the current session is still aal1 (password only)
  // and must complete a TOTP challenge before reaching protected pages.
  const [mfaChallengeRequired, setMfaChallengeRequired] = useState(false);

  const loadUserWithProfile = useCallback(async (authUser) => {
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      // Auto-heal zombie sessions: a locally-cached session whose JWT the
      // backend rejects (e.g. minted before a signing-key rotation) makes the
      // UI look logged-in while every query returns nothing. Detect the JWT
      // rejection here and force a clean re-login instead of a broken app.
      // (PGRST116 = "0 rows" — a missing profile row — is NOT a JWT failure.)
      if (error && error.code !== "PGRST116" && /jwt|token|expired|invalid/i.test(error.message || "")) {
        console.warn("Stale/invalid session detected — clearing and returning to login.", error.message);
        try { await supabase.auth.signOut(); } catch { /* session already dead */ }
        window.localStorage.clear();
        window.location.href = "/login";
        return;
      }

      // First login after email verification: no profile exists yet (signup
      // couldn't create one without a session). Bootstrap it as 'invited' so
      // the admin-approval gate applies to verified signups too.
      let effectiveProfile = profile;
      if (!profile && error?.code === "PGRST116") {
        const { data: created, error: insertError } = await supabase
          .from("user_profiles")
          .insert({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.user_metadata?.full_name || authUser.email,
            role: "recruiter",
            status: "invited",
          })
          .select()
          .single();
        if (insertError) {
          // The fallback below used to run unconditionally on any failure —
          // a NOT NULL/RLS/trigger error on the insert (migration 029 fixed
          // exactly this: a trigger forcing workspace_id to NULL against a
          // NOT NULL column, silently failing every self-bootstrap since
          // migration 024) left `created` undefined, and the in-memory
          // fallback object made React believe the user was "invited" while
          // the database had no row at all — every other reader of
          // user_profiles (appCache, entities/User, Role) saw a genuinely
          // empty result instead of a real profile, with no consistent
          // account of what that should mean. Surfacing it is what makes a
          // future regression in this insert visible instead of silently
          // reintroducing the same bug.
          console.error("user_profiles bootstrap insert failed — the account has no real profile row:", insertError.message);
        }
        effectiveProfile = created || { status: "invited", role: "recruiter" };
      }

      // Pending signup: let the admins know someone is waiting behind the
      // approval gate. Fire-and-forget and deliberately unawaited — the
      // notification is best-effort and must never delay or break sign-in.
      // notifySignupRequest is idempotent (guards on user_profiles.notified_at),
      // so calling it on every load of a pending profile is safe and doubles as
      // a retry for a send that previously failed.
      if (effectiveProfile?.status === "invited") {
        supabase.functions
          .invoke("notifySignupRequest", { body: {} })
          .catch(() => { /* best-effort: Access Control still shows the request */ });
      }

      setUser({ ...authUser, ...effectiveProfile, email: authUser.email });
      setIsAuthenticated(true);
    } catch {
      setUser(authUser);
      setIsAuthenticated(true);
    }
    // Evaluate whether this session needs to step up to aal2.
    try {
      const { shouldChallenge } = await mfaStatus();
      setMfaChallengeRequired(shouldChallenge);
    } catch {
      setMfaChallengeRequired(false);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUserWithProfile(session.user);
      else setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // A genuine new sign-in, not a reload restoring an already-live session
      // (that fires INITIAL_SESSION/TOKEN_REFRESHED instead). Without this,
      // useIdleLogout's persisted activity stamp — a bare localStorage key
      // with no session identity — can belong to a *previous*, already-idled-
      // out session on this browser, and this fresh login would read it, see
      // "expired", and be signed straight back out before doing anything.
      if (event === "SIGNED_IN") resetIdleClock();

      if (session?.user) {
        loadUserWithProfile(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setMfaChallengeRequired(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserWithProfile]);

  // Idle sign-out. Supabase refreshes the JWT forever on an open tab, so an
  // unattended machine keeps a live CRM session; this terminates it after 20
  // minutes of inactivity. The resulting auth state change flows through
  // onAuthStateChange above and the route guards bounce to /Login.
  useIdleLogout(isAuthenticated);

  /** Re-check assurance level after an MFA challenge (call once verify succeeds). */
  const refreshMfa = useCallback(async () => {
    try {
      const { shouldChallenge } = await mfaStatus();
      setMfaChallengeRequired(shouldChallenge);
      return shouldChallenge;
    } catch {
      setMfaChallengeRequired(false);
      return false;
    }
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      mfaChallengeRequired,
      refreshMfa,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
