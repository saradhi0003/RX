import { useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, uploadFile, type PickedFile } from '../lib/upload';
import { colors, radius, spacing } from '../theme';

type QueueItem = {
  key: string;
  name: string;
  state: 'uploading' | 'done' | 'error';
  message?: string;
};

/**
 * Capture a resume from the phone — a career fair, a coffee meeting — and file
 * it against a candidate without opening a laptop.
 *
 * The pipeline is the web app's contract, re-expressed for the phone:
 *   pick → validate (ext + size) → upload to `<uid>/…` in the private bucket
 *        → create the candidate row holding the storage PATH.
 *
 * Parsing deliberately stays on the web. The parseResumeFile Edge Function
 * takes extracted `resume_text`, and a phone has no PDF text extractor; making
 * one up here would produce empty candidate records that look parsed. The file
 * is stored and the row is created, so the existing web enrichment can pick it
 * up as normal.
 */
export function Upload() {
  const [name, setName] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);

  const update = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const pickAndUpload = async () => {
    if (!name.trim()) return;

    const picked = await DocumentPicker.getDocumentAsync({
      // Anything; the extension check below is the real gate, and MIME types
      // for .doc/.docx are inconsistent across Android file providers.
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled) return;

    const asset = picked.assets?.[0];
    if (!asset) return;

    const file: PickedFile = {
      uri: asset.uri,
      name: asset.name,
      size: asset.size,
      mimeType: asset.mimeType,
    };

    const key = `${Date.now()}-${asset.name}`;
    setQueue((q) => [{ key, name: asset.name, state: 'uploading' }, ...q]);
    setBusy(true);

    try {
      const { path } = await uploadFile(file);

      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('candidates').insert({
        full_name: name.trim(),
        // The storage PATH, not a signed URL — signatures expire within the
        // hour and this value is persisted. The web renders it via <FileLink>.
        resume_url: path,
        source: 'imported',
        status: 'active',
        created_by: auth?.user?.email ?? null,
      });
      if (error) throw error;

      update(key, { state: 'done', message: `Saved as ${name.trim()}` });
      setName('');
    } catch (e) {
      update(key, {
        state: 'error',
        message: e instanceof Error ? e.message : 'Upload failed',
      });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add a candidate</Text>
      <Text style={styles.subtitle}>
        Enter a name, then attach their resume. Accepted:{' '}
        {ALLOWED_EXTENSIONS.join(', ')} — up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Candidate full name"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
      />

      <Pressable
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={pickAndUpload}
        disabled={!canSubmit}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Choose resume & upload</Text>
        )}
      </Pressable>

      {queue.length > 0 ? (
        <View style={styles.queue}>
          <Text style={styles.queueTitle}>This session</Text>
          {queue.map((item) => (
            <View key={item.key} style={styles.item}>
              <Text style={styles.itemIcon}>
                {item.state === 'done' ? '✅' : item.state === 'error' ? '⚠️' : '⏳'}
              </Text>
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.message ? (
                  <Text style={[styles.itemMsg, item.state === 'error' && styles.itemMsgError]}>
                    {item.message}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.bg, flexGrow: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: {
    color: colors.textSecondary, fontSize: 13, lineHeight: 19,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    fontSize: 15, color: colors.text,
  },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  queue: { marginTop: spacing.lg, gap: spacing.sm },
  queueTitle: {
    color: colors.muted, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  item: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md,
  },
  itemIcon: { fontSize: 16 },
  itemBody: { flex: 1, gap: 2 },
  itemName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemMsg: { color: colors.textSecondary, fontSize: 12 },
  itemMsgError: { color: colors.negative },
});
