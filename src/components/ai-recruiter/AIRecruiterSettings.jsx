import { useState, useEffect } from "react";
import { AIRecruiterSettings as AIRecruiterSettingsEntity } from "@/entities/AIRecruiterSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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
          default_model: "gpt-4o-mini",
          matching_model: "gpt-4o-mini",
          drafting_model: "gpt-4o",
          parsing_model: "gpt-4o-mini",
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
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
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">LLM Models</h3>
          <div className="space-y-3">
            {[
              { label: "Matching Model", key: "matching_model" },
              { label: "Drafting Model", key: "drafting_model" },
              { label: "Parsing Model",  key: "parsing_model" },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <Select value={settings[key]} onValueChange={(v) => set(key, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                    <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                    <SelectItem value="claude-haiku-4-5-20251001">claude-haiku</SelectItem>
                    <SelectItem value="claude-sonnet-4-6">claude-sonnet</SelectItem>
                    <SelectItem value="llama3.2">llama3.2 (local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
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
