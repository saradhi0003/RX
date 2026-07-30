import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

/**
 * TOTP step-up (AAL1 → AAL2).
 *
 * listFactors().totp returns only VERIFIED factors, which is what makes this
 * safe to index blindly: a half-finished enrollment never appears here and so
 * can never block a sign-in.
 *
 * challengeAndVerify() is one call that both opens the challenge and answers
 * it. Doing challenge() and verify() separately is only needed when the code is
 * entered on a different screen than the one that started the challenge.
 */
export function MfaChallenge({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.mfa.listFactors().then(({ data, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(err.message);
        return;
      }
      const verified = data?.totp?.[0];
      if (verified) setFactorId(verified.id);
      // No verified factor means this session never needed a step-up — the
      // caller's AAL check was stale, so let it through rather than trapping
      // the user on a challenge they cannot answer.
      else onVerified();
    });
    return () => {
      cancelled = true;
    };
  }, [onVerified]);

  const verify = async () => {
    if (!factorId || code.length < 6) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (err) {
      setError(err.message);
      setCode('');
    } else {
      onVerified();
    }
    setBusy(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>🔐</Text>
      <Text style={styles.title}>Two-factor authentication</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={6}
        autoFocus
        onSubmitEditing={verify}
      />

      <Pressable
        style={[styles.btn, (busy || code.length < 6) && styles.btnDisabled]}
        onPress={verify}
        disabled={busy || code.length < 6}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
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
  icon: { fontSize: 34 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: {
    color: colors.textSecondary, fontSize: 14, textAlign: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    fontSize: 24, letterSpacing: 8, textAlign: 'center', color: colors.text,
    minWidth: 220,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', minWidth: 220, marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  link: { color: colors.muted, fontSize: 13, marginTop: spacing.sm, textDecorationLine: 'underline' },
  error: { color: colors.negative, fontSize: 13, textAlign: 'center' },
});
