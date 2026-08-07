import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRows } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Loading, Pill } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Job = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  job_type: string | null;
  status: string | null;
  priority: string | null;
  openings: number | null;
  created_at: string;
};

const PAGE_SIZE = 30;

// Mirrors the CHECK constraint on jobs.status (001_schema.sql).
const FILTERS = ['all', 'open', 'on_hold', 'filled', 'closed'] as const;
type Filter = (typeof FILTERS)[number];

export function Jobs({ onOpen }: { onOpen: (id: string, title: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('open');

  const run = useCallback(
    (search: string) => {
      let q = supabase
        .from('jobs')
        .select('id, title, company_name, location, job_type, status, priority, openings, created_at')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (filter !== 'all') q = q.eq('status', filter);

      if (search.trim()) {
        // Escape PostgREST's or() delimiters — a comma or paren in the search
        // box would otherwise be parsed as filter syntax rather than as text.
        const safe = search.trim().replace(/[,()]/g, ' ');
        q = q.or(`title.ilike.%${safe}%,company_name.ilike.%${safe}%,location.ilike.%${safe}%`);
      }
      return q;
    },
    [filter],
  );

  const { rows, loading, refreshing, error, refresh, reload } = useRows<Job>(run, query, { debounceMs: 250 });

  return (
    <View style={styles.flex}>
      <TextInput
        style={styles.search}
        placeholder="Search title, company or location"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        returnKeyType="search"
      />

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.replace(/_/g, ' ')}
            </Text>
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
          ListEmptyComponent={
            <EmptyState
              title={query ? 'No jobs match that search.' : `No ${filter === 'all' ? '' : filter.replace(/_/g, ' ')} jobs.`}
              hint={filter === 'all' ? undefined : 'Try the "all" filter.'}
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => onOpen(item.id, item.title)}>
              <Text style={styles.title}>{item.title}</Text>
              {item.company_name ? <Text style={styles.meta}>{item.company_name}</Text> : null}
              <View style={styles.row}>
                {item.location ? <Text style={styles.sub}>{item.location}</Text> : null}
                {item.status ? <Pill label={item.status} /> : null}
                {item.priority && item.priority !== 'medium' ? <Pill label={item.priority} /> : null}
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
  search: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    marginHorizontal: spacing.md, marginTop: spacing.md, fontSize: 15, color: colors.text,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.md, paddingBottom: spacing.sm },
  filter: {
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  sub: { color: colors.muted, fontSize: 13 },
});
