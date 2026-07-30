import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

/**
 * Shown when the signed-in user's profile is not yet approved.
 *
 * This screen is UX, not security: migration 020 already guarantees an
 * unapproved user reads zero rows, whether or not this component renders.
 *
 * It also nudges the admins. notifySignupRequest is idempotent (it guards on
 * user_profiles.notified_at and stamps that column only on a successful send),
 * so firing it on every mount is safe and doubles as a retry for a send that
 * previously failed. Notification is strictly best-effort — with no SMTP
 * secrets configured it returns {skipped:true} and the request still shows up
 * in Access Control on the web, which is the real source of truth.
 */
export function PendingApproval({ email, onRecheck }: { email: string; onRecheck: () => void }) {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.functions.invoke('notifySignupRequest', { body: {} }).catch(() => {
      /* best-effort: Access Control still lists the request */
    });
  }, []);

  const recheck = async () => {
    setChecking(true);
    onRecheck();
    // Brief visual acknowledgement; the parent re-queries the profile.
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Waiting for approval</Text>
      <Text style={styles.body}>
        Your account ({email}) is signed in but not yet activated. An
        administrator has to approve it before candidate data becomes visible.
      </Text>

      <Pressable style={styles.btn} onPress={recheck} disabled={checking}>
        <Text style={styles.btnText}>{checking ? 'Checking…' : 'Check again'}</Text>
      </Pressable>

      <Pressable onPress={() => supabase.auth.signOut()} hitSlop={12}>
        <Text style={styles.link}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: colors.bg, alignItems: 'center',
    justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
  },
  icon: { fontSize: 34 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: {
    color: colors.textSecondary, fontSize: 14, textAlign: 'center',
    lineHeight: 21, marginBottom: spacing.sm,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14,
    paddingHorizontal: spacing.xl, minWidth: 220, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { color: colors.muted, fontSize: 13, marginTop: spacing.sm, textDecorationLine: 'underline' },
});
