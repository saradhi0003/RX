import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { asRows, humanize } from '../lib/useRows';
import { Card, EmptyState, ErrorNotice, Field, Loading, Pill, SectionTitle, formatDate } from '../components/ui';
import { colors, radius, spacing } from '../theme';

type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  title: string | null;
  current_company: string | null;
  current_position: string | null;
  experience_years: number | null;
  desired_salary: string | null;
  notice_period: string | null;
  availability: string | null;
  visa_status: string | null;
  work_authorization: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  summary: string | null;
  skills: string[] | null;
  status: string | null;
  rating: number | null;
  created_at: string;
};

type Sub = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  jobs: { title: string } | null;
};

export function CandidateDetail({ id }: { id: string }) {
  const [row, setRow] = useState<Candidate | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      supabase
        .from('candidates')
        .select(
          'id, full_name, email, phone, location, title, current_company, current_position, experience_years, desired_salary, notice_period, availability, visa_status, work_authorization, linkedin_url, resume_url, summary, skills, status, rating, created_at',
        )
        .eq('id', id)
        .maybeSingle(),
      asRows<Sub>(
        supabase
          .from('submissions')
          .select('id, status, submitted_at, jobs(title)')
          .eq('candidate_id', id)
          .order('submitted_at', { ascending: false })
          .limit(50),
      ),
    ]);

    if (c.error || s.error) {
      setError(humanize((c.error ?? s.error)!.message));
      return;
    }
    setError(null);
    setRow(c.data as Candidate | null);
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

  /**
   * `resume_url` holds a storage PATH since migration 023 (the bucket is
   * private), so it has to be signed before it can be opened. Legacy rows still
   * hold absolute Base44 URLs — those are passed through unchanged, matching
   * what FileLink does on the web.
   */
  const openResume = useCallback(async () => {
    if (!row?.resume_url) return;
    setResumeBusy(true);
    try {
      if (/^https?:\/\//i.test(row.resume_url)) {
        await Linking.openURL(row.resume_url);
        return;
      }
      const { data, error: err } = await supabase.storage
        .from('uploads')
        .createSignedUrl(row.resume_url, 60 * 60);
      if (err || !data?.signedUrl) {
        setError(humanize(err?.message ?? 'Could not open that resume.'));
        return;
      }
      await Linking.openURL(data.signedUrl);
    } finally {
      setResumeBusy(false);
    }
  }, [row?.resume_url]);

  if (loading && !row) return <Loading />;
  if (error && !row) return <ErrorNotice message={error} onRetry={load} />;
  if (!row) {
    return (
      <EmptyState
        title="Candidate not found"
        hint="It may have been deleted, or your account may not have access to it."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {error ? <ErrorNotice message={error} onRetry={load} /> : null}

      <Text style={styles.name}>{row.full_name}</Text>
      {row.title ? <Text style={styles.title}>{row.title}</Text> : null}
      <View style={styles.pills}>
        {row.status ? <Pill label={row.status} /> : null}
        {row.rating ? <Pill label={`★ ${row.rating}`} tone="submitted" /> : null}
      </View>

      <View style={styles.actions}>
        {row.email ? (
          <Action label="Email" onPress={() => Linking.openURL(`mailto:${row.email}`)} />
        ) : null}
        {row.phone ? <Action label="Call" onPress={() => Linking.openURL(`tel:${row.phone}`)} /> : null}
        {row.resume_url ? (
          <Action label={resumeBusy ? 'Opening…' : 'Resume'} onPress={openResume} disabled={resumeBusy} />
        ) : null}
        {row.linkedin_url ? (
          <Action label="LinkedIn" onPress={() => Linking.openURL(row.linkedin_url!)} />
        ) : null}
      </View>

      <SectionTitle>Contact</SectionTitle>
      <Card>
        <Field label="Email" value={row.email} />
        <Field label="Phone" value={row.phone} />
        <Field label="Location" value={row.location} />
      </Card>

      <SectionTitle>Profile</SectionTitle>
      <Card>
        <Field label="Company" value={row.current_company} />
        <Field label="Position" value={row.current_position} />
        <Field label="Experience" value={row.experience_years != null ? `${row.experience_years} yrs` : null} />
        <Field label="Desired" value={row.desired_salary} />
        <Field label="Notice" value={row.notice_period} />
        <Field label="Available" value={row.availability} />
        <Field label="Visa" value={row.visa_status ?? row.work_authorization} />
        <Field label="Added" value={formatDate(row.created_at)} />
      </Card>

      {row.skills?.length ? (
        <>
          <SectionTitle>Skills</SectionTitle>
          <View style={styles.pills}>
            {row.skills.map((skill) => (
              <Pill key={skill} label={skill} tone="submitted" />
            ))}
          </View>
        </>
      ) : null}

      {row.summary ? (
        <>
          <SectionTitle>Summary</SectionTitle>
          <Card>
            <Text style={styles.body}>{row.summary}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Submissions ({subs.length})</SectionTitle>
      {subs.length === 0 ? (
        <EmptyState title="Not submitted to any job yet." />
      ) : (
        <View style={styles.list}>
          {subs.map((sub) => (
            <Card key={sub.id}>
              <View style={styles.subRow}>
                <Text style={styles.subName}>{sub.jobs?.title ?? 'Unknown job'}</Text>
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

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.actionDisabled]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  title: { color: colors.textSecondary, fontSize: 15, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 9,
  },
  actionPressed: { backgroundColor: colors.primaryDark },
  actionDisabled: { opacity: 0.6 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  list: { gap: spacing.sm },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subName: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
