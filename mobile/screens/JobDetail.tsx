import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { asRows, humanize } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Field, Loading, Pill, SectionTitle, formatDate } from '../components/ui';
import { colors, spacing } from '../theme';

type Job = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  job_type: string | null;
  salary_range: string | null;
  status: string | null;
  priority: string | null;
  openings: number | null;
  experience_min: number | null;
  experience_max: number | null;
  skills_required: string[] | null;
  description: string | null;
  requirements: string | null;
  closing_date: string | null;
  created_at: string;
};

type Sub = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  candidates: { full_name: string } | null;
};

export function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [j, s] = await Promise.all([
      supabase
        .from('jobs')
        .select(
          'id, title, company_name, location, job_type, salary_range, status, priority, openings, experience_min, experience_max, skills_required, description, requirements, closing_date, created_at',
        )
        .eq('id', id)
        .maybeSingle(),
      // The embed follows submissions.candidate_id → candidates(id); PostgREST
      // resolves it from the FK in 001_schema.sql, and RLS still applies to the
      // embedded table, so a hidden candidate comes back as null rather than
      // leaking through the join. asRows() documents why the generated array
      // type is wrong for a many-to-one embed.
      asRows<Sub>(
        supabase
          .from('submissions')
          .select('id, status, submitted_at, candidates(full_name)')
          .eq('job_id', id)
          .order('submitted_at', { ascending: false })
          .limit(50),
      ),
    ]);

    if (j.error || s.error) {
      setError(humanize((j.error ?? s.error)!.message));
      return;
    }
    setError(null);
    setJob(j.data as Job | null);
    setSubs(s.data ?? []);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading && !job) return <Loading />;

  if (error && !job) return <ErrorNotice message={error} onRetry={load} />;

  if (!job) {
    return (
      <EmptyState
        title="Job not found"
        hint="It may have been deleted, or your account may not have access to it."
      />
    );
  }

  const experience =
    job.experience_min != null || job.experience_max != null
      ? `${job.experience_min ?? 0}–${job.experience_max ?? '+'} yrs`
      : null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <Text style={styles.title}>{job.title}</Text>
      {job.company_name ? <Text style={styles.company}>{job.company_name}</Text> : null}
      <View style={styles.pills}>
        {job.status ? <Pill label={job.status} /> : null}
        {job.priority ? <Pill label={job.priority} /> : null}
        {job.job_type ? <Pill label={job.job_type} /> : null}
      </View>

      <SectionTitle>Details</SectionTitle>
      <Card>
        <Field label="Location" value={job.location} />
        <Field label="Salary" value={job.salary_range} />
        <Field label="Experience" value={experience} />
        <Field label="Openings" value={job.openings} />
        <Field label="Closes" value={formatDate(job.closing_date)} />
        <Field label="Created" value={formatDate(job.created_at)} />
      </Card>

      {job.skills_required?.length ? (
        <>
          <SectionTitle>Skills</SectionTitle>
          <View style={styles.pills}>
            {job.skills_required.map((skill) => (
              <Pill key={skill} label={skill} tone="submitted" />
            ))}
          </View>
        </>
      ) : null}

      {job.description ? (
        <>
          <SectionTitle>Description</SectionTitle>
          <Card>
            <Text style={styles.body}>{job.description}</Text>
          </Card>
        </>
      ) : null}

      {job.requirements ? (
        <>
          <SectionTitle>Requirements</SectionTitle>
          <Card>
            <Text style={styles.body}>{job.requirements}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Submissions ({subs.length})</SectionTitle>
      {subs.length === 0 ? (
        <EmptyState title="No submissions yet." />
      ) : (
        <View style={styles.list}>
          {subs.map((sub) => (
            <Card key={sub.id}>
              <View style={styles.subRow}>
                <Text style={styles.subName}>{sub.candidates?.full_name ?? 'Unknown candidate'}</Text>
                {sub.status ? <Pill label={sub.status} /> : null}
              </View>
              {formatDate(sub.submitted_at) ? (
                <Text style={styles.sub}>Submitted {formatDate(sub.submitted_at)}</Text>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  company: { color: colors.textSecondary, fontSize: 15, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  list: { gap: spacing.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subName: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
