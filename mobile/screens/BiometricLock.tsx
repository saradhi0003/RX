import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

/**
 * The mobile unlock gate. The session is already valid — this is a local
 * biometric check before candidate data is shown, like a banking app.
 *
 * Critical: if the device has no biometrics or passcode enrolled, LET THE USER
 * IN. A hard lock there would permanently lock someone out of their own
 * account with no recovery path, and it would buy nothing — the session and
 * RLS are the real security boundary, not this screen.
 */
export function BiometricLock({ email, onUnlock }: { email: string; onUnlock: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        onUnlock();
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock TalentStack',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // allow the phone PIN/passcode as fallback
      });
      if (res.success) onUnlock();
      else setError('Couldn’t verify it’s you. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Biometric error');
    } finally {
      setBusy(false);
    }
  }, [onUnlock]);

  // Prompt automatically as soon as the lock appears.
  useEffect(() => {
    attempt();
  }, [attempt]);

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeMark}>TS</Text>
      </View>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>TalentStack is locked</Text>
      <Text style={styles.email}>{email}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={attempt} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Verifying…' : 'Unlock'}</Text>
      </Pressable>

      <Pressable onPress={() => supabase.auth.signOut()} hitSlop={12}>
        <Text style={styles.link}>Sign out instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: colors.bg, alignItems: 'center',
    justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
  },
  badge: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeMark: { color: '#fff', fontWeight: '800', fontSize: 16 },
  icon: { fontSize: 32, marginTop: spacing.sm },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  email: { color: colors.textSecondary, fontSize: 13 },
  btn: {
    marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: 14, minWidth: 240, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { color: colors.muted, fontSize: 13, marginTop: spacing.sm, textDecorationLine: 'underline' },
  error: { color: colors.negative, fontSize: 13, textAlign: 'center' },
});
