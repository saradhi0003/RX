import { useCallback, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useRows } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Loading, Pill } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Company = {
  id: string;
  name: string;
  industry: string | null;
  location: string | null;
  status: string | null;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
};

const PAGE_SIZE = 40;

export function Companies() {
  const [query, setQuery] = useState('');

  const run = useCallback((search: string) => {
    let q = supabase
      .from('companies')
      .select('id, name, industry, location, status, website, contact_name, contact_email')
      .order('name', { ascending: true })
      .limit(PAGE_SIZE);

    if (search.trim()) {
      const safe = search.trim().replace(/[,()]/g, ' ');
      q = q.or(`name.ilike.%${safe}%,industry.ilike.%${safe}%,location.ilike.%${safe}%`);
    }
    return q;
  }, []);

  const { rows, loading, refreshing, error, refresh, reload } = useRows<Company>(run, query, { debounceMs: 250 });

  return (
    <View style={styles.flex}>
      <TextInput
        style={styles.search}
        placeholder="Search company, industry or location"
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState title={query ? 'No companies match that search.' : 'No companies yet.'} />
          }
          renderItem={({ item }) => (
            <Card onPress={item.website ? () => Linking.openURL(normalizeUrl(item.website!)) : undefined}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                {item.status ? <Pill label={item.status} /> : null}
              </View>
              {item.industry ? <Text style={styles.meta}>{item.industry}</Text> : null}
              <View style={styles.metaRow}>
                {item.location ? <Text style={styles.sub}>{item.location}</Text> : null}
                {item.contact_name ? <Text style={styles.sub}>{item.contact_name}</Text> : null}
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

/** Stored websites are often bare hosts ("acme.com"); Linking needs a scheme. */
function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  search: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    margin: spacing.md, fontSize: 15, color: colors.text,
  },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  sub: { color: colors.muted, fontSize: 13 },
});
