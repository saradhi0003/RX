import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

/**
 * Password sign-in with a magic-link fallback, mirroring the web Login page.
 *
 * There is no sign-up here on purpose: new accounts are created on the web,
 * land at status='invited', and stay locked out until an admin approves them
 * (migration 020). Adding a mobile sign-up would only produce more accounts
 * that cannot read anything.
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // On success the auth listener in App.tsx takes over and this unmounts.
    if (err) setError(err.message);
    setBusy(false);
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() });
    if (err) setError(err.message);
    else setMagicSent(true);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.badge}>
          <Text style={styles.badgeMark}>TS</Text>
        </View>
        <Text style={styles.title}>TalentStack</Text>
        <Text style={styles.subtitle}>Sign in to your recruiting workspace</Text>

        {magicSent ? (
          <Text style={styles.notice}>
            Check {email} for a sign-in link. Open it on this device.
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="you@company.com"
          placeholderTextColor={colors.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          onSubmitEditing={signIn}
        />

        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={signIn}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign in</Text>}
        </Pressable>

        <Pressable onPress={sendMagicLink} disabled={busy} hitSlop={12}>
          <Text style={styles.link}>Email me a sign-in link instead</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  badge: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  badgeMark: { color: '#fff', fontWeight: '800', fontSize: 18 },
  title: {
    color: colors.text, fontSize: 26, fontWeight: '800',
    textAlign: 'center', marginTop: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary, fontSize: 14,
    textAlign: 'center', marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    fontSize: 15, color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: {
    color: colors.secondary, fontSize: 14,
    textAlign: 'center', marginTop: spacing.md,
  },
  error: {
    color: colors.negative, fontSize: 13, textAlign: 'center',
    marginBottom: spacing.xs,
  },
  notice: {
    color: colors.warning, backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder, borderWidth: 1, borderRadius: radius.md,
    padding: spacing.md, fontSize: 13, textAlign: 'center',
  },
});
