import { useState, useEffect, useRef } from "react";
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
import { InvokeLLM } from "@/integrations/Core";
import { Candidate, Job, Company, Application, Submission, Task } from "@/entities/all";
import { User } from "@/entities/User";
import { addNotification } from "@/components/notifications/NotificationToast";
import ReactMarkdown from "react-markdown";

export default function Assistant({ currentPageName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [context, setContext] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [executingAction, setExecutingAction] = useState(null);
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
      // Determine if this is an action request or a query
      const isActionRequest = checkIfActionRequest(userMessage);

      if (isActionRequest) {
        // Execute action with confirmation
        const actionResult = await executeAIAction(userMessage, context);
        setMessages([...newMessages, { 
          role: "assistant", 
          content: actionResult.message,
          actions: actionResult.actions,
          data: actionResult.data
        }]);
      } else {
        // Regular Q&A with enhanced context
        const response = await InvokeLLM({
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
              },
              data_references: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entity: { type: "string" },
                    id: { type: "string" },
                    label: { type: "string" }
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
          suggested_actions: response.suggested_actions,
          data_references: response.data_references
        }]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages([...newMessages, {
        role: "assistant",
        content: "I apologize, but I encountered an error. Please try rephrasing your question or try again."
      }]);
    }
    setLoading(false);
  };

  const checkIfActionRequest = (message) => {
    const actionKeywords = [
      "create", "add", "update", "change", "modify", "delete", "remove",
      "find", "search", "show me", "list", "get me",
      "send email", "email", "notify",
      "assign", "schedule", "set",
      "calculate", "analyze and create", "generate report"
    ];
    return actionKeywords.some(keyword => message.toLowerCase().includes(keyword));
  };

  const executeAIAction = async (message, ctx) => {
    try {
      // Use AI to interpret the action and generate execution plan
      const actionPlan = await InvokeLLM({
        prompt: `You are an AI agent that can execute actions on a recruitment system.

**User Request:** ${message}

**Available Context:**
${JSON.stringify(ctx.stats, null, 2)}

**Available Actions:**
1. SEARCH - Search for candidates, jobs, companies (no write)
2. ANALYZE - Analyze data and provide insights (no write)
3. RECOMMEND - Recommend matches, candidates, etc (no write)
4. SUMMARIZE - Summarize data (no write)

**Your Task:**
Interpret the user's request and provide an analysis or recommendation. 
DO NOT suggest creating/updating/deleting data - just provide insights from existing data.

Return a helpful response based on the available data.`,
        response_json_schema: {
          type: "object",
          properties: {
            action_type: { 
              type: "string", 
              enum: ["search", "analyze", "recommend", "summarize", "not_supported"]
            },
            message: { type: "string" },
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                }
              }
            },
            next_steps: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["action_type", "message"]
        }
      });

      return {
        message: actionPlan.message,
        actions: actionPlan.insights,
        data: actionPlan.next_steps
      };
    } catch (error) {
      return {
        message: "I can help you analyze and find insights from your data. What specific information would you like to know?",
        actions: [],
        data: []
      };
    }
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
- Suggest relevant actions (but cannot execute writes)
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
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 z-50"
          size="icon"
        >
          <Sparkles className="w-6 h-6 text-white" />
        </Button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[420px] max-h-[650px] z-50 flex flex-col shadow-2xl rounded-xl overflow-hidden border border-slate-200 bg-white">
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