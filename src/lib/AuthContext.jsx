import { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { mfaStatus } from "@/lib/mfa";

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

      setUser({ ...authUser, ...profile, email: authUser.email });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
