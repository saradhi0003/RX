import type { ReactNode } from 'react';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

// RN's SafeAreaView is a no-op on Android, so the header would sit under the
// status bar and the tab bar under the gesture pill. Pad explicitly instead.
const ANDROID_TOP_INSET = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;
const ANDROID_BOTTOM_INSET = Platform.OS === 'android' ? 12 : 0;

/** Bottom-tab destinations. Anything reachable but secondary lives behind
 *  'more' rather than crowding the bar past five targets. */
export type Tab = 'dashboard' | 'candidates' | 'jobs' | 'tasks' | 'more';

/** Screens pushed OVER a tab. Still hand-rolled: one level of depth does not
 *  justify react-navigation and the native dependencies it drags in, which
 *  would turn every future JS-only change into a full rebuild. */
export type Detail =
  | { screen: 'candidate'; id: string; title: string }
  | { screen: 'job'; id: string; title: string }
  | { screen: 'submissions' }
  | { screen: 'companies' }
  | { screen: 'upload' };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Home', icon: '📊' },
  { key: 'candidates', label: 'Candidates', icon: '👥' },
  { key: 'jobs', label: 'Jobs', icon: '💼' },
  { key: 'tasks', label: 'Tasks', icon: '✅' },
  { key: 'more', label: 'More', icon: '⋯' },
];

export function Shell({
  tab,
  onTab,
  email,
  detailTitle,
  onBack,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  email: string;
  detailTitle?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.brand}>
            <Text style={styles.back}>‹</Text>
            <Text style={styles.title} numberOfLines={1}>
              {detailTitle ?? 'Back'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <View style={styles.badge}>
              <Text style={styles.badgeMark}>TS</Text>
            </View>
            <Text style={styles.title}>TalentStack</Text>
          </View>
        )}
        <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10}>
          <Text style={styles.signOut} numberOfLines={1}>
            Sign out
          </Text>
        </Pressable>
      </View>

      {onBack ? null : (
        <Text style={styles.email} numberOfLines={1}>
          {email}
        </Text>
      )}

      <View style={styles.body}>{children}</View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const activeTab = t.key === tab && !onBack;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, activeTab && styles.tabActive]}
              onPress={() => onTab(t.key)}
            >
              <Text style={styles.tabIcon}>{t.icon}</Text>
              <Text style={[styles.tabLabel, activeTab && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.sm + ANDROID_TOP_INSET,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  badge: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeMark: { color: '#fff', fontWeight: '800', fontSize: 12 },
  back: { color: colors.secondary, fontSize: 28, fontWeight: '400', marginTop: -4 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', flexShrink: 1 },
  signOut: { color: colors.secondary, fontSize: 13, fontWeight: '600', paddingLeft: spacing.sm },
  email: { color: colors.muted, fontSize: 12, paddingHorizontal: spacing.md, paddingTop: 2 },
  body: { flex: 1 },
  tabs: {
    flexDirection: 'row', borderTopColor: colors.border, borderTopWidth: 1,
    backgroundColor: colors.surface, paddingBottom: ANDROID_BOTTOM_INSET,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabActive: { backgroundColor: colors.primarySoft },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  tabLabelActive: { color: colors.primaryDark },
});
