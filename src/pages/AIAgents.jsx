import { useState, useEffect } from "react";
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
import AIAgentBuilder from "@/components/agents/AIAgentBuilder";

export default function AIAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [stats, setStats] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalRuns: 0,
    successRate: 0
  });

  // Mock data for demonstration - in production, this would come from a backend API
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      // In a real implementation, these would be stored in a database
      const mockAgents = [
        {
          id: "job_matcher",
          name: "Auto Job Matcher",
          description: "Automatically matches candidates to new jobs using AI",
          type: "entity_trigger",
          trigger: {
            entity: "Job",
            event: "created",
            conditions: { status: "open" }
          },
          actions: [
            {
              type: "ai_analysis",
              model: "o1",
              prompt: "Analyze candidates for job match"
            },
            {
              type: "create_applications",
              threshold: 80
            }
          ],
          enabled: true,
          stats: {
            runs: 45,
            successes: 43,
            failures: 2,
            lastRun: new Date(Date.now() - 3600000).toISOString(),
            avgDuration: 12.5
          }
        },
        {
          id: "follow_up_reminder",
          name: "Follow-up Reminder Agent",
          description: "Automatically creates tasks for stale candidate applications",
          type: "scheduled",
          schedule: "0 9 * * *",
          trigger: {
            schedule: "daily",
            time: "09:00"
          },
          actions: [
            {
              type: "query_entities",
              entity: "Application",
              filter: { status: "interviewing" }
            },
            {
              type: "create_tasks",
              condition: "no_activity_7_days"
            }
          ],
          enabled: true,
          stats: {
            runs: 120,
            successes: 118,
            failures: 2,
            lastRun: new Date(Date.now() - 86400000).toISOString(),
            avgDuration: 3.2
          }
        },
        {
          id: "candidate_enrichment",
          name: "Candidate Profile Enrichment",
          description: "Enriches candidate profiles with AI-extracted insights from resumes",
          type: "entity_trigger",
          trigger: {
            entity: "Candidate",
            event: "created"
          },
          actions: [
            {
              type: "ai_analysis",
              model: "gpt-4o",
              prompt: "Extract skills, experience, and summary from candidate data"
            },
            {
              type: "update_entity",
              fields: ["skills", "experience_years", "summary"]
            }
          ],
          enabled: false,
          stats: {
            runs: 0,
            successes: 0,
            failures: 0,
            lastRun: null,
            avgDuration: 0
          }
        }
      ];

      setAgents(mockAgents);

      // Calculate stats
      const totalRuns = mockAgents.reduce((sum, a) => sum + a.stats.runs, 0);
      const totalSuccesses = mockAgents.reduce((sum, a) => sum + a.stats.successes, 0);
      
      setStats({
        totalAgents: mockAgents.length,
        activeAgents: mockAgents.filter(a => a.enabled).length,
        totalRuns,
        successRate: totalRuns > 0 ? Math.round((totalSuccesses / totalRuns) * 100) : 0
      });
    } catch (error) {
      console.error("Error loading agents:", error);
      addNotification({
        type: "error",
        title: "Load Failed",
        message: "Failed to load AI agents"
      });
    }
    setLoading(false);
  };

  const toggleAgent = async (agentId) => {
    try {
      setAgents(prev => prev.map(a => 
        a.id === agentId ? { ...a, enabled: !a.enabled } : a
      ));
      
      addNotification({
        type: "success",
        title: "Agent Updated",
        message: "Agent status changed successfully"
      });
    } catch (error) {
      console.error("Error toggling agent:", error);
      addNotification({
        type: "error",
        title: "Update Failed",
        message: "Failed to update agent status"
      });
    }
  };

  const deleteAgent = async (agentId) => {
    if (!confirm("Are you sure you want to delete this agent?")) return;
    
    try {
      setAgents(prev => prev.filter(a => a.id !== agentId));
      addNotification({
        type: "success",
        title: "Agent Deleted",
        message: "Agent deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting agent:", error);
      addNotification({
        type: "error",
        title: "Delete Failed",
        message: "Failed to delete agent"
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

      {/* Agents List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map(agent => {
          const Icon = getAgentIcon(agent.type);
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
                    <p className="font-semibold text-slate-900">{agent.stats.runs}</p>
                    <p className="text-xs text-slate-500">Runs</p>
                  </div>
                  <div>
                    <p className="font-semibold text-green-600">{agent.stats.successes}</p>
                    <p className="text-xs text-slate-500">Success</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{agent.stats.avgDuration}s</p>
                    <p className="text-xs text-slate-500">Avg Time</p>
                  </div>
                </div>

                {agent.stats.lastRun && (
                  <p className="text-xs text-slate-500">
                    Last run: {new Date(agent.stats.lastRun).toLocaleString()}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAgent(agent.id)}
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
                    onClick={() => deleteAgent(agent.id)}
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
      {agents.length === 0 && (
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
          onSave={(agent) => {
            if (editingAgent) {
              setAgents(prev => prev.map(a => a.id === agent.id ? agent : a));
            } else {
              setAgents(prev => [...prev, { ...agent, id: `agent_${Date.now()}` }]);
            }
            setBuilderOpen(false);
            setEditingAgent(null);
            addNotification({
              type: "success",
              title: "Agent Saved",
              message: "AI agent saved successfully"
            });
          }}
        />
      )}
    </div>
  );
}