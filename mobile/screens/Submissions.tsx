import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { asRows, useRows } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Loading, Pill, formatDate, formatMoney } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Submission = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  bill_rate: number | null;
  start_date: string | null;
  candidates: { id: string; full_name: string } | null;
  jobs: { id: string; title: string; company_name: string | null } | null;
};

const PAGE_SIZE = 40;

// Mirrors the CHECK constraint on submissions.status (001_schema.sql).
const FILTERS = ['all', 'submitted', 'interviewing', 'offered', 'hired', 'rejected'] as const;
type Filter = (typeof FILTERS)[number];

export function Submissions({ onCandidate }: { onCandidate: (id: string, name: string) => void }) {
  const [filter, setFilter] = useState<Filter>('all');

  const run = useCallback(() => {
    let q = supabase
      .from('submissions')
      .select('id, status, submitted_at, bill_rate, start_date, candidates(id, full_name), jobs(id, title, company_name)')
      .order('submitted_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (filter !== 'all') q = q.eq('status', filter);
    return asRows<Submission>(q);
  }, [filter]);

  const { rows, loading, refreshing, error, refresh, reload } = useRows<Submission>(run);

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filter, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}

      {loading && rows.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState title={filter === 'all' ? 'No submissions yet.' : `No ${filter} submissions.`} />}
          renderItem={({ item }) => (
            <Card
              onPress={
                item.candidates ? () => onCandidate(item.candidates!.id, item.candidates!.full_name) : undefined
              }
            >
              <View style={styles.row}>
                <Text style={styles.name}>{item.candidates?.full_name ?? 'Unknown candidate'}</Text>
                {item.status ? <Pill label={item.status} /> : null}
              </View>
              <Text style={styles.job}>
                {item.jobs?.title ?? 'Unknown job'}
                {item.jobs?.company_name ? ` · ${item.jobs.company_name}` : ''}
              </Text>
              <View style={styles.metaRow}>
                {formatDate(item.submitted_at) ? (
                  <Text style={styles.sub}>Submitted {formatDate(item.submitted_at)}</Text>
                ) : null}
                {formatMoney(item.bill_rate) ? (
                  <Text style={styles.sub}>{formatMoney(item.bill_rate)}/hr</Text>
                ) : null}
                {formatDate(item.start_date) ? (
                  <Text style={styles.sub}>Starts {formatDate(item.start_date)}</Text>
                ) : null}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md },
  filter: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  job: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  sub: { color: colors.muted, fontSize: 12 },
});
