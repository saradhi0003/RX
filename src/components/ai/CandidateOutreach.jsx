import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Loader2, 
  Mail, 
  Calendar, 
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvokeLLM } from "@/integrations/Core";
import { OutreachMessage } from "@/entities/OutreachMessage";
import { addNotification } from "@/components/notifications/NotificationToast";
import { sendAppEmail } from "@/components/utils/email";

export default function CandidateOutreach({ candidate, job, onOutreachSent }) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("initial_outreach");
  const [scheduledDate, setScheduledDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadOutreachHistory();
  }, [candidate?.id]);

  const loadOutreachHistory = async () => {
    if (!candidate?.id) return;
    setLoadingHistory(true);
    try {
      const data = await OutreachMessage.filter({ candidate_id: candidate.id }, "-created_date");
      setHistory(data || []);
    } catch (error) {
      console.error("Error loading outreach history:", error);
    }
    setLoadingHistory(false);
  };

  const generateOutreachMessage = async () => {
    if (!candidate) {
      addNotification({ type: "error", title: "Error", message: "Candidate information required" });
      return;
    }

    setGenerating(true);
    try {
      const candidateProfile = {
        name: `${candidate.first_name} ${candidate.last_name}`,
        current_title: candidate.current_title || "Professional",
        experience_years: candidate.experience_years || 0,
        skills: candidate.skills || [],
        location: candidate.location || ""
      };

      const jobInfo = job ? {
        title: job.title,
        description: job.description || "",
        location: job.location || "",
        remote_type: job.remote_type || "onsite",
        key_requirements: job.required_skills || []
      } : null;

      const contextPrompt = jobInfo 
        ? `Generate a personalized, professional outreach email to the candidate about the following job opportunity:`
        : `Generate a general networking/introduction email to add this candidate to our talent network:`;

      const response = await InvokeLLM({
        prompt: `${contextPrompt}

**Candidate Profile:**
${JSON.stringify(candidateProfile, null, 2)}

${jobInfo ? `**Job Opportunity:**
${JSON.stringify(jobInfo, null, 2)}` : ''}

**Message Type:** ${messageType.replace(/_/g, ' ')}

Generate a compelling outreach message that:
1. Is personalized and addresses the candidate by name
2. Shows you've researched their background
3. Highlights relevant aspects of the opportunity (if job is provided)
4. Is professional yet warm and engaging
5. Includes a clear call-to-action
6. Is concise (2-3 short paragraphs)

Also provide an appropriate subject line.

The tone should be:
- Professional but friendly
- Respectful of their time
- Value-focused (what's in it for them)
- Not overly salesy`,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            message: { type: "string" }
          },
          required: ["subject", "message"]
        }
      });

      setSubject(response.subject);
      setMessage(response.message);
      addNotification({ type: "success", title: "Success", message: "Outreach message generated!" });
    } catch (error) {
      console.error("Error generating outreach:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to generate message" });
    }
    setGenerating(false);
  };

  const handleSendOrSchedule = async () => {
    if (!subject.trim() || !message.trim()) {
      addNotification({ type: "error", title: "Error", message: "Subject and message are required" });
      return;
    }

    if (!candidate?.email) {
      addNotification({ type: "error", title: "Error", message: "Candidate email required" });
      return;
    }

    setSending(true);
    try {
      // Determine status based on scheduling
      const isScheduled = !!scheduledDate;
      const outreachStatus = isScheduled ? "scheduled" : "draft";
      
      const outreachData = {
        candidate_id: candidate.id,
        job_id: job?.id || null,
        subject,
        message,
        message_type: messageType,
        channel: "email",
        status: outreachStatus,
        scheduled_date: scheduledDate || null,
        sent_date: null,
        follow_up_date: followUpDate || null,
        follow_up_needed: !!followUpDate,
        ai_generated: true
      };

      // If not scheduled, attempt to send immediately
      if (!isScheduled) {
        try {
          await sendAppEmail({
            to: candidate.email,
            subject,
            body: message
          });
          
          // Update status to sent if email was successful
          outreachData.status = "sent";
          outreachData.sent_date = new Date().toISOString();
          
          await OutreachMessage.create(outreachData);
          addNotification({ 
            type: "success", 
            title: "Sent!", 
            message: `Outreach sent to ${candidate.email}` 
          });
        } catch (emailError) {
          // Email failed, save as draft with error note
          console.error("Email send error:", emailError);
          outreachData.status = "draft";
          outreachData.notes = `Email failed to send: ${emailError.message || 'Unknown error'}. Please copy and send manually.`;
          
          await OutreachMessage.create(outreachData);
          
          addNotification({ 
            type: "warning", 
            title: "Saved as Draft", 
            message: "Email could not be sent automatically. Message saved as draft. You may need to send it manually via your email client.",
            duration: 10000
          });
        }
      } else {
        // Just save as scheduled
        await OutreachMessage.create(outreachData);
        addNotification({ 
          type: "success", 
          title: "Scheduled!", 
          message: `Outreach scheduled for ${new Date(scheduledDate).toLocaleString()}` 
        });
      }

      // Reset form
      setSubject("");
      setMessage("");
      setScheduledDate("");
      setFollowUpDate("");
      await loadOutreachHistory();
      
      if (onOutreachSent) onOutreachSent();
    } catch (error) {
      console.error("Error sending outreach:", error);
      addNotification({ 
        type: "error", 
        title: "Error", 
        message: error.message || "Failed to process outreach" 
      });
    }
    setSending(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      scheduled: "bg-blue-100 text-blue-800",
      sent: "bg-green-100 text-green-800",
      delivered: "bg-green-100 text-green-800",
      opened: "bg-purple-100 text-purple-800",
      replied: "bg-indigo-100 text-indigo-800",
      bounced: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.draft;
  };

  return (
    <div className="space-y-6">
      {/* Email Provider Warning */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-yellow-900 font-medium mb-1">Email Configuration Required</p>
              <p className="text-xs text-yellow-800">
                To send emails directly, configure Gmail or Outlook in <strong>Email Settings</strong>. 
                Otherwise, outreach messages will be saved as drafts for you to send manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outreach Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI-Powered Outreach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Message Type</label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial_outreach">Initial Outreach</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="interview_invitation">Interview Invitation</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Action</label>
              <Button 
                onClick={generateOutreachMessage} 
                disabled={generating}
                className="w-full gap-2"
                variant="outline"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Subject</label>
            <Input 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <Textarea 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your outreach message..."
              rows={10}
              className="font-sans"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Schedule Send (Optional)</label>
              <Input 
                type="datetime-local"
                value={scheduledDate} 
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Follow-up Date (Optional)</label>
              <Input 
                type="date"
                value={followUpDate} 
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleSendOrSchedule} 
              disabled={sending || !candidate?.email}
              className="gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {scheduledDate ? "Scheduling..." : "Processing..."}
                </>
              ) : (
                <>
                  {scheduledDate ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {scheduledDate ? "Schedule" : "Send / Save"}
                </>
              )}
            </Button>
            {!candidate?.email && (
              <span className="text-xs text-red-600">Candidate email required</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Outreach History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Outreach History
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadOutreachHistory}
              disabled={loadingHistory}
            >
              {loadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-center py-8 text-slate-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No outreach messages yet</div>
          ) : (
            <div className="space-y-3">
              {history.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{msg.subject}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {msg.sent_date ? `Sent: ${new Date(msg.sent_date).toLocaleString()}` : 
                         msg.scheduled_date ? `Scheduled: ${new Date(msg.scheduled_date).toLocaleString()}` :
                         "Draft"}
                      </p>
                    </div>
                    <Badge className={getStatusBadge(msg.status)}>
                      {msg.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-slate-600 line-clamp-2 mb-2">{msg.message}</p>
                  
                  {msg.notes && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded mb-2">
                      {msg.notes}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <Badge variant="outline">{msg.message_type.replace(/_/g, ' ')}</Badge>
                    {msg.response_received && (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Replied
                      </Badge>
                    )}
                    {msg.follow_up_needed && msg.follow_up_date && (
                      <Badge variant="outline" className="bg-yellow-50">
                        <Calendar className="w-3 h-3 mr-1" />
                        Follow-up: {new Date(msg.follow_up_date).toLocaleDateString()}
                      </Badge>
                    )}
                    {msg.status === "draft" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => {
                          setSubject(msg.subject);
                          setMessage(msg.message);
                          setMessageType(msg.message_type);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit & Resend
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}