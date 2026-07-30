import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useAppLock } from './lib/useAppLock';
import { Shell, type Route } from './components/Shell';
import { Login } from './screens/Login';
import { MfaChallenge } from './screens/MfaChallenge';
import { BiometricLock } from './screens/BiometricLock';
import { PendingApproval } from './screens/PendingApproval';
import { Candidates } from './screens/Candidates';
import { Upload } from './screens/Upload';
import { colors, spacing } from './theme';

/**
 * The gate cascade — ordered early returns, mirroring the web app's route
 * guards (src/App.jsx PrivateRoute + Layout.jsx AccessBlocker):
 *
 *   session → MFA (AAL2) → biometric lock (native only) → approval → app
 *
 * Every one of these is UX. The real locks are in the database: migration 020
 * compiles auth_is_approved() into every policy, so deleting this whole file
 * would not expose a single candidate row to an unapproved account. The gates
 * exist so the user sees the right screen, not to make the data safe.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [route, setRoute] = useState<Route>('candidates');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setSessionLoaded(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Mobile keeps the session and re-locks behind biometrics instead of the
  // web's 20-minute idle sign-out. See lib/useAppLock.ts for why.
  const { locked, unlock, touch } = useAppLock(!!session);

  // MFA: an account with a verified TOTP factor must reach AAL2 before data.
  const [needsMfa, setNeedsMfa] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setNeedsMfa(false);
      return;
    }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (!cancelled && data) {
        setNeedsMfa(data.currentLevel === 'aal1' && data.nextLevel === 'aal2');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Approval: user_profiles.status must be 'active' and the row unlocked —
  // the same predicate as auth_is_approved() and the web's Layout.jsx isBlocked.
  const [approval, setApproval] = useState<'checking' | 'approved' | 'pending'>('checking');
  const [profileNonce, setProfileNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setApproval('checking');
      return;
    }
    supabase
      .from('user_profiles')
      .select('status, is_locked')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Fail CLOSED. An unreadable or missing profile means we cannot prove
        // approval, so we do not assume it — the web app bootstraps the row as
        // 'invited', and treating that as approved here would show the pending
        // user an empty app instead of an explanation.
        if (error || !data) {
          setApproval('pending');
          return;
        }
        setApproval(data.status === 'active' && !data.is_locked ? 'approved' : 'pending');
      });
    return () => {
      cancelled = true;
    };
  }, [session, profileNonce]);

  const email = session?.user?.email ?? '';

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.fatalTitle}>Not configured</Text>
        <Text style={styles.fatalBody}>
          This build has no Supabase URL or anon key. They are baked in at build
          time, so this cannot be fixed by an update — set the EAS environment
          variables and build again.
        </Text>
      </View>
    );
  }

  if (!sessionLoaded) {
    return (
      <View style={styles.centered}>
        <StatusBar style="dark" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <Login />
      </View>
    );
  }

  if (needsMfa) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <MfaChallenge onVerified={() => setNeedsMfa(false)} />
      </View>
    );
  }

  // Native only — the web export keeps the browser's own session policy.
  if (Platform.OS !== 'web' && locked) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <BiometricLock email={email} onUnlock={unlock} />
      </View>
    );
  }

  if (approval !== 'approved') {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <PendingApproval email={email} onRecheck={() => setProfileNonce((n) => n + 1)} />
      </View>
    );
  }

  return (
    // The capture prop observes every touch (returning false lets it through) so
    // activity pushes back the inactivity re-lock.
    <SafeAreaView
      style={styles.root}
      onStartShouldSetResponderCapture={() => {
        touch();
        return false;
      }}
    >
      <StatusBar style="dark" />
      <Shell route={route} onRoute={setRoute} email={email}>
        {route === 'candidates' ? <Candidates /> : <Upload />}
      </Shell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1, backgroundColor: colors.bg, alignItems: 'center',
    justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
  },
  fatalTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  fatalBody: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
