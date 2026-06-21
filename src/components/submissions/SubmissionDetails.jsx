
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Mail, Calendar, User, Briefcase, Loader2, Sparkles, Send, Edit2, Save } from "lucide-react";
import { Task } from "@/entities/Task";
import { Submission } from "@/entities/Submission"; // Added Submission entity for updates

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarCmp } from "@/components/ui/calendar"; // Renamed to avoid conflict with lucide-react Calendar icon
import { sendAppEmail } from "@/components/utils/email"; // New email sending utility
import { format } from "date-fns"; // For date formatting
import { cn } from "@/lib/utils"; // For className utility
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { InvokeLLM } from "@/integrations/Core"; // Moved up with other core imports

import StatusPath from "@/components/common/StatusPath";
import RelatedQuickLinks from "@/components/common/RelatedQuickLinks";
import DataListModal from "@/components/common/DataListModal";

export default function SubmissionDetails({ submission, candidate, job, recruiter, onClose, onUpdated, onOpenFollowUp }) {
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailData, setEmailData] = useState({
    to: "",
    subject: "",
    body: ""
  });
  const [sending, setSending] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [thinking, setThinking] = useState(false);

  // New state variables for inline editing of submission
  const [edit, setEdit] = useState(true); // open in edit mode by default per request
  const [editData, setEditData] = useState({
    status: submission.status,
    // Convert string date to Date object for CalendarCmp, or undefined if null/empty
    follow_up_date: submission.follow_up_date ? new Date(submission.follow_up_date) : undefined,
    notes: submission.notes || ""
  });

  // Add-task mini form
  const [addingTask, setAddingTask] = useState(false); // Can be used to toggle form visibility if needed
  const [taskForm, setTaskForm] = useState({
    title: "",
    due_date: undefined, // Use undefined for initial state of Date object in CalendarCmp
    priority: "medium",
    assigned_to: recruiter?.email || "" // Default assigned to the current recruiter's email
  });

  // New states for StatusPath and DataListModal
  const [statusValue, setStatusValue] = useState(submission.status);
  const [statusLoading, setStatusLoading] = useState(false);
  const [summary, setSummary] = useState({ open: false, title: "", columns: [], rows: [] });

  useEffect(() => { setStatusValue(submission.status); }, [submission.status]);

  const statusItems = [
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "interviewing", label: "Interviewing" },
    { value: "rejected", label: "Rejected" },
    { value: "hired", label: "Hired" },
    { value: "withdrawn", label: "Withdrawn" }
  ];

  const changeStatus = async (val) => {
    if (val === statusValue) return;
    setStatusLoading(true);
    setStatusValue(val); // Optimistic update
    try {
      await Submission.update(submission.id, { status: val });
      onUpdated?.(); // Trigger re-render/re-fetch parent data
    } catch (error) {
      console.error("Failed to change status:", error);
      alert("Failed to change status: " + error.message);
      setStatusValue(submission.status); // Revert on error
    } finally {
      setStatusLoading(false);
    }
  };

  const openQuickSummary = (item) => {
    const id = item.id;
    if (id === "rel-candidate") {
      setSummary({
        open: true,
        title: "Candidate",
        columns: [
          { key: "name", label: "Name" },
          { key: "title", label: "Title" },
          { key: "email", label: "Email" }
        ],
        rows: candidate ? [{ name: `${candidate.first_name} ${candidate.last_name}`, title: candidate.current_title || "—", email: candidate.email || "—" }] : []
      });
      return;
    }
    if (id === "rel-job") {
      setSummary({
        open: true,
        title: "Job",
        columns: [
          { key: "title", label: "Title" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" }
        ],
        rows: job ? [{ title: job.title, location: job.location || "—", status: job.status || "—" }] : []
      });
      return;
    }
    if (id === "rel-tasks") {
      setSummary({
        open: true,
        title: "Related Tasks",
        columns: [
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "due", label: "Due" }
        ],
        rows: tasks.map(t => ({ title: t.title, status: t.status, due: t.due_date ? new Date(t.due_date).toLocaleDateString() : "—" }))
      });
      return;
    }
    if (id === "rel-interviews") {
      const rows = (submission.interview_dates || []).map(i => ({
        date: i.date ? new Date(i.date).toLocaleString() : "—",
        type: i.type || "—",
        interviewer: i.interviewer || "—"
      }));
      setSummary({
        open: true,
        title: "Interviews",
        columns: [
          { key: "date", label: "Date" },
          { key: "type", label: "Type" },
          { key: "interviewer", label: "Interviewer" }
        ],
        rows
      });
      return;
    }
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const loadTasks = async () => {
      setLoadingTasks(true);
      try {
        const related = await Task.filter({ related_entity: "submission", related_id: submission.id });
        setTasks(related);
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
    // Also re-initialize editData if the submission prop changes (e.g., after an update)
    setEditData({
      status: submission.status,
      follow_up_date: submission.follow_up_date ? new Date(submission.follow_up_date) : undefined,
      notes: submission.notes || ""
    });
  }, [submission.id, submission.status, submission.follow_up_date, submission.notes]); // Dependencies to re-run effect

  const statusColors = {
    submitted: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    interviewing: "bg-purple-100 text-purple-800",
    rejected: "bg-red-100 text-red-800",
    hired: "bg-green-100 text-green-800",
    withdrawn: "bg-gray-100 text-gray-800"
  };

  const summaryContext = useMemo(() => ({
    submission: {
      id: submission.id,
      status: submission.status,
      submitted_date: submission.submitted_date || submission.created_date,
      follow_up_date: submission.follow_up_date,
      client_feedback: submission.client_feedback,
      notes: submission.notes,
      interview_dates: submission.interview_dates, // Include for AI summary if needed
      client: submission.client,
      companyName: submission.companyName,
      rate: submission.rate,
      submissionDate: submission.submissionDate,
      submissionStatus: submission.submissionStatus,
      vendorName: submission.vendorName,
      technologyText: submission.technologyText,
      h1bCap: submission.h1bCap,
      requiredSkillsText: submission.requiredSkillsText,
      comments: submission.comments
    },
    candidate: candidate ? {
      id: candidate.id,
      name: `${candidate.first_name} ${candidate.last_name}`,
      title: candidate.current_title,
      location: candidate.location,
      skills: candidate.skills || [],
      email: candidate.email
    } : null,
    job: job ? {
      id: job.id,
      title: job.title,
      company_id: job.company_id,
      location: job.location,
      required_skills: job.required_skills || [],
      priority: job.priority,
      status: job.status
    } : null,
    recruiter: recruiter ? {
      id: recruiter.id,
      name: recruiter.full_name || recruiter.email, // Use full_name if available, else email
      email: recruiter.email
    } : null,
    tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date, priority: t.priority }))
  }), [submission, candidate, job, recruiter, tasks]);

  const generateAISummary = async () => {
    setThinking(true);
    try {
      const prompt = `
You are an expert recruiting copilot. Summarize this submission for a recruiter using the provided JSON context.
Include:
- Candidate snapshot (name, title, top skills) vs job requirements.
- Current status and any risks (overdue tasks, missing follow-ups).
- Recommended next 2-3 actions (short bullets).
Return concise bullets (max ~150 words).

JSON CONTEXT:
${JSON.stringify(summaryContext, null, 2)}
      `.trim();
      const resp = await InvokeLLM({ prompt });
      const text = typeof resp === "string" ? resp : JSON.stringify(resp, null, 2);
      setAiSummary(text);
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    generateAISummary();
     
  }, []);

  const saveSubmission = async () => {
    // Check if editData has meaningfully changed before saving
    const originalFollowUpDateFormatted = submission.follow_up_date ? format(new Date(submission.follow_up_date), "yyyy-MM-dd") : null;
    const currentFollowUpDateFormatted = editData.follow_up_date ? format(editData.follow_up_date, "yyyy-MM-dd") : null;

    if (editData.status === submission.status &&
        currentFollowUpDateFormatted === originalFollowUpDateFormatted &&
        editData.notes === submission.notes) {
      setEdit(false); // No changes detected, just exit edit mode
      return;
    }

    const payload = {
      status: editData.status,
      // Convert Date object back to ISO string (yyyy-MM-dd) for storage
      follow_up_date: editData.follow_up_date ? format(editData.follow_up_date, "yyyy-MM-dd") : null,
      notes: editData.notes
    };
    try {
      await Submission.update(submission.id, payload);

      // Sync task due date to the date of update (today)
      const dueStr = format(new Date(), "yyyy-MM-dd");
      const related = await Task.filter({ related_entity: "submission", related_id: submission.id });
      if (related.length) {
        await Task.update(related[0].id, { due_date: dueStr }); // Outline specified updating only the first related task
      }
      setEdit(false);
      onUpdated?.(); // Trigger re-render of submission details, including tasks
    } catch (error) {
      console.error("Failed to save submission:", error);
      alert("Failed to save submission: " + error.message);
    }
  };

  const addTask = async () => {
    if (!taskForm.title) {
      alert("Task title is required.");
      return; // Title is required
    }
    try {
      await Task.create({
        title: taskForm.title,
        description: `Linked to submission ${submission.id}`,
        assigned_to: taskForm.assigned_to || null, // Use null for empty string if DB expects it
        related_entity: "submission",
        related_id: submission.id,
        priority: taskForm.priority,
        status: "pending", // New tasks are pending by default
        due_date: taskForm.due_date ? format(taskForm.due_date, "yyyy-MM-dd") : null, // Format date to string
        tags: ["submission"] // Add a tag for easier filtering
      });
      setAddingTask(false);
      // Clear the form fields after successful task creation, assigned_to remains current user's email
      setTaskForm({ title: "", due_date: undefined, priority: "medium", assigned_to: recruiter?.email || "" });
      onUpdated?.(); // Trigger re-render to show new task in the list
    } catch (error) {
      console.error("Failed to add task:", error);
      alert("Failed to add task: " + error.message);
    }
  };

  const openEmail = (recipient) => {
    setEmailData({
      to: recipient || recruiter?.email || "",
      subject: job ? `Update: ${job.title} submission for ${candidate ? `${candidate.first_name} ${candidate.last_name}` : "candidate"}` : "Submission Update",
      body: `Hi,\n\nHere's an update regarding the submission:\n- Candidate: ${candidate ? `${candidate.first_name} ${candidate.last_name}` : "N/A"}\n- Job: ${job?.title || "N/A"}\n- Status: ${submission.status}\n\nBest,\nRecruiter X`
    });
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    setSending(true);
    try {
      await sendAppEmail({ // Using sendAppEmail as per outline
        to: emailData.to,
        subject: emailData.subject,
        body: emailData.body
      });
      setEmailOpen(false);
    } catch (e) {
      alert("Failed to send email: " + e.message); // Added alert for errors
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Submission Details
              <Badge className={statusColors[statusValue] || "bg-slate-100 text-slate-800"}>
                {statusValue?.replace("_"," ")}
              </Badge>
            </CardTitle>
            <div className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-3">
              {candidate && (
                <span className="inline-flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} className="text-blue-600 hover:underline">
                    {candidate.first_name} {candidate.last_name}
                  </Link>
                </span>
              )}
              {job && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  <Link to={createPageUrl(`JobDetails?id=${job.id}`)} className="text-blue-600 hover:underline">
                    {job.title}
                  </Link>
                </span>
              )}
              <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(submission.submitted_date || submission.created_date).toLocaleDateString()}</span>
            </div>

            {/* Status Path */}
            <div className="mt-3">
              <StatusPath items={statusItems} value={statusValue} onChange={changeStatus} loading={statusLoading} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!edit && ( // Show edit button when not in edit mode
              <Button variant="outline" className="gap-2" onClick={() => setEdit(true)}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            )}
            {edit && ( // Show save button when in edit mode
              <Button className="gap-2" onClick={saveSubmission}>
                <Save className="w-4 h-4" /> Save
              </Button>
            )}
            <Button className="gap-2" onClick={() => onOpenFollowUp?.()}>
              <Send className="w-4 h-4" /> Follow-up
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          {/* Related links with summaries */}
          <RelatedQuickLinks
            items={[
              { id: "rel-candidate", label: "Candidate", count: candidate ? 1 : 0 },
              { id: "rel-job", label: "Job", count: job ? 1 : 0 },
              { id: "rel-tasks", label: "Tasks", count: tasks.length },
              { id: "rel-interviews", label: "Interviews", count: (submission.interview_dates || []).length }
            ]}
            onItemClick={openQuickSummary}
          />

          {/* Sections: vertical on large screens, horizontal scroll on small */}
          <div className="mt-4 flex gap-4 flex-row overflow-x-auto lg:flex-col lg:overflow-visible">
            {/* Submission Section */}
            <div className="min-w-[320px] flex-1">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-3">Submission</h4>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={editData.status} onValueChange={(val) => setEditData({ ...editData, status: val })} disabled={!edit}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                      <SelectContent>
                        {["submitted", "under_review", "interviewing", "rejected", "hired", "withdrawn"].map(s => (
                          <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="follow_up_date">Follow-up Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !editData.follow_up_date && "text-muted-foreground",
                            !edit && "bg-gray-100 cursor-not-allowed" // Disable styling for read-only
                          )}
                          disabled={!edit}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {editData.follow_up_date ? format(editData.follow_up_date, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      {edit && ( // Only show popover content if in edit mode
                        <PopoverContent className="w-auto p-0">
                          <CalendarCmp
                            mode="single"
                            selected={editData.follow_up_date}
                            onSelect={(date) => setEditData({ ...editData, follow_up_date: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      )}
                    </Popover>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      rows={4}
                      disabled={!edit}
                    />
                  </div>
                  {!edit && submission.client_feedback && ( // Show client feedback only in read mode if exists
                    <div>
                      <Label>Client Feedback</Label>
                      <p className="text-sm">{submission.client_feedback}</p>
                    </div>
                  )}
                  {!edit && ( // Show submitted date only in read mode
                    <div>
                      <Label>Submitted On</Label>
                      <p className="text-sm">{new Date(submission.submitted_date || submission.created_date).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* People Section */}
            <div className="min-w-[320px] flex-1">
              <div className="p-4 border rounded-lg h-full"> {/* Added h-full for consistent height */}
                <h4 className="font-semibold mb-3">People</h4>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-slate-500">Candidate: </span>
                    {candidate ? (
                      <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} className="text-blue-600 hover:underline">
                        {candidate.first_name} {candidate.last_name} • {candidate.email}
                      </Link>
                    ) : "—"}
                  </div>
                  <div>
                    <span className="text-slate-500">Recruiter: </span>
                    {recruiter ? `${recruiter.full_name || recruiter.email} • ${recruiter.email}` : "—"}
                  </div>
                  {candidate?.email && (
                    <Button variant="outline" className="gap-2 w-full justify-start mt-2" onClick={() => openEmail(candidate.email)}>
                      <Mail className="w-4 h-4" /> Email Candidate
                    </Button>
                  )}
                  {recruiter?.email && (
                    <Button variant="outline" className="gap-2 w-full justify-start mt-2" onClick={() => openEmail(recruiter.email)}>
                      <Mail className="w-4 h-4" /> Email Recruiter
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Job Section */}
            <div className="min-w-[320px] flex-1">
              <div className="p-4 border rounded-lg h-full"> {/* Added h-full for consistent height */}
                <h4 className="font-semibold mb-3">Job</h4>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="text-slate-500">Title: </span>
                    {job ? (
                      <Link to={createPageUrl(`JobDetails?id=${job.id}`)} className="text-blue-600 hover:underline">
                        {job.title}
                      </Link>
                    ) : "—"}
                  </div>
                  <div><span className="text-slate-500">Location: </span>{job?.location || "—"}</div>
                  <div><span className="text-slate-500">Priority: </span>{job?.priority || "—"}</div>
                  {!!(job?.required_skills?.length) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {job.required_skills.slice(0, 8).map((s, i) => (
                        <Badge key={i} variant="secondary">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Extra Details displaying new fields */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-3">Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Client:</span> <span className="ml-1">{submission.client || "—"}</span></div>
                <div><span className="text-slate-500">Company:</span> <span className="ml-1">{submission.companyName || "—"}</span></div>
                <div><span className="text-slate-500">Rate:</span> <span className="ml-1">{submission.rate || "—"}</span></div>
                <div><span className="text-slate-500">Submission Date:</span> <span className="ml-1">{submission.submissionDate ? new Date(submission.submissionDate).toLocaleDateString() : "—"}</span></div>
                <div><span className="text-slate-500">Submission Status:</span> <span className="ml-1">{submission.submissionStatus || "—"}</span></div>
                <div><span className="text-slate-500">Vendor:</span> <span className="ml-1">{submission.vendorName || "—"}</span></div>
                <div><span className="text-slate-500">Technology:</span> <span className="ml-1">{submission.technologyText || "—"}</span></div>
                <div><span className="text-slate-500">H-1B CAP:</span> <span className="ml-1">{submission.h1bCap || "—"}</span></div>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold mb-3">Notes & Skills</h4>
              <div className="text-sm">
                <div className="mb-2"><span className="text-slate-500">Required Skills:</span></div>
                <div className="bg-slate-50 rounded p-3">{submission.requiredSkillsText || "—"}</div>
                <div className="mt-3 mb-2"><span className="text-slate-500">Comments:</span></div>
                <div className="bg-slate-50 rounded p-3">{submission.comments || "—"}</div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="related" className="space-y-6 mt-6">
            <TabsList>
              <TabsTrigger value="related">Related</TabsTrigger>
              <TabsTrigger value="ai">AI Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="related">
              <div className="space-y-4">
                <h4 className="font-semibold">Related Tasks</h4>
                {/* Add Task Section */}
                <div className="p-4 border rounded-lg bg-gray-50">
                  <h5 className="font-semibold mb-3">Add New Task</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taskTitle">Task Title</Label>
                      <Input
                        id="taskTitle"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                        placeholder="e.g., Schedule 1st Interview"
                      />
                    </div>
                    <div>
                      <Label htmlFor="taskDueDate">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !taskForm.due_date && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {taskForm.due_date ? format(taskForm.due_date, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarCmp
                            mode="single"
                            selected={taskForm.due_date}
                            onSelect={(date) => setTaskForm({ ...taskForm, due_date: date })}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="taskPriority">Priority</Label>
                      <Select value={taskForm.priority} onValueChange={(val) => setTaskForm({ ...taskForm, priority: val })}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map(p => (
                            <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="taskAssignedTo">Assigned To</Label>
                      <Input
                        id="taskAssignedTo"
                        value={taskForm.assigned_to}
                        // The assigned_to field is now read-only and restricted to the current user's email (recruiter)
                        // No onChange handler as it's not meant to be changed by the user
                        disabled={true} // Disable the input to restrict selection to the current user
                        placeholder="Current User Email"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button onClick={addTask} disabled={!taskForm.title}>Add Task</Button>
                  </div>
                </div>

                {loadingTasks ? (
                  <div className="text-slate-500 text-sm">Loading tasks…</div>
                ) : tasks.length === 0 ? (
                  <div className="text-slate-500 text-sm">No related tasks found.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tasks.map(t => {
                      const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed";
                      return (
                        <div key={t.id} className="p-3 rounded border bg-white">
                          <div className="flex items-start justify-between">
                            <Link
                              to={createPageUrl(`TaskDetails?id=${t.id}`)}
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {t.title}
                            </Link>
                            <Badge className="capitalize">{t.status?.replace("_"," ")}</Badge>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">Assignee: {t.assigned_to || "—"}</div>
                          <div className={`text-xs mt-1 ${overdue ? "text-red-600 font-medium" : "text-slate-600"}`}>
                            Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                          </div>
                          {t.description && <div className="text-xs text-slate-600 mt-1">{t.description}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">AI Summary</h4>
                  <Button size="sm" variant="outline" onClick={generateAISummary} disabled={thinking} className="gap-2">
                    {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Regenerate
                  </Button>
                </div>
                {aiSummary ? (
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiSummary}</div>
                ) : (
                  <div className="text-sm text-slate-500">No summary yet.</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        {/* Summary Modal */}
        {summary.open && (
          <DataListModal
            open={summary.open}
            title={summary.title}
            columns={summary.columns}
            rows={summary.rows}
            onClose={() => setSummary(s => ({ ...s, open: false }))}
          />
        )}

        {/* Email Compose Drawer-like area */}
        {emailOpen && (
          <div className="border-t p-4 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-2">
                <Label>To</Label>
                <Input value={emailData.to} onChange={(e) => setEmailData({ ...emailData, to: e.target.value })} placeholder="recipient@example.com" />
              </div>
              <div className="md:col-span-4">
                <Label>Subject</Label>
                <Input value={emailData.subject} onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <Label>Message</Label>
                <Textarea rows={5} value={emailData.body} onChange={(e) => setEmailData({ ...emailData, body: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
              <Button onClick={sendEmail} disabled={sending || !emailData.to} className="gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Email
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
