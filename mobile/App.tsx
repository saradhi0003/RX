import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useAppLock } from './lib/useAppLock';
import { Shell, type Detail, type Tab } from './components/Shell';
import { Login } from './screens/Login';
import { MfaChallenge } from './screens/MfaChallenge';
import { BiometricLock } from './screens/BiometricLock';
import { PendingApproval } from './screens/PendingApproval';
import { Dashboard } from './screens/Dashboard';
import { Candidates } from './screens/Candidates';
import { CandidateDetail } from './screens/CandidateDetail';
import { Jobs } from './screens/Jobs';
import { JobDetail } from './screens/JobDetail';
import { Tasks } from './screens/Tasks';
import { Submissions } from './screens/Submissions';
import { Companies } from './screens/Companies';
import { More } from './screens/More';
import { Upload } from './screens/Upload';
import { LocalModel } from './screens/LocalModel';
import { colors, spacing } from './theme';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [detail, setDetail] = useState<Detail | null>(null);

  const openTab = useCallback((next: Tab) => {
    setDetail(null);
    setTab(next);
  }, []);
  const back = useCallback(() => setDetail(null), []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!detail) return false;
      setDetail(null);
      return true;
    });
    return () => sub.remove();
  }, [detail]);

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

  const { locked, unlock, touch } = useAppLock(!!session);
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

  const openCandidate = (id: string, title: string) => setDetail({ screen: 'candidate', id, title });
  const openJob = (id: string, title: string) => setDetail({ screen: 'job', id, title });

  let screen;
  if (detail?.screen === 'candidate') screen = <CandidateDetail id={detail.id} />;
  else if (detail?.screen === 'job') screen = <JobDetail id={detail.id} />;
  else if (detail?.screen === 'submissions') screen = <Submissions onCandidate={openCandidate} />;
  else if (detail?.screen === 'companies') screen = <Companies />;
  else if (detail?.screen === 'upload') screen = <Upload />;
  else if (detail?.screen === 'local-model') screen = <LocalModel />;
  else if (tab === 'dashboard') screen = <Dashboard onTab={openTab} onCandidate={openCandidate} onDetail={setDetail} />;
  else if (tab === 'candidates') screen = <Candidates onOpen={openCandidate} />;
  else if (tab === 'jobs') screen = <Jobs onOpen={openJob} />;
  else if (tab === 'tasks') screen = <Tasks />;
  else screen = <More onOpen={setDetail} email={email} />;

  return (
    <SafeAreaView
      style={styles.root}
      onStartShouldSetResponderCapture={() => {
        touch();
        return false;
      }}
    >
      <StatusBar style="dark" />
      <Shell
        tab={tab}
        onTab={openTab}
        email={email}
        detailTitle={detailTitle(detail)}
        onBack={detail ? back : undefined}
      >
        {screen}
      </Shell>
    </SafeAreaView>
  );
}

function detailTitle(detail: Detail | null): string | undefined {
  if (!detail) return undefined;
  switch (detail.screen) {
    case 'candidate':
    case 'job':
      return detail.title;
    case 'submissions':
      return 'Submissions';
    case 'companies':
      return 'Companies';
    case 'upload':
      return 'Add candidate';
    case 'local-model':
      return 'Local model';
  }
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
