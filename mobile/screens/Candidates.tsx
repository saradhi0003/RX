import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { supabase } from '../lib/supabase';
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
export function Candidates() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (search: string) => {
    setError(null);
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

    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRows(data ?? []);
  }, []);

  useEffect(() => {
    // Debounce so a fast typist doesn't fire a query per keystroke.
    const t = setTimeout(() => {
      setLoading(true);
      load(query).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(query);
    setRefreshing(false);
  }, [load, query]);

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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={styles.spinner} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query ? 'No candidates match that search.' : 'No candidates yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card}>
              <Text style={styles.name}>{item.full_name}</Text>
              {item.title ? <Text style={styles.meta}>{item.title}</Text> : null}
              <View style={styles.row}>
                {item.location ? <Text style={styles.sub}>{item.location}</Text> : null}
                {item.status ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{item.status}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
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
  spinner: { marginTop: spacing.xl },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, gap: 2,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  sub: { color: colors.muted, fontSize: 13 },
  pill: {
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 2,
  },
  pillText: { color: colors.primaryDark, fontSize: 11, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
  error: {
    color: colors.negative, fontSize: 13, textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
