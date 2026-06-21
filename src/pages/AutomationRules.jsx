import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Mail,
  Clock,
  Zap,
  Edit,
  Trash2,
  RefreshCcw,
  CheckCircle,
  XCircle
} from "lucide-react";
import { AutomationRule } from "@/entities/AutomationRule";
import { EmailTemplate } from "@/entities/EmailTemplate";
import PageHeader from "@/components/common/PageHeader";
import AutomationRuleForm from "@/components/automation/AutomationRuleForm";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function AutomationRules() {
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const [rulesData, templatesData] = await Promise.all([
        AutomationRule.list("-created_date"),
        EmailTemplate.list()
      ]);
      setRules(rulesData || []);
      setTemplates(templatesData || []);
    } catch (error) {
      console.error("Error loading automation rules:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to load automation rules" });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleToggleActive = async (rule) => {
    try {
      await AutomationRule.update(rule.id, { is_active: !rule.is_active });
      addNotification({ 
        type: "success", 
        title: rule.is_active ? "Deactivated" : "Activated", 
        message: `Rule "${rule.name}" ${rule.is_active ? "deactivated" : "activated"}` 
      });
      loadRules();
    } catch (error) {
      console.error("Error toggling rule:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update rule" });
    }
  };

  const handleDelete = async (rule) => {
    if (!confirm(`Are you sure you want to delete "${rule.name}"?`)) return;
    try {
      await AutomationRule.delete(rule.id);
      addNotification({ type: "success", title: "Deleted", message: `Rule "${rule.name}" deleted` });
      loadRules();
    } catch (error) {
      console.error("Error deleting rule:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to delete rule" });
    }
  };

  const getTriggerBadge = (rule) => {
    if (rule.trigger_type === "status_change") {
      return (
        <Badge className="bg-blue-100 text-blue-800">
          Status Change: {rule.trigger_status_to?.replace("_", " ")}
        </Badge>
      );
    } else if (rule.trigger_type === "time_based") {
      return <Badge className="bg-purple-100 text-purple-800">Time Based</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-800">Manual</Badge>;
  };

  const getActionBadge = (rule) => {
    if (rule.action_type === "send_email") {
      const template = templates.find(t => t.id === rule.email_template_id);
      return (
        <Badge className="bg-green-100 text-green-800">
          <Mail className="w-3 h-3 mr-1" />
          Email: {template?.title || "Unknown Template"}
        </Badge>
      );
    } else if (rule.action_type === "create_task") {
      return <Badge className="bg-orange-100 text-orange-800">Create Task</Badge>;
    }
    return <Badge className="bg-slate-100 text-slate-800">Notification</Badge>;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Automation Rules"
        subtitle="Automate your recruitment workflow with smart rules"
        right={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={loadRules}>
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button onClick={() => { setShowForm(true); setEditingRule(null); }} className="gap-2">
              <Plus className="w-4 h-4" />
              New Rule
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Rules</p>
                <p className="text-2xl font-bold text-slate-900">{rules.length}</p>
              </div>
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Rules</p>
                <p className="text-2xl font-bold text-slate-900">
                  {rules.filter(r => r.is_active).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Triggers</p>
                <p className="text-2xl font-bold text-slate-900">
                  {rules.reduce((sum, r) => sum + (r.trigger_count || 0), 0)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-slate-600">Loading automation rules...</p>
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No automation rules yet</h3>
            <p className="text-slate-600 mb-4">
              Create your first automation rule to streamline your recruitment process
            </p>
            <Button onClick={() => { setShowForm(true); setEditingRule(null); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map(rule => (
            <Card key={rule.id} className={rule.is_active ? "" : "opacity-60"}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{rule.name}</h3>
                      {rule.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-800">Inactive</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-sm text-slate-600 mb-3">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {getTriggerBadge(rule)}
                      <span className="text-slate-400">→</span>
                      {getActionBadge(rule)}
                      {rule.email_recipient_type && (
                        <Badge variant="outline" className="text-xs">
                          To: {rule.email_recipient_type.replace("_", " ")}
                        </Badge>
                      )}
                      {rule.delay_minutes > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Delay: {rule.delay_minutes}m
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Triggered: {rule.trigger_count || 0} times</span>
                      {rule.last_triggered && (
                        <span>Last: {new Date(rule.last_triggered).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setEditingRule(rule); setShowForm(true); }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AutomationRuleForm
          open={showForm}
          rule={editingRule}
          templates={templates}
          onClose={() => { setShowForm(false); setEditingRule(null); }}
          onSave={() => {
            setShowForm(false);
            setEditingRule(null);
            loadRules();
          }}
        />
      )}
    </div>
  );
}