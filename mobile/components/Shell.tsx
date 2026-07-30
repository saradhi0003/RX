import type { ReactNode } from 'react';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

// RN's SafeAreaView is a no-op on Android, so the header would sit under the
// status bar and the tab bar under the gesture pill. Pad explicitly instead.
const ANDROID_TOP_INSET = Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0;
const ANDROID_BOTTOM_INSET = Platform.OS === 'android' ? 12 : 0;

export type Route = 'candidates' | 'upload';

const TABS: { key: Route; label: string; icon: string }[] = [
  { key: 'candidates', label: 'Candidates', icon: '👥' },
  { key: 'upload', label: 'Add', icon: '⬆️' },
];

/** Header + bottom tab bar. Deliberately hand-rolled: two tabs do not justify
 *  a navigation library and its native dependencies. */
export function Shell({
  route,
  onRoute,
  email,
  children,
}: {
  route: Route;
  onRoute: (r: Route) => void;
  email: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.badge}>
            <Text style={styles.badgeMark}>TS</Text>
          </View>
          <Text style={styles.title}>TalentStack</Text>
        </View>
        <Pressable onPress={() => supabase.auth.signOut()} hitSlop={10}>
          <Text style={styles.signOut} numberOfLines={1}>
            Sign out
          </Text>
        </Pressable>
      </View>

      <Text style={styles.email} numberOfLines={1}>
        {email}
      </Text>

      <View style={styles.body}>{children}</View>

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const activeTab = tab.key === route;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab && styles.tabActive]}
              onPress={() => onRoute(tab.key)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab && styles.tabLabelActive]}>{tab.label}</Text>
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeMark: { color: '#fff', fontWeight: '800', fontSize: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  signOut: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
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
