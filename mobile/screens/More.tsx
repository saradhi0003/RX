import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Detail } from '../components/Shell';
import { colors, radius, spacing } from '../theme';

const ITEMS: { detail: Detail; icon: string; label: string; hint: string }[] = [
  { detail: { screen: 'submissions' }, icon: '📤', label: 'Submissions', hint: 'Candidates sent to clients' },
  { detail: { screen: 'companies' }, icon: '🏢', label: 'Companies', hint: 'Clients and prospects' },
  { detail: { screen: 'upload' }, icon: '⬆️', label: 'Add candidate', hint: 'Upload a resume' },
];

/** Overflow menu for destinations that do not earn a permanent tab. */
export function More({ onOpen, email }: { onOpen: (d: Detail) => void; email: string }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            onPress={() => onOpen(item.detail)}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.body}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.hint}>{item.hint}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}>
        Signed in as {email}.{'\n'}
        Editing candidates, jobs and invoices stays on the web app.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.lg },
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md,
  },
  itemPressed: { backgroundColor: colors.surfaceAlt },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 1 },
  label: { color: colors.text, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.muted, fontSize: 22 },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
