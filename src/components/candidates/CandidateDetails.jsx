
import React, { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  ExternalLink,
  Edit,
  Star,
  DollarSign,
  Clock,
  FileText,
  Loader2,
  BrainCircuit,
  Building2,
  ListChecks,
  ClipboardList,
  Plus
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CandidateForm from "./CandidateForm";
import { Candidate, Job, Application, Submission, Task, Company, Resume } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import ScoreDisplay from "../ai/ScoreDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CandidateAISummary from "./CandidateAISummary";
import StatusPath from "@/components/common/StatusPath";
import RelatedQuickLinks from "@/components/common/RelatedQuickLinks";
import { usePermissions } from "@/components/common/PermissionsContext"; // Modified line
import PermissionGate from "@/components/common/PermissionGate"; // New line
import { addNotification } from "@/components/notifications/NotificationToast";

// Define stages with "Our Bench" positioned before "Active" as requested
const STAGES = ["our_bench", "active", "placed", "inactive", "do_not_contact"];

const InfoCard = ({ icon: Icon, title, value, className = "" }) => (
  <div className={`bg-white rounded-lg border p-4 ${className}`}>
    <div className="flex items-center gap-3">
      <div className="p-2 bg-blue-50 rounded-lg">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="font-semibold text-slate-900">{value || "Not specified"}</p>
      </div>
    </div>
  </div>
);

// Map status to Tailwind badge colors
const getStatusColor = (status) => {
  switch ((status || "").toLowerCase()) {
    case "our_bench":
      return "bg-purple-100 text-purple-800"; // Our Bench first
    case "active":
      return "bg-green-100 text-green-800";
    case "placed":
      return "bg-blue-100 text-blue-800";
    case "inactive":
      return "bg-slate-100 text-slate-800";
    case "do_not_contact":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function CandidateDetails({ candidate, onBack, onUpdate }) {
  const [showEditForm, setShowEditForm] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScoring, setIsScoring] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusValue, setStatusValue] = useState(candidate.status);
  const applyBlockRef = useRef(null);

  // NEW: ensure jobs are available for recruiters (fallback fetch of open jobs)
  const [jobOptions, setJobOptions] = useState([]);

  useEffect(() => {
    // Synchronize jobOptions with jobs fetched from loadAssociatedData
    setJobOptions(jobs || []);
  }, [jobs]);

  useEffect(() => {
    // Fallback: If jobOptions is empty, attempt to fetch open jobs
    (async () => {
      if (!jobOptions || jobOptions.length === 0) {
        try {
          // Fetch up to 200 open jobs, ordered by creation date
          const list = await Job.filter({ status: "open" }, "-created_date", 200);
          setJobOptions(list || []);
        } catch (error) {
          console.error("Error fetching job options:", error);
          // Ignore error silently as it's a fallback
        }
      }
    })();
     
  }, [jobOptions.length]); // Depend on jobOptions.length to trigger only if no jobs are present initially or after first load

  const loadAssociatedData = useCallback(async () => {
    try {
      const [
        jobsData,
        applicationsData,
        submissionsData,
        tasksData,
        resumesData,
        companiesData
      ] = await Promise.all([
        Job.list(),
        Application.filter({ candidate_id: candidate.id }),
        Submission.filter({ candidate_id: candidate.id }),
        Task.filter({ related_entity: "candidate", related_id: candidate.id }),
        Resume.filter({ candidate_id: candidate.id }),
        Company.list()
      ]);
      setJobs(jobsData);
      setApplications(applicationsData);
      setSubmissions(submissionsData);
      setTasks(tasksData);
      setResumes(resumesData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error loading associated data:", error);
    }
  }, [candidate.id]);

  useEffect(() => {
    loadAssociatedData();
  }, [loadAssociatedData]);

  // Sync statusValue with candidate.status if candidate prop changes
  useEffect(() => {
    setStatusValue(candidate.status);
  }, [candidate.status]);

  const handleUpdate = async (candidateData) => {
    try {
      await Candidate.update(candidate.id, candidateData);
      setShowEditForm(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating candidate:", error);
    }
  };

  const handleApplyToJob = async () => {
    if (!selectedJob) return;
    setIsSubmitting(true);
    try {
      // Check if application already exists
      const existingApp = applications.find(app => app.job_id === selectedJob);
      if (existingApp) {
        alert("Candidate has already applied to this job.");
      } else {
        await Application.create({
          candidate_id: candidate.id,
          job_id: selectedJob,
          status: 'sourced', // Default status for new application
        });
        await loadAssociatedData(); // Reload data to include the new application
        setSelectedJob(""); // Reset selected job
      }
    } catch (error) {
      console.error("Error creating application:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScoreApplication = async (application, job) => {
    if (!job || !candidate) return;
    setIsScoring(application.id);

    try {
      const prompt = `
        You are an expert AI recruiting assistant. Analyze the following candidate's profile against the provided job description.
        Provide a concise analysis and a match score from 0 to 100.

        **Job Description:**
        Title: ${job.title}
        Description: ${job.description}
        Required Skills: ${job.required_skills?.join(", ")}

        **Candidate Profile:**
        Name: ${candidate.first_name} ${candidate.last_name}
        Current Title: ${candidate.current_title}
        Experience: ${candidate.experience_years} years
        Skills: ${candidate.skills?.join(", ")}

        Based on this, provide a JSON response with the candidate's match score and a breakdown of their fit.
      `;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            match_score: { type: "number", description: "Overall score from 0-100" },
            summary: { type: "string", description: "A brief summary of the candidate's fit." },
            strengths: { type: "array", items: { "type": "string" }, description: "List of key strengths." },
            gaps: { type: "array", items: { "type": "string" }, description: "List of gaps or missing requirements." }
          },
          required: ["match_score", "summary", "strengths", "gaps"]
        }
      });

      if (response && response.match_score !== undefined) {
        await Application.update(application.id, {
          match_score: response.match_score,
          score_details: response
        });
        await loadAssociatedData(); // Reload data to reflect the updated score
      } else {
        console.warn("AI scoring did not return a valid match_score.", response);
      }
    } catch (error) {
      console.error("Error scoring candidate:", error);
      addNotification({
        title: "Scoring Failed",
        message: "Failed to score application. Please try again.",
        type: "error"
      });
    } finally {
      setIsScoring(null);
    }
  };

  const statusItems = STAGES.map(stage => ({
    value: stage,
    label: stage.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
  }));

  const changeStatus = async (val) => {
    if (val === statusValue) return;
    setStatusUpdating(true);
    const oldStatus = statusValue; // Store old status for revert on error
    setStatusValue(val); // optimistic update
    try {
      await Candidate.update(candidate.id, { status: val });
      addNotification({
        title: "Status Updated",
        message: `${candidate.first_name}'s status changed to ${val.replace("_", " ")}.`,
        type: "success"
      });
    } catch (error) {
      console.error("Error updating candidate status:", error);
      setStatusValue(oldStatus); // revert on error
      addNotification({
        title: "Update Failed",
        message: "Could not update candidate status.",
        type: "error"
      });
    } finally {
      setStatusUpdating(false);
      onUpdate?.(); // Notify parent to refresh if needed
    }
  };

  const getAvailabilityText = (availability) => {
    const mapping = {
      immediately: "Immediately",
      "2_weeks": "2 Weeks",
      "1_month": "1 Month",
      negotiable: "Negotiable"
    };
    return mapping[availability] || availability;
  };

  const getWorkAuthText = (workAuth) => {
    const mapping = {
      citizen: "US Citizen",
      permanent_resident: "Permanent Resident",
      h1b: "H1B",
      opt: "OPT",
      other: "Other"
    };
    return mapping[workAuth] || workAuth;
  };

  const getCompanyForJob = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return null;
    return companies.find(c => c.id === job.company_id) || null;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header (Apple-like clean bar) */}
      <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 text-white flex items-center justify-center text-lg font-semibold">
              {(candidate.first_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">
                  {candidate.first_name} {candidate.last_name}
                </h1>
                <Badge className={getStatusColor(statusValue)}>
                  {statusValue?.replace("_", " ")}
                </Badge>
                {typeof candidate.bench_match_score === "number" && (
                  <Badge className={candidate.bench_match_score >= 75 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                    Bench Score: {Math.round(candidate.bench_match_score)}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-slate-600 flex flex-wrap gap-3 mt-1">
                {candidate.email && <span>{candidate.email}</span>}
                {candidate.phone && <span>• {candidate.phone}</span>}
                {candidate.location && <span>• {candidate.location}</span>}
                {candidate.current_title && <span>• {candidate.current_title}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onBack} title="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowEditForm(true)} className="gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </div>

        {/* Status Path */}
        <PermissionGate entity="Candidate" action="update">
          <div className="mt-4">
            <StatusPath items={statusItems} value={statusValue} onChange={changeStatus} loading={statusUpdating} entity="candidate" />
            {statusUpdating && <p className="text-xs text-slate-500 mt-2">Updating status…</p>}
          </div>
        </PermissionGate>
      </div>

      {/* Related Links Quick Links */}
      <RelatedQuickLinks
        items={[
          { id: "section-applications", label: "Applications", count: applications.length },
          { id: "section-submissions", label: "Submissions", count: submissions.length },
          { id: "section-tasks", label: "Tasks", count: tasks.length },
          { id: "section-resumes", label: "Resumes", count: resumes.length },
        ]}
      />

      {/* Main two-column layout similar to the reference screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Professional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-slate-500">Current Title</label>
                  <p className="font-semibold text-slate-900">{candidate.current_title || "Not specified"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Current Company</label>
                  <p className="font-semibold text-slate-900">{candidate.current_company || "Not specified"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Salary Expectation</label>
                  <p className="font-semibold text-slate-900">
                    {candidate.salary_expectation ? `$${candidate.salary_expectation.toLocaleString()}` : "Not specified"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500">Work Authorization</label>
                  <p className="font-semibold text-slate-900">
                    {getWorkAuthText(candidate.work_authorization) || "Not specified"}
                  </p>
                </div>
              </div>

              {candidate.skills && candidate.skills.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-500 block mb-3">Skills</label>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {candidate.notes && (
                <div>
                  <label className="text-sm font-medium text-slate-500 block mb-2">Notes</label>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-slate-700">{candidate.notes}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoCard
                icon={Clock}
                title="Availability"
                value={getAvailabilityText(candidate.availability)}
              />
              <InfoCard
                icon={DollarSign}
                title="Salary Range"
                value={candidate.salary_expectation ? `$${candidate.salary_expectation.toLocaleString()}` : null}
              />
              <InfoCard
                icon={Calendar}
                title="Added"
                value={new Date(candidate.created_date).toLocaleDateString()}
              />
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidate.linkedin_url && (
                <a
                  href={candidate.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink className="w-4 h-4" />
                  LinkedIn Profile
                </a>
              )}
              {candidate.resume_url && (
                <a
                  href={candidate.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <FileText className="w-4 h-4" />
                  View Resume
                </a>
              )}
            </CardContent>
          </Card>

          {/* Related Records */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Related Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded border">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <Briefcase className="w-4 h-4 text-slate-500" />
                    Applications
                  </div>
                  <div className="text-2xl font-bold">{applications.length}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <ClipboardList className="w-4 h-4 text-slate-500" />
                    Submissions
                  </div>
                  <div className="text-2xl font-bold">{submissions.length}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <ListChecks className="w-4 h-4 text-slate-500" />
                    Tasks
                  </div>
                  <div className="text-2xl font-bold">{tasks.length}</div>
                </div>
                <div className="p-3 rounded border">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <FileText className="w-4 h-4 text-slate-500" />
                    Resumes
                  </div>
                  <div className="text-2xl font-bold">{resumes.length}</div>
                </div>
              </div>

              {/* Recent items */}
              {applications.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-500">Recent Applications:</p>
                  {applications.slice(0, 3).map(app => {
                    const job = jobs.find(j => j.id === app.job_id);
                    const co = job ? companies.find(c => c.id === job.company_id) : null;
                    return (
                      <div key={app.id} className="text-sm flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {job?.title || "Application"}
                          </div>
                          <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> {co?.name || "—"} • {app.status}
                          </div>
                        </div>
                        {typeof app.match_score === "number" && (
                          <div className="text-xs font-semibold">{Math.round(app.match_score)}%</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent Submissions (linked) */}
              {submissions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-500">Recent Submissions:</p>
                  {submissions.slice(0, 3).map(s => {
                    const job = jobs.find(j => j.id === s.job_id);
                    return (
                      <div key={s.id} className="text-sm flex items-center justify-between">
                        <div className="min-w-0">
                          <Link
                            to={createPageUrl("Submissions")}
                            className="font-medium text-blue-600 hover:underline truncate"
                            title="Open Submissions"
                          >
                            {job?.title || "Submission"} • {s.status?.replace("_"," ")}
                          </Link>
                          <div className="text-xs text-slate-500">
                            Submitted {new Date(s.submitted_date || s.created_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Open Tasks (linked) */}
              {tasks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-500">Open Tasks:</p>
                  {tasks
                    .filter(t => t.status !== "completed")
                    .slice(0, 3)
                    .map(t => (
                      <div key={t.id} className="text-sm flex items-center justify-between">
                        <Link
                          to={createPageUrl(`TaskDetails?id=${t.id}`)}
                          className="font-medium text-blue-600 hover:underline truncate"
                        >
                          {t.title}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {t.due_date ? new Date(t.due_date).toLocaleDateString() : "No due date"}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Summary */}
          <CandidateAISummary
            candidate={candidate}
            applications={applications}
            jobs={jobs}
            submissions={submissions}
            tasks={tasks}
            resumes={resumes}
          />
        </div>

        {/* Right column: Activity pane */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-slate-600">No recent activity.</div>
              {/* This section can be extended later with actual activity logs */}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Anchored sections to match Related Quick Links */}
      <div id="section-applications" className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Job Applications</CardTitle>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                const el = applyBlockRef.current || document.getElementById("apply-to-job-panel");
                (el || document.getElementById("section-applications"))?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              title="Create a new application"
            >
              <Plus className="w-4 h-4" />
              New Application
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              ref={applyBlockRef}
              id="apply-to-job-panel"
              className="p-4 border rounded-lg bg-slate-50"
            >
              <h4 className="font-semibold">Apply to a new job</h4>
              <div className="flex gap-2 mt-2">
                {/* CHANGED: use jobOptions instead of jobs */}
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobOptions
                      .filter(j => !applications.some(a => a.job_id === j.id))
                      .map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.title} ({getCompanyForJob(job.id)?.name || "N/A"})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleApplyToJob} disabled={!selectedJob || isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Apply
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.length > 0 ? applications.map(app => {
                  const job = jobs.find(j => j.id === app.job_id);
                  const company = getCompanyForJob(app.job_id);
                  if (!job) return null;
                  return (
                    <TableRow key={app.id}>
                      <TableCell>
                        <Link to={createPageUrl("job", job.id)} className="font-medium text-blue-600 hover:underline">
                          {job.title}
                        </Link>
                        <p className="text-sm text-slate-500">{job.location}</p>
                      </TableCell>
                      <TableCell>{company?.name || "N/A"}</TableCell>
                      <TableCell><Badge variant="outline">{app.status}</Badge></TableCell>
                      <TableCell>
                        <ScoreDisplay score={app.match_score} details={app.score_details} />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScoreApplication(app, job)}
                          disabled={isScoring === app.id}
                          className="gap-2"
                        >
                          {isScoring === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                          {app.match_score ? 'Rescore' : 'Score'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">No applications yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div id="section-submissions" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.length > 0 ? submissions.map(s => {
                  const job = jobs.find(j => j.id === s.job_id);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{job?.title || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell>{new Date(s.submitted_date || s.created_date).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24 text-slate-500">No submissions.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div id="section-tasks" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {tasks.length > 0 ? tasks.map(t => (
                <li key={t.id} className="flex items-center justify-between border rounded p-2">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-slate-500">{t.due_date ? new Date(t.due_date).toLocaleDateString() : "No due date"}</span>
                </li>
              )) : <div className="text-slate-500">No tasks.</div>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div id="section-resumes" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {resumes.length > 0 ? resumes.map(r => (
                <li key={r.id} className="flex items-center justify-between border rounded p-2">
                  <span className="truncate">{r.name || candidate.first_name + " " + candidate.last_name + " Resume"}</span>
                  {r.file_url && (
                    <a className="text-blue-600 hover:underline" href={r.file_url} target="_blank" rel="noreferrer">Open</a>
                  )}
                </li>
              )) : <div className="text-slate-500">No resumes.</div>}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <CandidateForm
          candidate={candidate}
          onSave={handleUpdate}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </div>
  );
}
