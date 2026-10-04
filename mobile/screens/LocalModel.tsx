import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

const MODEL_URL =
  "https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf";

/** Downloads the same SLM the desktop script uses. Inference still runs on the computer. */
export function LocalModel() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Local model</Text>
      <Text style={styles.body}>
        Recruiter X uses SmolLM2 360M so resume parsing and chat do not need a paid API.
        The weights download with the desktop app. This phone can save the same file, then
        talk to the computer that is serving it.
      </Text>
      <Pressable style={styles.button} onPress={() => Linking.openURL(MODEL_URL)}>
        <Text style={styles.buttonText}>Download SmolLM2 on this phone</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>On the computer</Text>
        <Text style={styles.mono}>./scripts/download-slm.sh{"\n"}./scripts/serve-slm.sh</Text>
        <Text style={styles.body}>
          Then run the tunnel only if the phone is off the same machine. A named Cloudflare
          tunnel (CLOUDFLARE_TUNNEL_TOKEN) keeps the hostname stable.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: "#2563EB", borderRadius: radius.md, padding: spacing.md },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  cardTitle: { color: colors.text, fontWeight: "700" },
  mono: { fontFamily: "Menlo", color: colors.text, fontSize: 12 },
});
