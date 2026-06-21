import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppSettings } from "@/entities/AppSettings";
import PageHeader from "@/components/common/PageHeader";

export default function EmailSettings() {
  const [settings, setSettings] = useState({ email_provider: "none", provider_connected: false, notes: "" });
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const list = await AppSettings.list("-updated_date", 1);
      if (list.length) {
        setSettings({
          email_provider: list[0].email_provider || "none",
          provider_connected: !!list[0].provider_connected,
          notes: list[0].notes || ""
        });
        setExistingId(list[0].id);
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    if (existingId) {
      await AppSettings.update(existingId, settings);
    } else {
      const created = await AppSettings.create(settings);
      setExistingId(created.id);
    }
    setSaving(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Email Settings"
        subtitle="Choose and connect your email provider"
      />

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-slate-600">Email Provider</label>
              <Select
                value={settings.email_provider}
                onValueChange={(v) => setSettings({ ...settings, email_provider: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Configured</SelectItem>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant={settings.provider_connected ? "default" : "outline"}
                className="w-full"
                onClick={() => setSettings({ ...settings, provider_connected: !settings.provider_connected })}
              >
                {settings.provider_connected ? "Connected" : "Mark Connected"}
              </Button>
            </div>
            <div className="flex items-end">
              <Badge className={settings.provider_connected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                {settings.email_provider === "none" ? "Disabled" : settings.provider_connected ? "Active" : "Needs Connection"}
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">Notes</label>
            <Textarea rows={4} value={settings.notes} onChange={(e)=>setSettings({...settings, notes: e.target.value})} placeholder="Document how this account should be connected. OAuth setup is required via Base44 backend functions or platform integration." />
          </div>
          <div className="text-sm text-slate-600">
            Direct Gmail/Outlook OAuth isn’t available in-app. To enable true sending from your mailbox, enable backend functions (Dashboard → Settings) or request an integration via the Feedback button. Until then, emails will be blocked here.
          </div>
          <div className="text-right">
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}