import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { humanize, useRows } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Loading, Pill, formatDate } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

// Mirrors the CHECK constraint on tasks.status (001_schema.sql).
const FILTERS = ['open', 'todo', 'in_progress', 'done', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * The one screen that writes. Completing a task is the action a recruiter
 * actually takes on a phone, so it is worth the round trip; everything else on
 * mobile stays read-only and defers to the web app for editing.
 */
export function Tasks() {
  const [filter, setFilter] = useState<Filter>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  const run = useCallback(() => {
    let q = supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, created_at')
      // Undated tasks sort last rather than first — nullsFirst:false is the
      // whole point of naming the option here.
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (filter === 'open') q = q.in('status', ['todo', 'in_progress']);
    else if (filter !== 'all') q = q.eq('status', filter);

    return q;
  }, [filter]);

  const { rows, loading, refreshing, error, refresh, reload } = useRows<Task>(run);

  const toggle = useCallback(
    async (task: Task) => {
      const next = task.status === 'done' ? 'todo' : 'done';
      setBusy(task.id);
      setWriteError(null);
      const { error: err } = await supabase.from('tasks').update({ status: next }).eq('id', task.id);
      setBusy(null);
      if (err) {
        setWriteError(humanize(err.message));
        return;
      }
      // Refetch rather than patching local state: the active filter may no
      // longer include this row, and the list should reflect that.
      await reload();
    },
    [reload],
  );

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filter, filter === f && styles.filterActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {writeError ? <ErrorNotice message={writeError} /> : null}

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
              title={filter === 'open' ? 'Nothing open. Nice.' : 'No tasks here.'}
              hint={filter === 'all' ? undefined : 'Try the "all" filter.'}
            />
          }
          renderItem={({ item }) => {
            const done = item.status === 'done';
            const overdue = !done && isOverdue(item.due_date);
            return (
              <Card>
                <View style={styles.taskRow}>
                  <Pressable
                    onPress={() => toggle(item)}
                    disabled={busy === item.id}
                    hitSlop={8}
                    style={[styles.check, done && styles.checkDone, busy === item.id && styles.checkBusy]}
                  >
                    <Text style={styles.checkMark}>{done ? '✓' : ''}</Text>
                  </Pressable>

                  <View style={styles.taskBody}>
                    <Text style={[styles.title, done && styles.titleDone]}>{item.title}</Text>
                    {item.description ? (
                      <Text style={styles.desc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                      {item.due_date ? (
                        <Text style={[styles.due, overdue && styles.overdue]}>
                          {overdue ? 'Overdue · ' : 'Due '}
                          {formatDate(item.due_date)}
                        </Text>
                      ) : null}
                      {item.priority && item.priority !== 'medium' ? <Pill label={item.priority} /> : null}
                      {item.status ? <Pill label={item.status} /> : null}
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

/** DATE columns come back as 'YYYY-MM-DD'; compare on the date, not the clock,
 *  so a task due today is not "overdue" at 00:01. */
function isOverdue(due?: string | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
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
  taskRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  check: {
    width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2,
    borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkDone: { backgroundColor: colors.positive, borderColor: colors.positive },
  checkBusy: { opacity: 0.4 },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 18 },
  taskBody: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  titleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, flexWrap: 'wrap' },
  due: { color: colors.muted, fontSize: 12 },
  overdue: { color: colors.negative, fontWeight: '700' },
});
