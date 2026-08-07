import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

/** Status → chip colour. Covers the CHECK-constrained vocabularies in 001_schema
 *  for jobs, submissions, tasks, candidates and companies. Anything unknown
 *  falls back to neutral rather than throwing off the palette. */
const TONE: Record<string, { bg: string; fg: string }> = {
  open: { bg: '#DCFCE7', fg: '#166534' },
  active: { bg: '#DCFCE7', fg: '#166534' },
  hired: { bg: '#DCFCE7', fg: '#166534' },
  done: { bg: '#DCFCE7', fg: '#166534' },
  client: { bg: '#DCFCE7', fg: '#166534' },

  in_progress: { bg: '#DBEAFE', fg: '#1E40AF' },
  interviewing: { bg: '#DBEAFE', fg: '#1E40AF' },
  submitted: { bg: '#DBEAFE', fg: '#1E40AF' },
  prospect: { bg: '#DBEAFE', fg: '#1E40AF' },

  on_hold: { bg: '#FEF3C7', fg: '#92400E' },
  offered: { bg: '#FEF3C7', fg: '#92400E' },
  todo: { bg: '#FEF3C7', fg: '#92400E' },
  urgent: { bg: '#FEE2E2', fg: '#991B1B' },
  high: { bg: '#FEE2E2', fg: '#991B1B' },

  closed: { bg: '#F1F5F9', fg: '#475569' },
  cancelled: { bg: '#F1F5F9', fg: '#475569' },
  rejected: { bg: '#FEE2E2', fg: '#991B1B' },
  withdrawn: { bg: '#F1F5F9', fg: '#475569' },
  inactive: { bg: '#F1F5F9', fg: '#475569' },
};

export function Pill({ label, tone }: { label: string; tone?: string }) {
  const key = (tone ?? label).toLowerCase().replace(/\s+/g, '_');
  const c = TONE[key] ?? { bg: colors.primarySoft, fg: colors.primaryDark };
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{label.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      {children}
    </Pressable>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  );
}

export function Loading() {
  return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
}

/** Label + value line for the detail screens. Renders nothing when empty, so
 *  callers can list every field without guarding each one. */
export function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{String(value)}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

/** Dates arrive as ISO strings or DATE strings; both render short and local. */
export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatMoney(value?: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return null;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, gap: 2,
  },
  cardPressed: { backgroundColor: colors.surfaceAlt },

  errorBox: {
    backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginHorizontal: spacing.md,
    marginBottom: spacing.sm, gap: spacing.xs,
  },
  errorText: { color: colors.negative, fontSize: 13, lineHeight: 19 },
  retry: { color: colors.secondary, fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  emptyHint: { color: colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  spinner: { marginTop: spacing.xl },

  field: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 5 },
  fieldLabel: { color: colors.muted, fontSize: 13, width: 108 },
  fieldValue: { color: colors.text, fontSize: 14, flex: 1 },

  section: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
