
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, MapPin, FileText, Users, Briefcase, ClipboardList, Save, Edit, Mail as MailIcon, UserCheck, AlertCircle, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import StatusPath from "@/components/common/StatusPath";
import RelatedQuickLinks from "@/components/common/RelatedQuickLinks";
import DataListModal from "@/components/common/DataListModal";
import EmailModal from "@/components/common/EmailModal";
import CandidateForm from "@/components/candidates/CandidateForm";
import CandidateScreening from "@/components/ai/CandidateScreening";
import CandidateOutreach from "@/components/ai/CandidateOutreach";
import InterviewAssistant from "@/components/ai/InterviewAssistant";
import { Application } from "@/entities/Application";
import { Candidate } from "@/entities/Candidate";
import { Job } from "@/entities/Job";
import { Resume } from "@/entities/Resume";
import { Submission } from "@/entities/Submission";
import { Task } from "@/entities/Task";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ContextualSuggestions from "@/components/playbooks/ContextualSuggestions";

export default function CandidateDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const [record, setRecord] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [apps, setApps] = React.useState([]);
  const [subs, setSubs] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [resumes, setResumes] = React.useState([]);
  const [jobs, setJobs] = React.useState([]);
  const [selectedJobForScreening, setSelectedJobForScreening] = React.useState(null);
  const [statusUpdating, setStatusUpdating] = React.useState(false);

  const [modal, setModal] = React.useState({ open: false, title: "", columns: [], rows: [] });

  const [showEmail, setShowEmail] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!id) {
      setError("No candidate ID provided");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rec = await Candidate.get(id);
      
      if (!rec) {
        setError("Candidate not found");
        setLoading(false);
        return;
      }

      setRecord(rec);
      
      const [a, s, t, r, j] = await Promise.all([
        Application.filter({ candidate_id: id }, "-created_date"),
        Submission.filter({ candidate_id: id }, "-created_date"),
        Task.filter({ related_entity: "candidate", related_id: id }, "-created_date"),
        Resume.filter({ candidate_id: id }, "-created_date"),
        Job.list("-created_date", 50)
      ]);
      
      setApps(a || []);
      setSubs(s || []);
      setTasks(t || []);
      setResumes(r || []);
      setJobs(j || []);
    } catch (err) {
      console.error("Error loading candidate:", err);
      if (err.response?.status === 404) {
        setError("Candidate not found. They may have been deleted or the ID is incorrect.");
      } else {
        setError(err.message || "Failed to load candidate details");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { 
    if (id) load(); 
  }, [id, load]);

  const saveRecord = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await Candidate.update(record.id, { 
        status: record.status, 
        notes: record.notes 
      });
      await load();
    } catch (err) {
      console.error("Error saving candidate:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const statusItems = [
    { value: "active", label: "Active" },
    { value: "screened", label: "Screened" },
    { value: "placed", label: "Placed" },
    { value: "inactive", label: "Inactive" },
    { value: "do_not_contact", label: "Do Not Contact" },
  ];
  
  const changeStatus = async (val) => {
    if (!record || record.status === val) return;
    setStatusUpdating(true);
    try {
      await Candidate.update(record.id, { status: val });
      await load();
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const openSummary = (key) => {
    if (key === "applications") {
      setModal({
        open: true,
        title: "Applications",
        columns: [
          { key: "job_id", label: "Job Id" },
          { key: "status", label: "Status" },
          { key: "created_date", label: "Created" },
        ],
        rows: apps.map(x => ({ job_id: x.job_id, status: x.status, created_date: new Date(x.created_date).toLocaleString() })),
      });
    } else if (key === "submissions") {
      setModal({
        open: true,
        title: "Submissions",
        columns: [
          { key: "job_id", label: "Job Id" },
          { key: "status", label: "Status" },
          { key: "submitted_date", label: "Submitted" },
        ],
        rows: subs.map(x => ({ job_id: x.job_id, status: x.status, submitted_date: x.submitted_date ? new Date(x.submitted_date).toLocaleString() : "—" })),
      });
    } else if (key === "tasks") {
      setModal({
        open: true,
        title: "Tasks",
        columns: [
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "due_date", label: "Due" },
        ],
        rows: tasks.map(x => ({ title: x.title, status: x.status, due_date: x.due_date ? new Date(x.due_date).toLocaleDateString() : "—" })),
      });
    } else if (key === "resumes") {
      setModal({
        open: true,
        title: "Resumes",
        columns: [
          { key: "name", label: "Name" },
          { key: "headline", label: "Headline" },
          { key: "updated_date", label: "Updated" },
        ],
        rows: resumes.map(x => ({ name: x.name, headline: x.headline || "—", updated_date: new Date(x.updated_date).toLocaleString() })),
      });
    }
  };

  // Prepare context for playbook suggestions
  const playbookContext = record ? {
    type: "candidate",
    candidate_id: record.id,
    status: record.status,
    skills: record.skills || [],
    experience_years: record.experience_years,
    current_title: record.current_title,
    work_authorization: record.work_authorization,
    has_applications: apps.length > 0,
    has_submissions: subs.length > 0
  } : null;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 w-56 bg-slate-200 rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-red-900 mb-2">Candidate Not Found</h2>
                <p className="text-red-700 mb-4">{error}</p>
                <p className="text-sm text-red-600 mb-6">
                  The candidate you're looking for might have been deleted, or the link may be incorrect.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to={createPageUrl("Candidates")}>
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Candidates
                  </Button>
                </Link>
                <Button onClick={() => window.location.reload()} variant="default">
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-6 lg:p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-slate-600">No candidate data available.</p>
            <Link to={createPageUrl("Candidates")}>
              <Button variant="outline" className="mt-4 gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Candidates
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${(record.first_name || " ").charAt(0)}${(record.last_name || " ").charAt(0)}`.toUpperCase();

  const related = [
    { id: "applications", key: "applications", label: "Applications", count: apps.length },
    { id: "submissions", key: "submissions", label: "Submissions", count: subs.length },
    { id: "tasks", key: "tasks", label: "Tasks", count: tasks.length },
    { id: "resumes", key: "resumes", label: "Resumes", count: resumes.length },
  ];

  const statusColor = {
    active: "bg-green-100 text-green-800",
    screened: "bg-blue-100 text-blue-800",
    placed: "bg-purple-100 text-purple-800",
    inactive: "bg-gray-100 text-gray-800",
    do_not_contact: "bg-red-100 text-red-800",
  }[record.status] || "bg-gray-100 text-gray-800";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--brand-cyan,#00C9FF)] to-[var(--brand-purple,#6C00FF)] text-white flex items-center justify-center text-lg font-semibold">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">{record.first_name} {record.last_name}</h1>
                  <Badge className={statusColor + " capitalize"}>{record.status?.replace("_"," ")}</Badge>
                  {typeof record.screening_score === "number" && (
                    <Badge className="bg-purple-100 text-purple-800">
                      <UserCheck className="w-3 h-3 mr-1" />
                      Score: {Math.round(record.screening_score)}
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-slate-600 flex flex-wrap gap-4 mt-1">
                  {record.email && <span className="inline-flex items-center gap-1"><Mail className="w-4 h-4" /> {record.email}</span>}
                  {record.phone && <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" /> {record.phone}</span>}
                  {record.location && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {record.location}</span>}
                </div>
              </div>
            </div>
            <div className="w-full md:w-auto">
              <StatusPath items={statusItems} value={record.status} onChange={changeStatus} loading={statusUpdating} />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button onClick={saveRecord} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowEdit(true)}>
              <Edit className="w-4 h-4" /> Edit
            </Button>
            {record.email && (
              <Button variant="outline" className="gap-2" onClick={() => setShowEmail(true)}>
                <MailIcon className="w-4 h-4" /> Email
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Contextual Playbook Suggestions after Candidate Details */}
      {record && (
        <ContextualSuggestions context={playbookContext} autoLoad={true} />
      )}

      <RelatedQuickLinks
        items={related}
        onItemClick={(it) => openSummary(it.key)}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="screening">AI Screening</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex gap-4 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 md:gap-6">
            <Card className="min-w-[85%] md:min-w-0">
              <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-500">Current Title</span><div className="font-medium">{record.current_title || "—"}</div></div>
                  <div><span className="text-slate-500">Current Company</span><div className="font-medium">{record.current_company || "—"}</div></div>
                  <div><span className="text-slate-500">Experience</span><div className="font-medium">{record.experience_years ? `${record.experience_years} yrs` : "—"}</div></div>
                  <div><span className="text-slate-500">Work Auth</span><div className="font-medium">{record.work_authorization || "—"}</div></div>
                </div>
                {Array.isArray(record.skills) && record.skills.length > 0 && (
                  <div>
                    <div className="text-slate-500">Top Skills</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {record.skills.slice(0, 8).map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-w-[85%] md:min-w-0">
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700 min-h-[120px] whitespace-pre-wrap">{record.notes || "—"}</div>
              </CardContent>
            </Card>

            <Card className="min-w-[85%] md:min-w-0">
              <CardHeader><CardTitle>Resume</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {record.resume_url ? (
                  <a className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm" href={record.resume_url} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4" /> Open Resume
                  </a>
                ) : <div className="text-sm text-slate-600">No resume uploaded.</div>}
                {resumes.length > 0 && (
                  <div className="text-xs text-slate-500">Profile has {resumes.length} resume snapshot(s) saved.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="screening" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Job for Screening</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedJobForScreening?.id || ""}
                onValueChange={(val) => {
                  const job = jobs.find(j => j.id === val);
                  setSelectedJobForScreening(job || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a job to screen against" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} {j.status ? `(${j.status})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <CandidateScreening
            candidate={record}
            job={selectedJobForScreening}
            onScreeningComplete={() => load()}
          />
        </TabsContent>

        <TabsContent value="outreach" className="space-y-4">
          <CandidateOutreach 
            candidate={record}
            job={selectedJobForScreening}
            onOutreachSent={() => load()}
          />
        </TabsContent>

        <TabsContent value="interviews" className="space-y-4">
          <InterviewAssistant
            candidate={record}
            job={selectedJobForScreening}
            application={apps[0]} // Pass the first application, assuming it's the primary one or adjust logic if needed
          />
        </TabsContent>
      </Tabs>

      <DataListModal
        open={modal.open}
        title={modal.title}
        columns={modal.columns}
        rows={modal.rows}
        onClose={() => setModal({ open: false, title: "", columns: [], rows: [] })}
      />

      <EmailModal
        open={showEmail}
        to={record.email || ""}
        defaultSubject={`Hi ${record.first_name || ""}`}
        defaultBody=""
        onClose={() => setShowEmail(false)}
      />
      {showEdit && (
        <CandidateForm
          candidate={record}
          onSave={async (data) => { await Candidate.update(record.id, data); setShowEdit(false); await load(); }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
