import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  MessageSquare, 
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  FileText,
  Database,
  Zap,
  TrendingUp,
  Users,
  Briefcase,
  Plus,
  Play,
  Copy,
  Download
} from "lucide-react";
import { InvokeLLMJson } from "@/integrations/Core";
import { Candidate, Job, Company, Application, Submission, Task } from "@/entities/all";
import { User } from "@/entities/User";
import { addNotification } from "@/components/notifications/NotificationToast";
import ReactMarkdown from "react-markdown";
import { createPageUrl } from "@/utils";

export default function Assistant({ currentPageName }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [context, setContext] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !contextLoaded) {
      loadContext();
    }
  }, [isOpen, contextLoaded]);

  const loadContext = async () => {
    setLoading(true);
    try {
      const me = await User.me().catch(() => null);
      
      const [candidates, jobs, companies, applications, submissions, tasks] = await Promise.all([
        Candidate.list("-updated_date", 50).catch(() => []),
        Job.list("-updated_date", 50).catch(() => []),
        Company.list("-updated_date", 30).catch(() => []),
        Application.list("-updated_date", 50).catch(() => []),
        Submission.list("-updated_date", 50).catch(() => []),
        Task.list("-updated_date", 50).catch(() => [])
      ]);

      const ctx = {
        page: currentPageName,
        user: me,
        stats: {
          candidates: candidates.length,
          activeCandidates: candidates.filter(c => c.status === "active").length,
          jobs: jobs.length,
          openJobs: jobs.filter(j => j.status === "open").length,
          companies: companies.length,
          applications: applications.length,
          pendingApplications: applications.filter(a => a.status === "submitted").length,
          submissions: submissions.length,
          tasks: tasks.length,
          myTasks: me ? tasks.filter(t => t.assigned_to === me.email && t.status !== "completed").length : 0,
          overdueTasks: tasks.filter(t => {
            if (t.status === "completed") return false;
            if (!t.due_date) return false;
            return new Date(t.due_date) < new Date();
          }).length
        },
        recentCandidates: candidates.slice(0, 5).map(c => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
          status: c.status,
          skills: c.skills?.slice(0, 3)
        })),
        recentJobs: jobs.slice(0, 5).map(j => ({
          id: j.id,
          title: j.title,
          status: j.status,
          company_id: j.company_id
        })),
        urgentTasks: tasks.filter(t => t.priority === "urgent" && t.status !== "completed").slice(0, 3)
      };

      setContext(ctx);
      setContextLoaded(true);

      // Generate suggested actions based on context
      generateSuggestedActions(ctx);

      // Add welcome message
      setMessages([{
        role: "assistant",
        content: `👋 **AI Agent Ready**\n\nI have full access to your recruitment data and can help you with:\n\n✅ **Analysis & Insights** - Pipeline analytics, trend analysis\n✅ **Data Operations** - Create, update, search records\n✅ **Smart Recommendations** - Best candidates, matching jobs\n✅ **Task Automation** - Bulk operations, workflows\n✅ **Quick Actions** - Execute common tasks instantly\n\nYou have **${ctx.stats.openJobs} open jobs**, **${ctx.stats.activeCandidates} active candidates**, and **${ctx.stats.myTasks} pending tasks**.\n\nHow can I assist you today?`
      }]);
    } catch (error) {
      console.error("Error loading context:", error);
      setMessages([{
        role: "assistant",
        content: "I'm ready to help! What would you like to know?"
      }]);
    }
    setLoading(false);
  };

  const generateSuggestedActions = (ctx) => {
    const actions = [];

    if (ctx.stats.overdueTasks > 0) {
      actions.push({
        id: "overdue-tasks",
        icon: AlertCircle,
        label: `View ${ctx.stats.overdueTasks} Overdue Tasks`,
        color: "text-red-600",
        action: "Show me all overdue tasks with details"
      });
    }

    if (ctx.stats.openJobs > 0 && ctx.stats.activeCandidates > 0) {
      actions.push({
        id: "top-matches",
        icon: TrendingUp,
        label: "Find Top Candidate Matches",
        color: "text-blue-600",
        action: "Find the top 5 candidate matches across all open jobs"
      });
    }

    if (ctx.stats.pendingApplications > 0) {
      actions.push({
        id: "pending-review",
        icon: FileText,
        label: `Review ${ctx.stats.pendingApplications} Pending Applications`,
        color: "text-orange-600",
        action: "Show me all pending applications that need review"
      });
    }

    if (ctx.page === "Candidates") {
      actions.push({
        id: "candidate-insights",
        icon: Users,
        label: "Candidate Pipeline Analysis",
        color: "text-purple-600",
        action: "Analyze my candidate pipeline and give me insights on bottlenecks and recommendations"
      });
    }

    if (ctx.page === "Jobs") {
      actions.push({
        id: "job-filling",
        icon: Briefcase,
        label: "Hardest Jobs to Fill",
        color: "text-indigo-600",
        action: "Which jobs are taking longest to fill and why?"
      });
    }

    actions.push({
      id: "quick-summary",
      icon: Sparkles,
      label: "Daily Recruitment Summary",
      color: "text-green-600",
      action: "Give me a comprehensive daily summary of my recruitment pipeline"
    });

    setSuggestedActions(actions.slice(0, 6));
  };

  const executeAction = async (actionPrompt) => {
    setInput("");
    await sendMessage(actionPrompt);
  };

  const sendMessage = async (messageText = null) => {
    const userMessage = messageText || input.trim();
    if (!userMessage || loading) return;

    setInput("");
    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // First, classify the user's intent.
      const intent = await classifyIntent(userMessage, context);

      if (intent.type === "action") {
        // Stage a confirmation card; the user must approve before we write.
        setMessages([...newMessages, {
          role: "assistant",
          content: intent.summary,
          pendingAction: intent.action,
          actions: [{
            title: "Ready to execute",
            description: "Review the details above and click Confirm to proceed.",
            priority: "medium"
          }]
        }]);
      } else if (intent.type === "navigate") {
        navigate(intent.target);
        setMessages([...newMessages, {
          role: "assistant",
          content: `Navigating to **${intent.label}**...`
        }]);
      } else {
        // Regular Q&A with enhanced context
        const response = await InvokeLLMJson({
          task: "chat",
          prompt: buildEnhancedPrompt(userMessage, context, newMessages),
          response_json_schema: {
            type: "object",
            properties: {
              message: { type: "string" },
              suggested_actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    action: { type: "string" },
                    entity: { type: "string" }
                  }
                }
              }
            },
            required: ["message"]
          }
        });

        setMessages([...newMessages, {
          role: "assistant",
          content: response.message,
          suggested_actions: response.suggested_actions
        }]);
      }
    } catch (error) {
      console.error("Error:", error);
      const reason = error?.message ? String(error.message) : "";
      setMessages([...newMessages, {
        role: "assistant",
        content: reason
          ? `⚠️ I couldn't complete that request.\n\n\`\`\`\n${reason}\n\`\`\``
          : "I apologize, but I encountered an error. Please try rephrasing your question or try again."
      }]);
    }
    setLoading(false);
  };

  const classifyIntent = async (message, ctx) => {
    const schema = {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["query", "create_task", "create_candidate", "navigate", "not_supported"]
        },
        summary: { type: "string" },
        task_title: { type: "string" },
        task_description: { type: "string" },
        task_priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        task_due_date: { type: "string" },
        candidate_first_name: { type: "string" },
        candidate_last_name: { type: "string" },
        candidate_email: { type: "string" },
        candidate_phone: { type: "string" },
        candidate_current_title: { type: "string" },
        candidate_skills: { type: "array", items: { type: "string" } },
        navigate_target: { type: "string" },
        navigate_label: { type: "string" }
      },
      required: ["intent", "summary"]
    };

    const system = `You are an intent classifier for a recruiting assistant. Supported actions:
- create_task: user wants a new task created
- create_candidate: user wants to add a candidate from text they will paste or have pasted
- navigate: user wants to go to a page (Candidates, Jobs, Tasks, Companies, Submissions, Dashboard)
- query: anything else (analysis, search, questions)
- not_supported: destructive operations (delete, update, send email) or unclear requests

Today is ${new Date().toISOString().slice(0, 10)}. Infer reasonable defaults: task priority medium, due today if not specified.
Return a concise summary explaining what you understood.`;

    const parsed = await InvokeLLMJson({
      task: "classification",
      prompt: `User request: "${message}"\n\nCurrent page: ${ctx?.page || "Dashboard"}`,
      system,
      response_json_schema: schema
    });

    if (parsed.intent === "create_task") {
      return {
        type: "action",
        action: { kind: "create_task", data: parsed },
        summary: parsed.summary || `Create task: **${parsed.task_title || "(no title)"}**`
      };
    }
    if (parsed.intent === "create_candidate") {
      return {
        type: "action",
        action: { kind: "create_candidate", data: parsed },
        summary: parsed.summary || `Add candidate: **${parsed.candidate_first_name || ""} ${parsed.candidate_last_name || ""}**`.trim()
      };
    }
    if (parsed.intent === "navigate") {
      const target = resolveNavigation(parsed.navigate_target || message);
      return { type: "navigate", target: target.url, label: target.label };
    }
    return { type: "query" };
  };

  const resolveNavigation = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("candidate")) return { url: createPageUrl("Candidates"), label: "Candidates" };
    if (lower.includes("job")) return { url: createPageUrl("Jobs"), label: "Jobs" };
    if (lower.includes("company") || lower.includes("connection")) return { url: createPageUrl("Companies"), label: "Connections" };
    if (lower.includes("task")) return { url: createPageUrl("Tasks"), label: "Tasks" };
    if (lower.includes("submission") || lower.includes("application")) return { url: createPageUrl("Submissions"), label: "Applications" };
    return { url: createPageUrl("Dashboard"), label: "Dashboard" };
  };

  const confirmAction = async (message, action) => {
    setLoading(true);
    try {
      if (action.kind === "create_task") {
        const data = action.data;
        const task = await Task.create({
          title: data.task_title || "New task",
          description: data.task_description || "",
          priority: data.task_priority || "medium",
          status: "pending",
          due_date: data.task_due_date || new Date().toISOString().slice(0, 10),
          assigned_to: context?.user?.email || ""
        });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Created task **${task.title}**. [View Tasks](${createPageUrl("Tasks")})`
        }]);
        addNotification({ type: "success", title: "Task created", message: task.title });
      } else if (action.kind === "create_candidate") {
        const data = action.data;
        if (!data.candidate_email) {
          throw new Error("I need at least an email address to create a candidate.");
        }
        const candidate = await Candidate.create({
          first_name: data.candidate_first_name || "",
          last_name: data.candidate_last_name || "",
          email: data.candidate_email,
          phone: data.candidate_phone || "",
          current_title: data.candidate_current_title || "",
          skills: Array.isArray(data.candidate_skills) ? data.candidate_skills : []
        });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `✅ Added candidate **${candidate.first_name || ""} ${candidate.last_name || ""}** (${candidate.email}). [View Candidates](${createPageUrl("Candidates")})`
        }]);
        addNotification({ type: "success", title: "Candidate added", message: candidate.email });
      }
    } catch (error) {
      console.error("Action execution failed:", error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ Could not complete the action:\n\n\`\`\`\n${error.message}\n\`\`\``
      }]);
    }
    setPendingAction(null);
    setLoading(false);
  };

  const cancelAction = () => {
    setPendingAction(null);
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "Action cancelled. What else can I help you with?"
    }]);
  };

  const buildEnhancedPrompt = (userMessage, ctx, conversationHistory) => {
    const recentHistory = conversationHistory.slice(-5).map(m => 
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join("\n");

    return `You are an intelligent AI agent for a recruitment system with deep knowledge of the data.

**Current Context:**
- Page: ${ctx?.page || "Dashboard"}
- User: ${ctx?.user?.full_name || "User"}
- Stats: ${JSON.stringify(ctx?.stats || {}, null, 2)}
- Recent Data: ${JSON.stringify({
  candidates: ctx?.recentCandidates || [],
  jobs: ctx?.recentJobs || [],
  urgentTasks: ctx?.urgentTasks || []
}, null, 2)}

**Recent Conversation:**
${recentHistory}

**Current User Question:**
${userMessage}

**Your Capabilities:**
- Provide detailed analysis and insights
- Search and reference specific records
- Suggest relevant actions
- Give recommendations based on data
- Answer questions about the recruitment pipeline

**Instructions:**
1. Be specific and reference actual data when possible
2. Provide actionable insights
3. Suggest follow-up actions when relevant
4. Use markdown formatting for clarity
5. Be conversational but professional

Respond to the user's question with helpful, data-driven insights.`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addNotification({ type: "success", title: "Copied", message: "Message copied to clipboard" });
  };

  return (
    <>
      {/* Floating Button. The max-md: offsets lift it above the phone tab bar
          (52px + safe area), which is fixed to the corner it used to occupy. */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 max-md:bottom-[calc(64px+env(safe-area-inset-bottom,0px))] right-6 max-md:right-4 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 z-50"
          size="icon"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </Button>
      )}

      {/* Chat Panel. 420px is wider than a phone, so below md it goes
          edge-to-edge and sits above the tab bar rather than overhanging. */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] max-h-[650px] max-md:inset-x-2 max-md:right-2 max-md:w-auto max-md:bottom-[calc(60px+env(safe-area-inset-bottom,0px))] max-md:max-h-[70vh] z-50 flex flex-col shadow-2xl rounded-xl overflow-hidden border border-slate-200 bg-white">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Sparkles className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold">AI Agent</h3>
                <p className="text-xs opacity-90">Powered by Advanced AI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Suggested Actions */}
          {suggestedActions.length > 0 && messages.length <= 1 && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-b">
              <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                Quick Actions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    onClick={() => executeAction(action.action)}
                    className="text-xs h-auto py-1.5 px-2 bg-white hover:bg-slate-50"
                  >
                    <action.icon className={`w-3 h-3 mr-1 ${action.color}`} />
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${message.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-slate-200"} rounded-lg p-3 shadow-sm`}>
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-2 text-blue-600">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-medium">AI Agent</span>
                    </div>
                  )}
                  
                  <ReactMarkdown 
                    className={`text-sm prose prose-sm max-w-none ${message.role === "user" ? "text-white" : "text-slate-700"}`}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ inline, children }) => 
                        inline ? 
                          <code className="px-1 py-0.5 bg-slate-100 rounded text-xs">{children}</code> :
                          <code className="block p-2 bg-slate-100 rounded text-xs my-2">{children}</code>
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>

                  {/* Action Insights */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {message.actions.map((action, i) => (
                        <div key={i} className="p-2 bg-slate-50 rounded border-l-2 border-blue-500">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-slate-900">{action.title}</p>
                              <p className="text-xs text-slate-600">{action.description}</p>
                            </div>
                            {action.priority && (
                              <Badge className={
                                action.priority === "high" ? "bg-red-100 text-red-800" :
                                action.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                                "bg-blue-100 text-blue-800"
                              }>
                                {action.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending action confirmation */}
                  {message.pendingAction && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => confirmAction(message, message.pendingAction)}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelAction}
                        disabled={loading}
                        className="text-xs h-8"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {/* Copy Button */}
                  {message.role === "assistant" && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(message.content)}
                        className="h-6 text-xs text-slate-500 hover:text-slate-700"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask me anything about your recruitment data..."
                className="min-h-[44px] max-h-[120px] resize-none text-sm"
                disabled={loading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 h-[44px] px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}