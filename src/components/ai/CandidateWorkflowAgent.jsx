import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Application } from "@/entities/Application";
import { Candidate } from "@/entities/Candidate";
import { Submission } from "@/entities/Submission";
import { Task } from "@/entities/Task";
import { User } from "@/entities/User";
import * as Core from "@/integrations/Core";
import { 
  Sparkles, 
  Loader2, 
  Bell, 
  Calendar, 
  CheckCircle, 
  Clock,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Mail,
  Phone,
  MessageSquare,
  Play,
  Pause
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function CandidateWorkflowAgent() {
  const [running, setRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState({
    candidates_analyzed: 0,
    actions_identified: 0,
    follow_ups_needed: 0,
    status_updates: 0
  });

  const analyzeWorkflows = async () => {
    setAnalyzing(true);
    try {
      // Load candidates and applications
      const [candidates, applications, tasks, submissions] = await Promise.all([
        Candidate.list("-updated_date", 500),
        Application.list("-updated_date", 500),
        Task.list("-created_date", 500),
        Submission.list("-updated_date", 500)
      ]);

      const candidateContext = candidates.slice(0, 100).map(c => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        phone: c.phone,
        status: c.status,
        current_title: c.current_title,
        updated_date: c.updated_date,
        created_date: c.created_date,
        notes: c.notes,
        last_contact: c.last_contact_date
      }));

      const applicationsContext = applications.map(a => ({
        id: a.id,
        candidate_id: a.candidate_id,
        job_id: a.job_id,
        status: a.status,
        stage_updated_date: a.stage_updated_date,
        interview_dates: a.interview_dates,
        submitted_by: a.submitted_by
      }));

      const tasksContext = tasks.filter(t => t.related_entity === "candidate").map(t => ({
        id: t.id,
        related_id: t.related_id,
        status: t.status,
        due_date: t.due_date,
        assigned_to: t.assigned_to,
        title: t.title
      }));

      const prompt = `You are an expert AI workflow automation agent for recruitment operations.

**YOUR MISSION:**
Analyze candidate pipelines and proactively identify actions needed to maintain momentum and improve candidate experience.

**CURRENT STATE:**
- ${candidateContext.length} active candidates
- ${applicationsContext.length} applications in pipeline
- ${tasksContext.length} open tasks

**CANDIDATE DATA:**
${JSON.stringify(candidateContext.slice(0, 50), null, 2)}

**APPLICATION DATA:**
${JSON.stringify(applicationsContext.slice(0, 50), null, 2)}

**TASK DATA:**
${JSON.stringify(tasksContext.slice(0, 50), null, 2)}

**WORKFLOW ANALYSIS FRAMEWORK:**

**1. STATUS UPDATE TRIGGERS:**
Identify candidates whose status should be automatically updated based on:
- Time in current status (stale pipeline stages)
- Application progress (screening → interviewing → offer)
- Interview completion without status change
- Submission status changes

**2. FOLLOW-UP IDENTIFICATION:**
Find candidates needing engagement:
- No contact in 7+ days (active status)
- No contact in 14+ days (any status)
- Interview scheduled but no follow-up
- Application submitted, no response in 3+ days
- Offer extended, no response in 2+ days

**3. NEXT STEP SCHEDULING:**
Recommend next actions:
- Schedule initial screening call (for new active candidates)
- Schedule technical interview (after screening)
- Schedule final interview (after technical)
- Schedule offer discussion (after final)
- Schedule follow-up call (for pending responses)

**4. CRITICAL ALERTS:**
Flag urgent items:
- Offers pending response >48 hours
- Interviews scheduled within 24 hours without confirmation
- High-priority candidates with no activity >7 days
- Applications stuck in same stage >14 days
- Tasks overdue or due within 24 hours

**OUTPUT FORMAT:**
{
  "workflows": [
    {
      "workflow_id": "wf_1",
      "candidate_id": "cand_id",
      "candidate_name": "John Doe",
      "workflow_type": "status_update|follow_up|schedule_next|alert",
      "priority": "critical|high|medium|low",
      "current_status": "active",
      "recommended_status": "screening",
      "action_title": "Update status to screening",
      "action_description": "Candidate applied 5 days ago, move to screening",
      "rationale": "Application received, no activity for 5 days",
      "days_since_last_action": 5,
      "suggested_next_steps": [
        "Schedule screening call",
        "Send initial email"
      ],
      "time_sensitivity": "Complete within 24 hours",
      "auto_executable": true
    }
  ],
  "actions": [
    {
      "action_id": "act_1",
      "candidate_id": "cand_id",
      "candidate_name": "Jane Smith",
      "action_type": "send_email|schedule_call|create_task|send_sms",
      "priority": "critical|high|medium|low",
      "action_title": "Schedule screening call",
      "action_details": "Candidate has been active for 3 days without contact",
      "recommended_time": "Next 2 business days",
      "template_suggestion": "Initial screening email template",
      "requires_recruiter_approval": false
    }
  ],
  "stats": {
    "candidates_analyzed": 100,
    "actions_identified": 25,
    "follow_ups_needed": 12,
    "status_updates_recommended": 8,
    "critical_alerts": 3
  },
  "insights": {
    "avg_time_to_contact": "4.5 days",
    "candidates_stale": 15,
    "pipeline_velocity": "Slow - 18% of candidates inactive >7 days"
  }
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            workflows: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  workflow_id: { type: "string" },
                  candidate_id: { type: "string" },
                  candidate_name: { type: "string" },
                  workflow_type: { type: "string" },
                  priority: { type: "string" },
                  current_status: { type: "string" },
                  recommended_status: { type: "string" },
                  action_title: { type: "string" },
                  action_description: { type: "string" },
                  rationale: { type: "string" },
                  days_since_last_action: { type: "number" },
                  suggested_next_steps: { type: "array", items: { type: "string" } },
                  time_sensitivity: { type: "string" },
                  auto_executable: { type: "boolean" }
                }
              }
            },
            actions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  action_id: { type: "string" },
                  candidate_id: { type: "string" },
                  candidate_name: { type: "string" },
                  action_type: { type: "string" },
                  priority: { type: "string" },
                  action_title: { type: "string" },
                  action_details: { type: "string" },
                  recommended_time: { type: "string" },
                  template_suggestion: { type: "string" },
                  requires_recruiter_approval: { type: "boolean" }
                }
              }
            },
            stats: {
              type: "object",
              properties: {
                candidates_analyzed: { type: "number" },
                actions_identified: { type: "number" },
                follow_ups_needed: { type: "number" },
                status_updates_recommended: { type: "number" },
                critical_alerts: { type: "number" }
              }
            },
            insights: {
              type: "object",
              additionalProperties: true
            }
          }
        }
      });

      setWorkflows(response.workflows || []);
      setActions(response.actions || []);
      setStats(response.stats || {});

      addNotification({
        type: "success",
        title: "Workflow Analysis Complete",
        message: `Analyzed ${response.stats?.candidates_analyzed || 0} candidates, found ${response.stats?.actions_identified || 0} action items`
      });

    } catch (error) {
      console.error("Error analyzing workflows:", error);
      addNotification({
        type: "error",
        title: "Analysis Failed",
        message: "Failed to analyze candidate workflows"
      });
    }
    setAnalyzing(false);
  };

  const executeWorkflow = async (workflow) => {
    try {
      if (workflow.workflow_type === "status_update" && workflow.recommended_status) {
        await Candidate.update(workflow.candidate_id, {
          status: workflow.recommended_status,
          notes: `${workflow.rationale} - Auto-updated by AI Workflow Agent`
        });

        addNotification({
          type: "success",
          title: "Status Updated",
          message: `${workflow.candidate_name} status updated to ${workflow.recommended_status}`
        });

        // Remove from workflows
        setWorkflows(prev => prev.filter(w => w.workflow_id !== workflow.workflow_id));
      }
    } catch (error) {
      console.error("Error executing workflow:", error);
      addNotification({
        type: "error",
        title: "Execution Failed",
        message: "Failed to execute workflow action"
      });
    }
  };

  const executeAction = async (action) => {
    try {
      if (action.action_type === "create_task") {
        await Task.create({
          title: action.action_title,
          description: action.action_details,
          related_entity: "candidate",
          related_id: action.candidate_id,
          priority: action.priority === "critical" ? "urgent" : action.priority,
          status: "pending",
          assigned_to: await getCurrentUser()
        });

        addNotification({
          type: "success",
          title: "Task Created",
          message: `Task created for ${action.candidate_name}`
        });

        setActions(prev => prev.filter(a => a.action_id !== action.action_id));
      }
    } catch (error) {
      console.error("Error executing action:", error);
      addNotification({
        type: "error",
        title: "Execution Failed",
        message: "Failed to execute action"
      });
    }
  };

  const getCurrentUser = async () => {
    try {
      const user = await User.me();
      return user?.email || "";
    } catch {
      return "";
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === "critical") return "bg-red-100 text-red-800 border-red-300";
    if (priority === "high") return "bg-orange-100 text-orange-800 border-orange-300";
    if (priority === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const getWorkflowIcon = (type) => {
    if (type === "status_update") return TrendingUp;
    if (type === "follow_up") return UserCheck;
    if (type === "schedule_next") return Calendar;
    if (type === "alert") return Bell;
    return CheckCircle;
  };

  const getActionIcon = (type) => {
    if (type === "send_email") return Mail;
    if (type === "schedule_call") return Phone;
    if (type === "create_task") return CheckCircle;
    if (type === "send_sms") return MessageSquare;
    return Bell;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                AI Candidate Workflow Agent
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Automated workflow management and proactive candidate engagement
              </p>
            </div>
            <Button
              onClick={analyzeWorkflows}
              disabled={analyzing}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {stats.candidates_analyzed > 0 && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-xs text-slate-500">Candidates Analyzed</p>
                <p className="text-2xl font-bold text-slate-900">{stats.candidates_analyzed}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-xs text-slate-500">Actions Identified</p>
                <p className="text-2xl font-bold text-blue-600">{stats.actions_identified}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-xs text-slate-500">Follow-ups Needed</p>
                <p className="text-2xl font-bold text-orange-600">{stats.follow_ups_needed}</p>
              </div>
              <div className="p-3 bg-white rounded-lg border">
                <p className="text-xs text-slate-500">Status Updates</p>
                <p className="text-2xl font-bold text-green-600">{stats.status_updates}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Workflows */}
      {workflows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Recommended Workflow Actions ({workflows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {workflows.map((workflow) => {
                const Icon = getWorkflowIcon(workflow.workflow_type);
                return (
                  <div
                    key={workflow.workflow_id}
                    className="p-4 border-2 rounded-lg hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">{workflow.action_title}</h4>
                            <Badge className={getPriorityColor(workflow.priority)}>
                              {workflow.priority}
                            </Badge>
                            {workflow.auto_executable && (
                              <Badge className="bg-green-100 text-green-800">
                                Auto-executable
                              </Badge>
                            )}
                          </div>
                          <Link
                            to={createPageUrl(`CandidateDetails?id=${workflow.candidate_id}`)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {workflow.candidate_name}
                          </Link>
                          <p className="text-sm text-slate-700 mt-2">{workflow.action_description}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            <strong>Rationale:</strong> {workflow.rationale}
                          </p>
                          {workflow.days_since_last_action && (
                            <div className="flex items-center gap-1 mt-2">
                              <Clock className="w-3 h-3 text-orange-600" />
                              <span className="text-xs text-orange-700">
                                {workflow.days_since_last_action} days since last action
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {workflow.auto_executable && (
                        <Button
                          size="sm"
                          onClick={() => executeWorkflow(workflow)}
                          className="gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Execute
                        </Button>
                      )}
                    </div>

                    {workflow.suggested_next_steps?.length > 0 && (
                      <div className="pt-3 border-t">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Suggested Next Steps:</p>
                        <ul className="space-y-1">
                          {workflow.suggested_next_steps.map((step, i) => (
                            <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                              <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {workflow.time_sensitivity && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-700" />
                          <span className="text-xs text-yellow-800 font-medium">
                            {workflow.time_sensitivity}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Recommended Actions ({actions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actions.map((action) => {
                const Icon = getActionIcon(action.action_type);
                return (
                  <div
                    key={action.action_id}
                    className="p-4 border-2 rounded-lg hover:border-orange-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">{action.action_title}</h4>
                            <Badge className={getPriorityColor(action.priority)}>
                              {action.priority}
                            </Badge>
                          </div>
                          <Link
                            to={createPageUrl(`CandidateDetails?id=${action.candidate_id}`)}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {action.candidate_name}
                          </Link>
                          <p className="text-sm text-slate-700 mt-2">{action.action_details}</p>
                          {action.recommended_time && (
                            <p className="text-xs text-slate-500 mt-1">
                              <strong>Timing:</strong> {action.recommended_time}
                            </p>
                          )}
                          {action.template_suggestion && (
                            <p className="text-xs text-blue-600 mt-1">
                              💡 Suggested template: {action.template_suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => executeAction(action)}
                        className="gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Execute
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!analyzing && workflows.length === 0 && actions.length === 0 && stats.candidates_analyzed === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              AI Workflow Agent Ready
            </h3>
            <p className="text-slate-600 mb-6">
              Click "Run Analysis" to analyze candidate pipelines and get automated workflow recommendations
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto text-sm text-left">
              <div className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Auto status updates</span>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Follow-up detection</span>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Next step scheduling</span>
              </div>
              <div className="flex items-start gap-2">
                <Bell className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">Critical alerts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}