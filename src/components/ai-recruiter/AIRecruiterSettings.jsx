import { useState, useEffect } from "react";
import { AIRecruiterSettings as AIRecruiterSettingsEntity } from "@/entities/AIRecruiterSettings";
import { refreshAIRecruiterSettings } from "@/lib/aiRecruiterSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Laptop } from "lucide-react";

const LOCAL_DEFAULT_MODEL = "local/google/gemma-4-12b-qat";

// Suggestions for the model inputs — free text is allowed, since the local
// fleet changes as models are loaded/unloaded in LM Studio.
const MODEL_SUGGESTIONS = [
  "local/google/gemma-4-12b-qat",
  "local/qwen/qwen2.5-coder-14b",
  "local/openai/gpt-oss-20b",
  "local/llama3.1-8b",
  "openai-compatible",
  "deepseek-chat",
  "deepseek-reasoner",
  "qwen-turbo",
  "qwen-plus",
  "qwen-max",
  "claude-3-5-haiku-20241022",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "gpt-4o-mini",
  "gpt-4o",
  "llama3.2",
];

export default function AIRecruiterSettings() {
  const [settings, setSettings] = useState(/** @type {any} */ (null));
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const rows = await AIRecruiterSettingsEntity.list("", 1);
      if (rows.length > 0) {
        setSettings(rows[0]);
      } else {
        const created = await AIRecruiterSettingsEntity.create({
          default_model: LOCAL_DEFAULT_MODEL,
          matching_model: LOCAL_DEFAULT_MODEL,
          drafting_model: LOCAL_DEFAULT_MODEL,
          parsing_model: LOCAL_DEFAULT_MODEL,
          insights_model: LOCAL_DEFAULT_MODEL,
          openai_compatible_base_url: "",
          openai_compatible_model: "",
          max_candidates: 50,
          minimum_match_score: 50,
          require_human_approval: true,
          send_immediately_on_approval: true,
          auto_followup_enabled: true,
          default_followup_cadence: 3,
          max_followups: 3,
        });
        setSettings(created);
      }
    } catch (err) {
      console.error("Failed to load AI settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await AIRecruiterSettingsEntity.update(settings.id, settings);
      await refreshAIRecruiterSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const applyLocalDefaults = () => {
    setSettings((prev) => ({
      ...prev,
      default_model: LOCAL_DEFAULT_MODEL,
      matching_model: LOCAL_DEFAULT_MODEL,
      drafting_model: LOCAL_DEFAULT_MODEL,
      insights_model: LOCAL_DEFAULT_MODEL,
      parsing_model: LOCAL_DEFAULT_MODEL,
    }));
  };

  const applyCheapestDefaults = () => {
    setSettings((prev) => ({
      ...prev,
      default_model: "deepseek-chat",
      matching_model: "deepseek-chat",
      drafting_model: "deepseek-chat",
      insights_model: "deepseek-chat",
      parsing_model: "gpt-4o-mini",
    }));
  };

  /** @param {string} key @param {any} val */
  const set = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading settings…</span>
      </div>
    );
  }

  if (!settings) return <div className="py-8 text-center text-muted-foreground">Failed to load settings.</div>;

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-6">AI Recruiter Settings</h2>

      <div className="space-y-6">
        {/* Models */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">LLM Models</h3>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={applyLocalDefaults}>
                <Laptop className="w-3.5 h-3.5 mr-1.5" />
                Use local (free)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={applyCheapestDefaults}>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Use cheapest cloud
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Free text — any model id works. Prefix with <code>local/</code> to route through your
            LM Studio tunnel (e.g. <code>local/google/gemma-4-12b-qat</code>). If a call fails, the
            server automatically falls back: DeepSeek → Qwen → Claude Haiku.
          </p>
          <datalist id="llm-model-suggestions">
            {MODEL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}
          </datalist>
          <div className="space-y-3">
            {[
              { label: "Default Model",  key: "default_model" },
              { label: "Matching Model", key: "matching_model" },
              { label: "Drafting Model", key: "drafting_model" },
              { label: "Parsing Model",  key: "parsing_model", hint: "JSON extraction — keep on a strong model" },
              { label: "Insights Model",   key: "insights_model" },
            ].map(({ label, key, hint }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
                <Input
                  list="llm-model-suggestions"
                  placeholder={LOCAL_DEFAULT_MODEL}
                  value={settings[key] || ""}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* OpenAI-Compatible Endpoint (local Qwen / vLLM / tunnel / hosted proxy) */}
        <section className="border-t pt-5">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">OpenAI-Compatible Endpoint</h3>
          <p className="text-sm text-muted-foreground mb-3">
            For the local LM Studio fleet, run <code>./scripts/tunnel-lmstudio.sh</code> and paste the
            tunnel URL here (also set OPENAI_COMPATIBLE_BASE_URL + OPENAI_COMPATIBLE_API_KEY as Supabase
            Edge Function secrets). Works for vLLM, llama.cpp server, or any hosted /v1-compatible API too.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Base URL</label>
              <Input
                type="url"
                placeholder="https://your-tunnel.example.com/v1"
                value={settings.openai_compatible_base_url || ""}
                onChange={(e) => set("openai_compatible_base_url", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model ID</label>
              <Input
                placeholder="qwen2.5-14b-instruct"
                value={settings.openai_compatible_model || ""}
                onChange={(e) => set("openai_compatible_model", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Matching */}
        <section className="border-t pt-5">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Matching</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Max Candidates</label>
              <Input type="number" min={1} max={200} value={settings.max_candidates}
                onChange={(e) => set("max_candidates", parseInt(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Min Match Score</label>
              <Input type="number" min={0} max={100} value={settings.minimum_match_score}
                onChange={(e) => set("minimum_match_score", parseInt(e.target.value))} />
            </div>
          </div>
        </section>

        {/* Follow-ups */}
        <section className="border-t pt-5">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Follow-ups</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Cadence (days)</label>
              <Input type="number" min={1} max={14} value={settings.default_followup_cadence}
                onChange={(e) => set("default_followup_cadence", parseInt(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Follow-ups</label>
              <Input type="number" min={1} max={10} value={settings.max_followups}
                onChange={(e) => set("max_followups", parseInt(e.target.value))} />
            </div>
          </div>
        </section>

        {/* Flags */}
        <section className="border-t pt-5">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Behaviour</h3>
          <div className="space-y-2.5 text-sm">
            {[
              { key: "require_human_approval",       label: "Require human approval before sending" },
              { key: "send_immediately_on_approval", label: "Send immediately when draft is approved" },
              { key: "auto_followup_enabled",        label: "Auto follow-up after submission" },
              { key: "auto_match_enabled",           label: "Auto-match candidates on new job parse" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" className="rounded"
                  checked={!!settings[key]}
                  onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </section>

        <div className="border-t pt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={loadSettings} disabled={loading || saving}>Reset</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : saved ? "Saved ✓" : "Save Settings"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
