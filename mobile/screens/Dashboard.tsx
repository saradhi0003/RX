import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { humanize } from '../lib/useRows';
import { Card, ErrorNotice, Loading, Pill, formatDate } from '../components/ui';
import type { Detail, Tab } from '../components/Shell';
import { colors, radius, spacing } from '../theme';

type Counts = { candidates: number; openJobs: number; submissions: number; openTasks: number };
type Recent = { id: string; full_name: string; title: string | null; created_at: string };

/**
 * Counts + the latest candidates. Every count is a `head: true` COUNT query, so
 * the phone pulls integers rather than rows it will not render — the dashboard
 * is the one screen that would otherwise fetch four tables in full.
 *
 * Counts respect RLS like everything else: an unapproved account sees zeroes,
 * not a permission error.
 */
export function Dashboard({
  onTab,
  onCandidate,
  onDetail,
}: {
  onTab: (t: Tab) => void;
  onCandidate: (id: string, name: string) => void;
  onDetail: (d: Detail) => void;
}) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const countOf = (table: string, apply?: (q: any) => any) => {
      const q = supabase.from(table).select('id', { count: 'exact', head: true });
      return apply ? apply(q) : q;
    };

    const [c, j, s, t, r] = await Promise.all([
      countOf('candidates'),
      countOf('jobs', (q) => q.eq('status', 'open')),
      countOf('submissions'),
      countOf('tasks', (q) => q.in('status', ['todo', 'in_progress'])),
      supabase
        .from('candidates')
        .select('id, full_name, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const failed = [c, j, s, t, r].find((x) => x.error);
    if (failed?.error) {
      setError(humanize(failed.error.message));
      return;
    }

    setError(null);
    setCounts({
      candidates: c.count ?? 0,
      openJobs: j.count ?? 0,
      submissions: s.count ?? 0,
      openTasks: t.count ?? 0,
    });
    setRecent((r.data as Recent[]) ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading && !counts) return <Loading />;

  const tiles: { label: string; value: number; go: () => void }[] = [
    { label: 'Candidates', value: counts?.candidates ?? 0, go: () => onTab('candidates') },
    { label: 'Open jobs', value: counts?.openJobs ?? 0, go: () => onTab('jobs') },
    { label: 'Submissions', value: counts?.submissions ?? 0, go: () => onDetail({ screen: 'submissions' }) },
    { label: 'Open tasks', value: counts?.openTasks ?? 0, go: () => onTab('tasks') },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={tile.go}
          >
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Recent candidates</Text>
      <View style={styles.list}>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No candidates yet.</Text>
        ) : (
          recent.map((row) => (
            <Card key={row.id} onPress={() => onCandidate(row.id, row.full_name)}>
              <Text style={styles.name}>{row.full_name}</Text>
              {row.title ? <Text style={styles.meta}>{row.title}</Text> : null}
              {formatDate(row.created_at) ? (
                <View style={styles.row}>
                  <Pill label={`Added ${formatDate(row.created_at)}`} tone="submitted" />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1, flexBasis: '46%', backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: spacing.md, gap: 2,
  },
  tilePressed: { backgroundColor: colors.surfaceAlt },
  tileValue: { color: colors.primaryDark, fontSize: 26, fontWeight: '800' },
  tileLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.md },
  list: { gap: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.lg },
});
