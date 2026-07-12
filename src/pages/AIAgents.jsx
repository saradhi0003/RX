import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  Trash2,
  Loader2,
  Brain,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Code
} from "lucide-react";

import { addNotification } from "@/components/notifications/NotificationToast";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import EmptyState from "@/components/common/EmptyState";
import AIAgentBuilder from "@/components/agents/AIAgentBuilder";
import { Agent } from "@/entities/Agent";
import { AgentRun } from "@/entities/AgentRun";
import { useEntityList } from "@/hooks/useEntityList";

// DB row (trigger_config JSONB) ↔ builder form ({ trigger }) mapping.
const toUi = (row) => ({ ...row, trigger: row.trigger_config || {}, actions: row.actions || [] });
const toRow = (form) => ({
  name: form.name,
  description: form.description,
  type: form.type,
  trigger_config: form.trigger || {},
  actions: form.actions || [],
  enabled: form.enabled !== false,
});

export default function AIAgents() {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);

  const {
    data: agentRows,
    loading,
    error,
    reload,
  } = useEntityList(() => Agent.list("-created_date"));
  const { data: runs, reload: reloadRuns } = useEntityList(() =>
    AgentRun.list("-started_at", 200)
  );

  const agents = useMemo(() => agentRows.map(toUi), [agentRows]);

  // Per-agent run stats derived from the last 200 runs.
  const runStats = useMemo(() => {
    const map = new Map();
    for (const r of runs) {
      const s = map.get(r.agent_id) || { runs: 0, successes: 0, lastRun: null, durTotal: 0, durCount: 0 };
      s.runs += 1;
      if (r.status === "success") s.successes += 1;
      if (!s.lastRun || r.started_at > s.lastRun) s.lastRun = r.started_at;
      if (r.completed_at && r.started_at) {
        s.durTotal += (new Date(r.completed_at) - new Date(r.started_at)) / 1000;
        s.durCount += 1;
      }
      map.set(r.agent_id, s);
    }
    return map;
  }, [runs]);

  const statsFor = (agentId) => {
    const s = runStats.get(agentId);
    return {
      runs: s?.runs || 0,
      successes: s?.successes || 0,
      lastRun: s?.lastRun || null,
      avgDuration: s?.durCount ? (s.durTotal / s.durCount).toFixed(1) : 0,
    };
  };

  const stats = useMemo(() => {
    const totalRuns = runs.length;
    const totalSuccesses = runs.filter((r) => r.status === "success").length;
    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.enabled).length,
      totalRuns,
      successRate: totalRuns > 0 ? Math.round((totalSuccesses / totalRuns) * 100) : 0,
    };
  }, [agents, runs]);

  const toggleAgent = async (agent) => {
    try {
      await Agent.update(agent.id, { enabled: !agent.enabled });
      await reload();
      addNotification({
        type: "success",
        title: "Agent Updated",
        message: `${agent.name} ${agent.enabled ? "paused" : "activated"}`
      });
    } catch (err) {
      console.error("Error toggling agent:", err);
      addNotification({
        type: "error",
        title: "Update Failed",
        message: err?.message || "Failed to update agent status"
      });
    }
  };

  const deleteAgent = async (agent) => {
    if (!confirm(`Delete agent "${agent.name}"? Its run history is removed too.`)) return;

    try {
      await Agent.delete(agent.id);
      await Promise.all([reload(), reloadRuns()]);
      addNotification({
        type: "success",
        title: "Agent Deleted",
        message: "Agent deleted successfully"
      });
    } catch (err) {
      console.error("Error deleting agent:", err);
      addNotification({
        type: "error",
        title: "Delete Failed",
        message: err?.message || "Failed to delete agent"
      });
    }
  };

  const saveAgent = async (form) => {
    try {
      if (editingAgent) await Agent.update(editingAgent.id, toRow(form));
      else await Agent.create(toRow(form));
      setBuilderOpen(false);
      setEditingAgent(null);
      await reload();
      addNotification({
        type: "success",
        title: "Agent Saved",
        message: "AI agent saved successfully"
      });
    } catch (err) {
      console.error("Error saving agent:", err);
      addNotification({
        type: "error",
        title: "Save Failed",
        message: err?.message || "Failed to save agent"
      });
    }
  };

  const getAgentIcon = (type) => {
    switch (type) {
      case "entity_trigger": return Zap;
      case "scheduled": return Clock;
      case "manual": return Play;
      default: return Brain;
    }
  };

  const getAgentTypeBadge = (type) => {
    const colors = {
      entity_trigger: "bg-blue-100 text-blue-800",
      scheduled: "bg-green-100 text-green-800",
      manual: "bg-purple-100 text-purple-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Breadcrumbs items={[{ label: "AI Agents" }]} />
        <PageHeader title="AI Agents" subtitle="Build and manage intelligent automation agents" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={[{ label: "AI Agents" }]} />
      
      <PageHeader
        title="AI Agents"
        subtitle="Build and manage intelligent automation agents"
        right={
          <Button
            onClick={() => {
              setEditingAgent(null);
              setBuilderOpen(true);
            }}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Agents</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Active Agents</p>
                <p className="text-2xl font-bold text-slate-900">{stats.activeAgents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Runs</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Success Rate</p>
                <p className="text-2xl font-bold text-slate-900">{stats.successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Load error — surface it, never a silently blank list */}
      {error && (
        <Card>
          <CardContent className="p-0">
            <EmptyState error={error} action={{ label: "Retry", fn: reload }} />
          </CardContent>
        </Card>
      )}

      {/* Agents List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map(agent => {
          const Icon = getAgentIcon(agent.type);
          const agentStats = statsFor(agent.id);
          return (
            <Card key={agent.id} className={`${agent.enabled ? "border-2 border-green-200" : ""}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      agent.enabled ? "bg-green-100" : "bg-slate-100"
                    }`}>
                      <Icon className={`w-6 h-6 ${agent.enabled ? "text-green-600" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">{agent.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getAgentTypeBadge(agent.type)}>
                          {agent.type.replace("_", " ")}
                        </Badge>
                        {agent.enabled ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">Paused</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Trigger Info */}
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-600 mb-2">Trigger</p>
                  {agent.type === "entity_trigger" && (
                    <div className="text-sm text-slate-700">
                      <Code className="w-4 h-4 inline mr-1" />
                      When <strong>{agent.trigger.entity}</strong> is <strong>{agent.trigger.event}</strong>
                      {agent.trigger.conditions && (
                        <div className="text-xs text-slate-500 mt-1">
                          {JSON.stringify(agent.trigger.conditions)}
                        </div>
                      )}
                    </div>
                  )}
                  {agent.type === "scheduled" && (
                    <div className="text-sm text-slate-700">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Runs <strong>{agent.trigger.schedule}</strong> at <strong>{agent.trigger.time}</strong>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Actions ({agent.actions.length})</p>
                  <div className="space-y-1">
                    {agent.actions.map((action, idx) => (
                      <div key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </span>
                        <span>{action.type.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-sm border-t pt-4">
                  <div>
                    <p className="font-semibold text-slate-900">{agentStats.runs}</p>
                    <p className="text-xs text-slate-500">Runs</p>
                  </div>
                  <div>
                    <p className="font-semibold text-green-600">{agentStats.successes}</p>
                    <p className="text-xs text-slate-500">Success</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{agentStats.avgDuration}s</p>
                    <p className="text-xs text-slate-500">Avg Time</p>
                  </div>
                </div>

                {agentStats.lastRun && (
                  <p className="text-xs text-slate-500">
                    Last run: {new Date(agentStats.lastRun).toLocaleString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAgent(agent)}
                    className="gap-2 flex-1"
                  >
                    {agent.enabled ? (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingAgent(agent);
                      setBuilderOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAgent(agent)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {!error && agents.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No AI Agents Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first intelligent automation agent to streamline your recruitment workflows
            </p>
            <Button
              onClick={() => setBuilderOpen(true)}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Agent Builder Modal */}
      {builderOpen && (
        <AIAgentBuilder
          agent={editingAgent}
          onClose={() => {
            setBuilderOpen(false);
            setEditingAgent(null);
          }}
          onSave={saveAgent}
        />
      )}
    </div>
  );
}