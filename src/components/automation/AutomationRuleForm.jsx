import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { X, Save, Loader2 } from "lucide-react";
import { AutomationRule } from "@/entities/AutomationRule";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function AutomationRuleForm({ open, rule, templates, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger_type: "status_change",
    trigger_entity: "Submission",
    trigger_status_from: "",
    trigger_status_to: "",
    action_type: "send_email",
    email_template_id: "",
    email_recipient_type: "candidate",
    email_custom_recipient: "",
    delay_minutes: 0,
    is_active: true,
    conditions: {}
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!formData.name || !formData.trigger_type || !formData.action_type) {
      addNotification({ type: "error", title: "Error", message: "Please fill in all required fields" });
      return;
    }

    if (formData.action_type === "send_email" && !formData.email_template_id) {
      addNotification({ type: "error", title: "Error", message: "Please select an email template" });
      return;
    }

    setSaving(true);
    try {
      if (rule?.id) {
        await AutomationRule.update(rule.id, formData);
        addNotification({ type: "success", title: "Updated", message: "Automation rule updated successfully" });
      } else {
        await AutomationRule.create(formData);
        addNotification({ type: "success", title: "Created", message: "Automation rule created successfully" });
      }
      onSave?.();
    } catch (error) {
      console.error("Error saving automation rule:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to save automation rule" });
    }
    setSaving(false);
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!open) return null;

  const statusOptions = {
    Submission: ["submitted", "under_review", "interviewing", "rejected", "hired", "withdrawn"],
    Application: ["sourced", "applied", "screening", "submitted", "interviewing", "offered", "hired", "rejected", "withdrawn"]
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{rule ? "Edit Automation Rule" : "New Automation Rule"}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Rule Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g., Send rejection email"
              />
            </div>

            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Describe what this automation does..."
              />
            </div>

            <div>
              <Label>Trigger Type *</Label>
              <Select value={formData.trigger_type} onValueChange={(v) => updateField("trigger_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status_change">Status Change</SelectItem>
                  <SelectItem value="time_based">Time Based</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entity *</Label>
              <Select value={formData.trigger_entity} onValueChange={(v) => updateField("trigger_entity", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Submission">Submission</SelectItem>
                  <SelectItem value="Application">Application</SelectItem>
                  <SelectItem value="Task">Task</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.trigger_type === "status_change" && (
              <>
                <div>
                  <Label>Status To *</Label>
                  <Select value={formData.trigger_status_to} onValueChange={(v) => updateField("trigger_status_to", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {(statusOptions[formData.trigger_entity] || []).map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status From (optional)</Label>
                  <Select value={formData.trigger_status_from || ""} onValueChange={(v) => updateField("trigger_status_from", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Any status</SelectItem>
                      {(statusOptions[formData.trigger_entity] || []).map(status => (
                        <SelectItem key={status} value={status}>
                          {status.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Action Type *</Label>
              <Select value={formData.action_type} onValueChange={(v) => updateField("action_type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="create_task">Create Task</SelectItem>
                  <SelectItem value="send_notification">Send Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.action_type === "send_email" && (
              <>
                <div>
                  <Label>Email Template *</Label>
                  <Select value={formData.email_template_id} onValueChange={(v) => updateField("email_template_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Send To *</Label>
                  <Select value={formData.email_recipient_type} onValueChange={(v) => updateField("email_recipient_type", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="candidate">Candidate</SelectItem>
                      <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                      <SelectItem value="recruiter">Recruiter</SelectItem>
                      <SelectItem value="custom">Custom Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.email_recipient_type === "custom" && (
                  <div className="md:col-span-2">
                    <Label>Custom Email Address</Label>
                    <Input
                      type="email"
                      value={formData.email_custom_recipient}
                      onChange={(e) => updateField("email_custom_recipient", e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Delay (minutes)</Label>
              <Input
                type="number"
                min="0"
                value={formData.delay_minutes}
                onChange={(e) => updateField("delay_minutes", parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">Wait before executing action</p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => updateField("is_active", v)}
              />
              <Label>Active</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {rule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}