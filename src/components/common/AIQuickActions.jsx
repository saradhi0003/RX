
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Loader2, Sparkles, Plus, Search, Calendar, Mail, Phone, Briefcase, Users, Building2, ClipboardList, Zap, Clock, Upload, FileText } from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import { Company } from "@/entities/Company";
import { Job } from "@/entities/Job";
import { LeaveRequest } from "@/entities/LeaveRequest";
import { Task } from "@/entities/Task";
import { Timesheet } from "@/entities/Timesheet";
import { User } from "@/entities/User";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTED_ACTIONS = [
  { id: "add_candidate", label: "Add Candidate", icon: Users, color: "blue" },
  { id: "add_job", label: "Add Job", icon: Briefcase, color: "purple" },
  { id: "add_company", label: "Add Connection", icon: Building2, color: "green" },
  { id: "log_time", label: "Log Time", icon: Clock, color: "orange" },
  { id: "apply_leave", label: "Apply for Leave", icon: Calendar, color: "pink" },
  { id: "create_task", label: "Create Task", icon: ClipboardList, color: "orange" },
  { id: "search", label: "Search", icon: Search, color: "slate" },
  { id: "paste_candidate", label: "Paste to Add Candidate", icon: Sparkles, color: "pink" },
  { id: "upload_resumes", label: "Upload Resumes (Word/PDF)", icon: Upload, color: "indigo" },
];

export default function AIQuickActions({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, uploadingFiles]); // Added uploadingFiles to dependencies to scroll on progress updates

  useEffect(() => {
    if (open && messages.length === 0) {
      // Welcome message
      setMessages([{
        id: Date.now(),
        role: "assistant",
        content: "👋 **Hi! I'm your AI Assistant.**\n\nI can help you:\n- Add candidates, jobs, or companies\n- Create tasks and schedule activities\n- Log time and apply for leave\n- Search across your data\n- Parse and add candidates from pasted text\n- Upload resumes for automatic candidate creation\n\nWhat would you like to do today?"
      }]);
      setShowQuickActions(true);
    }
  }, [open, messages.length]);

  const handleSuggestedAction = (actionId) => {
    const actionMap = {
      add_candidate: "Add a new candidate",
      add_job: "Add a new job",
      add_company: "Add a new connection (company)",
      log_time: "Log time for my work today",
      apply_leave: "Apply for leave",
      create_task: "Create a new task",
      search: "Search for candidates",
      paste_candidate: "I want to paste candidate information to add them",
      upload_resumes: "upload_resumes_trigger" // Special trigger
    };

    const message = actionMap[actionId];
    if (message === "upload_resumes_trigger") {
      // Trigger file upload dialog
      fileInputRef.current?.click();
    } else if (message) {
      setInput(message);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear selected files if dialog was cancelled
      }
      return;
    }

    setUploadingFiles(true);
    setShowQuickActions(false);
    setUploadProgress({ current: 0, total: files.length });

    // Add system message
    const systemMessage = {
      id: Date.now(),
      role: "assistant",
      content: `📄 **Processing ${files.length} resume file(s)...**\n\nI'll extract candidate information and check for duplicates before creating records.\n\n⚠️ Note: Only PDF files support AI extraction. Word documents will be uploaded but marked for manual entry.`
    };
    setMessages(prev => [...prev, systemMessage]);

    const results = {
      successful: [],
      updated: [],
      skipped: [],
      failed: []
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      try {
        // Upload file
        const { file_url } = await Core.UploadFile({ file });

        // Check file extension
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        
        // CRITICAL: Only PDFs support AI extraction.
        // Word documents (.doc, .docx), image files, and other types are NOT supported by ExtractDataFromUploadedFile for resume parsing.
        if (ext !== 'pdf') {
          results.skipped.push({
            file: file.name,
            reason: `${ext.toUpperCase()} files cannot be auto-parsed. Resume uploaded - please add candidate manually.`,
            resume_url: file_url
          });
          continue;
        }

        // Try AI extraction for PDFs only
        let parsedData;
        
        try {
          const parseResult = await Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                location: { type: "string" },
                current_title: { type: "string" },
                current_company: { type: "string" },
                experience_years: { type: "number" },
                skills: { type: "array", items: { type: "string" } },
                work_authorization: { type: "string" }
              }
            }
          });

          if (parseResult?.status === "success" && parseResult.output) {
            parsedData = Array.isArray(parseResult.output)
              ? parseResult.output[0]
              : parseResult.output;
          }
        } catch (parseError) {
          console.error(`Parse error for ${file.name}:`, parseError);
          results.failed.push({ 
            file: file.name, 
            reason: "AI extraction failed" 
          });
          continue;
        }

        if (!parsedData || !parsedData.email) {
          results.failed.push({ 
            file: file.name, 
            reason: "Could not extract email from resume" 
          });
          continue;
        }

        // Check for duplicate by email
        const existing = await Candidate.filter({ 
          email: parsedData.email.trim().toLowerCase() 
        });

        if (existing && existing.length > 0) {
          const duplicate = existing[0];
          // Update existing candidate with new resume
          await Candidate.update(duplicate.id, {
            resume_url: file_url,
            // Only update fields if they're missing in existing record
            ...(!duplicate.phone && parsedData.phone && { phone: parsedData.phone }),
            ...(!duplicate.location && parsedData.location && { location: parsedData.location }),
            ...(!duplicate.current_title && parsedData.current_title && { current_title: parsedData.current_title }),
            ...(!duplicate.current_company && parsedData.current_company && { current_company: parsedData.current_company }),
            notes: `${duplicate.notes || ""}\n\nResume updated from ${file.name} on ${new Date().toLocaleDateString()}`.trim()
          });
          
          results.updated.push({
            file: file.name,
            candidate: `${duplicate.first_name} ${duplicate.last_name}`,
            action: "Updated existing candidate with new resume"
          });
        } else {
          // Create new candidate
          const candidateData = {
            ...parsedData,
            resume_url: file_url,
            status: "active",
            source: "AI Resume Upload",
            notes: `Uploaded from file: ${file.name}`
          };

          const candidate = await Candidate.create(candidateData);
          results.successful.push({
            file: file.name,
            candidate: `${candidate.first_name} ${candidate.last_name}`
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        results.failed.push({ file: file.name, reason: error.message || "Upload failed" });
      }
    }

    // Summary message
    let summaryContent = `✅ **Upload Complete!**\n\n`;
    
    if (results.successful.length > 0) {
      summaryContent += `**Created ${results.successful.length} new candidate(s):**\n`;
      results.successful.forEach(r => {
        summaryContent += `- ${r.candidate} (from ${r.file})\n`;
      });
      summaryContent += `\n`;
    }
    
    if (results.updated.length > 0) {
      summaryContent += `**Updated ${results.updated.length} existing candidate(s):**\n`;
      results.updated.forEach(r => {
        summaryContent += `- ${r.candidate} (resume from ${r.file})\n`;
      });
      summaryContent += `\n`;
    }

    if (results.skipped.length > 0) {
      summaryContent += `⚠️ **Skipped ${results.skipped.length} file(s) (non-PDF documents):**\n`;
      results.skipped.forEach(r => {
        summaryContent += `- ${r.file}: ${r.reason}\n`;
      });
      summaryContent += `\n💡 **Tip:** Convert these documents to PDF for AI auto-extraction.\n\n`;
    }

    if (results.failed.length > 0) {
      summaryContent += `❌ **Failed to process ${results.failed.length} file(s):**\n`;
      results.failed.forEach(r => {
        summaryContent += `- ${r.file}: ${r.reason}\n`;
      });
    }

    const summaryMessage = {
      id: Date.now() + 1,
      role: "assistant",
      content: summaryContent
    };
    setMessages(prev => [...prev, summaryMessage]);

    // Trigger refresh
    if (results.successful.length > 0 || results.updated.length > 0) {
      window.dispatchEvent(new CustomEvent("entity:Candidate:changed"));
      addNotification({
        type: results.skipped.length > 0 ? "warning" : "success",
        title: "Upload Complete",
        message: `${results.successful.length} created, ${results.updated.length} updated${results.skipped.length > 0 ? `, ${results.skipped.length} require manual entry` : ''}`
      });
    } else if (results.skipped.length > 0) {
      addNotification({
        type: "warning",
        title: "Resumes Uploaded",
        message: `${results.skipped.length} non-PDF document(s) uploaded. Convert to PDF for auto-extraction.`
      });
    }

    setUploadingFiles(false);
    setShowQuickActions(true);
    setUploadProgress({ current: 0, total: 0 });

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const executeAction = async (action, data) => {
    try {
      switch (action.type) {
        case "navigate":
          onClose();
          navigate(createPageUrl(action.page));
          if (action.triggerAction) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('quickAction', {
                detail: { action: action.triggerAction, data: action.data }
              }));
            }, 100);
          }
          break;

        case "create_candidate": {
          // Check for duplicate by email before creating
          if (data.email) {
            const existing = await Candidate.filter({ 
              email: data.email.trim().toLowerCase() 
            });
            
            if (existing && existing.length > 0) {
              const duplicate = existing[0];
              addNotification({
                type: "warning",
                title: "Duplicate Found",
                message: `Candidate ${duplicate.first_name} ${duplicate.last_name} with email ${data.email} already exists.`
              });
              setShowQuickActions(true);
              break;
            }
          }
          
          const candidate = await Candidate.create(data);
          addNotification({
            type: "success",
            title: "Candidate Added",
            message: `${candidate.first_name} ${candidate.last_name} has been added successfully`
          });
          window.dispatchEvent(new CustomEvent("entity:Candidate:changed"));
          setShowQuickActions(true);
          break;
        }

        case "create_job": {
          const job = await Job.create(data);
          addNotification({
            type: "success",
            title: "Job Posted",
            message: `${job.title} has been posted successfully`
          });
          window.dispatchEvent(new CustomEvent("entity:Job:changed"));
          setShowQuickActions(true);
          break;
        }

        case "create_company": {
          const company = await Company.create(data);
          addNotification({
            type: "success",
            title: "Connection Added",
            message: `${company.name} has been added successfully`
          });
          window.dispatchEvent(new CustomEvent("entity:Company:changed"));
          setShowQuickActions(true);
          break;
        }

        case "create_task": {
          const task = await Task.create(data);
          addNotification({
            type: "success",
            title: "Task Created",
            message: `Task "${task.title}" has been created`
          });
          window.dispatchEvent(new CustomEvent("entity:Task:changed"));
          setShowQuickActions(true);
          break;
        }

        case "create_timesheet": {
          const timesheet = await Timesheet.create(data);
          addNotification({
            type: "success",
            title: "Time Logged",
            message: `${data.hours} hours logged for ${new Date(data.date).toLocaleDateString()}`
          });
          window.dispatchEvent(new CustomEvent("entity:Timesheet:changed"));
          setShowQuickActions(true);
          break;
        }

        case "create_leave_request": {
          const leave = await LeaveRequest.create(data);
          addNotification({
            type: "success",
            title: "Leave Request Submitted",
            message: `Leave request from ${new Date(data.start_date).toLocaleDateString()} to ${new Date(data.end_date).toLocaleDateString()} has been submitted`
          });
          window.dispatchEvent(new CustomEvent("entity:LeaveRequest:changed"));
          setShowQuickActions(true);
          break;
        }

        case "search":
          onClose();
          window.dispatchEvent(new CustomEvent('openCommandPalette'));
          setShowQuickActions(true);
          break;

        default:
          console.warn("Unknown action type:", action.type);
      }
    } catch (error) {
      console.error("Error executing action:", error);
      addNotification({
        type: "error",
        title: "Action Failed",
        message: error.message || "Could not complete the action"
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || processing) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setProcessing(true);
    setShowQuickActions(false); // Hide quick actions while processing

    try {
      // Get current user context
      const user = await User.me().catch(() => null);

      // Use AI to understand the intent and generate response
      const response = await Core.InvokeLLM({
        prompt: `You are an AI assistant for a recruitment platform called Recruiter X. You help recruiters and hiring managers manage candidates, jobs, companies, tasks, timesheets, leave requests, and recruitment workflows.

Current User: ${user?.full_name || "User"} (${user?.email || "unknown"})
Current Date: ${new Date().toISOString().split('T')[0]}

User Request: "${input}"

Your job is to:
1. Understand what the user wants to do
2. If it's an actionable request (add candidate, create job, log time, apply for leave, etc.), provide the necessary data structure
3. If it's a question, provide a helpful answer
4. Be conversational, friendly, and efficient

For actionable requests, return a JSON with:
{
  "message": "Conversational response to the user",
  "action": {
    "type": "navigate" | "create_candidate" | "create_job" | "create_company" | "create_task" | "create_timesheet" | "create_leave_request" | "search" | "none",
    "page": "Candidates" | "Jobs" | "Companies" | "Tasks" | "MyWork" (for navigate),
    "triggerAction": "add" | "paste" (optional, for special actions),
    "data": { ... entity data if creating ... }
  }
}

Examples:
- "Add a candidate named John Doe" → type: "navigate", page: "Candidates", triggerAction: "add"
- "Create a job for Senior Developer" → type: "navigate", page: "Jobs", triggerAction: "add"
- "Add a company called TechCorp" / "Add connection TechCorp" → type: "create_company", data: {name: "TechCorp", type: "client", status: "prospect"}
- "Log 8 hours for today" → type: "create_timesheet", data: {user_id: user.email, date: "${new Date().toISOString().split('T')[0]}", hours: 8, status: "draft"}
- "Apply for leave from Dec 20 to Dec 24" → type: "create_leave_request", data: {user_id: user.email, type: "vacation", start_date: "2024-12-20", end_date: "2024-12-24", reason: "Holiday vacation"}
- "I want to paste candidate info: John Doe, Software Engineer..." → type: "create_candidate", data: {parsed fields}
- "Search for candidates" → type: "search"
- "How do I add a new job?" → type: "none", message: "explanatory response"

Important data structure rules:
- Timesheet: {user_id: user.email (REQUIRED), date: "YYYY-MM-DD" (REQUIRED), hours: number (REQUIRED), job_id: string (optional), notes: string (optional), status: "draft"}
- LeaveRequest: {user_id: user.email (REQUIRED), type: "vacation"|"sick"|"personal"|"unpaid"|"other" (REQUIRED), start_date: "YYYY-MM-DD" (REQUIRED), end_date: "YYYY-MM-DD" (REQUIRED), reason: string (optional), status: "pending"}
- Company: {name: string (REQUIRED), type: "client"|"internal", status: "active"|"prospect"|"inactive", industry: string, website: string, location: string}
- Task: {title: string (REQUIRED), assigned_to: user.email (REQUIRED), description: string, priority: "low"|"medium"|"high"|"urgent", status: "pending", due_date: "YYYY-MM-DD"}

If the user is pasting candidate information (resume, bio, profile), extract:
- first_name, last_name, email, phone, location
- current_title, current_company, experience_years
- skills (array), work_authorization
- notes (original pasted text)`,
        response_json_schema: {
          type: "object",
          properties: {
            message: { type: "string" },
            action: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["navigate", "create_candidate", "create_job", "create_company", "create_task", "create_timesheet", "create_leave_request", "search", "none"]
                },
                page: { type: "string" },
                triggerAction: { type: "string" },
                data: { type: "object", additionalProperties: true }
              },
              required: ["type"]
            }
          },
          required: ["message", "action"]
        }
      });

      // Add AI response to messages
      const aiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: response.message
      };

      setMessages(prev => [...prev, aiMessage]);

      // Execute action if provided
      if (response.action && response.action.type !== "none") {
        await executeAction(response.action, response.action.data);
      } else {
        // If it's just a conversational response with no action, show quick actions
        setShowQuickActions(true);
      }

    } catch (error) {
      console.error("Error processing request:", error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: "assistant",
        content: "❌ Sorry, I encountered an error processing your request. Please try again or rephrase your question."
      }]);
      setShowQuickActions(true);
    } finally {
      setProcessing(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl h-[600px] max-h-[90vh] flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Ask AI Agent</CardTitle>
                <p className="text-sm text-slate-600">Ask me anything or perform quick actions</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleFileUpload}
          disabled={processing || uploadingFiles}
        />

        <CardContent className="flex-1 overflow-auto p-6 space-y-4">
          {/* Upload progress indicator */}
          {uploadingFiles && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Processing resumes... ({uploadProgress.current}/{uploadProgress.total})
                  </p>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      : "bg-slate-100 text-slate-900"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2"
                      dangerouslySetInnerHTML={{
                        __html: message.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />')
                          .replace(/- (.*?)(?=<br|$)/g, '<li>$1</li>')
                          .replace(/(<li>.*<\/li>)+/g, '<ul class="list-disc pl-4">$&</ul>')
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {processing && !uploadingFiles && ( // Only show "Thinking..." if not uploading files
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-slate-100 rounded-lg p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-slate-600">Thinking...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggested Actions */}
        {showQuickActions && !processing && !uploadingFiles && (
          <div className="border-t px-6 py-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Quick Actions:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestedAction(action.id)}
                  className="gap-2"
                  disabled={processing || uploadingFiles}
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message or paste candidate information..."
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
              disabled={processing || uploadingFiles}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || processing || uploadingFiles}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {(processing && !uploadingFiles) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
}
