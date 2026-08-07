import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRows } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Loading, Pill } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Candidate = {
  id: string;
  full_name: string;
  title: string | null;
  location: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
};

const PAGE_SIZE = 30;

/**
 * The candidate list.
 *
 * No client-side tenant filter, deliberately — visibility is RLS's job
 * (auth_is_approved(), migration 020). An unapproved account running this exact
 * query gets an empty array back from PostgREST, which is the behaviour we want
 * to inherit rather than reimplement here.
 */
export function Candidates({ onOpen }: { onOpen: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');

  const run = useCallback((search: string) => {
    let q = supabase
      .from('candidates')
      .select('id, full_name, title, location, email, status, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (search.trim()) {
      // Escape PostgREST's or() delimiters — a comma or paren in the search box
      // would otherwise be parsed as filter syntax rather than as text.
      const safe = search.trim().replace(/[,()]/g, ' ');
      q = q.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,title.ilike.%${safe}%`);
    }
    return q;
  }, []);

  const { rows, loading, refreshing, error, refresh, reload } = useRows<Candidate>(run, query, { debounceMs: 250 });

  return (
    <View style={styles.flex}>
      <TextInput
        style={styles.search}
        placeholder="Search name, email or title"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        returnKeyType="search"
      />

      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}

      {loading && rows.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState title={query ? 'No candidates match that search.' : 'No candidates yet.'} />
          }
          renderItem={({ item }) => (
            <Card onPress={() => onOpen(item.id, item.full_name)}>
              <Text style={styles.name}>{item.full_name}</Text>
              {item.title ? <Text style={styles.meta}>{item.title}</Text> : null}
              <View style={styles.row}>
                {item.location ? <Text style={styles.sub}>{item.location}</Text> : null}
                {item.status ? <Pill label={item.status} /> : null}
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
    margin: spacing.md, fontSize: 15, color: colors.text,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  sub: { color: colors.muted, fontSize: 13 },
});
