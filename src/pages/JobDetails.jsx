
import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/common/PageHeader";
import {
  Building2,
  MapPin,
  Briefcase,
  DollarSign,
  Calendar,
  Edit,
  Users,
  ArrowLeft,
  Mail,
  Sparkles,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Application } from "@/entities/Application";
import { Candidate } from "@/entities/Candidate";
import { Company } from "@/entities/Company";
import { Job } from "@/entities/Job";
import * as Core from "@/integrations/Core";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import JobForm from "@/components/jobs/JobForm";
import EmailBlastModal from "@/components/jobs/EmailBlastModal";
import RelatedQuickLinks from "@/components/common/RelatedQuickLinks";
import RecommendedCandidates from "@/components/ai/RecommendedCandidates";
import ContextualSuggestions from "@/components/playbooks/ContextualSuggestions";

export default function JobDetails() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get("id");

  const [job, setJob] = useState(null);
  const [company, setCompany] = useState(null);
  const [applications, setApplications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showEmailBlast, setShowEmailBlast] = useState(false);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [screeningQuestions, setScreeningQuestions] = useState(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  useEffect(() => {
    const loadJobDetails = async () => {
      if (!jobId) {
        setLoading(false);
        return;
      }

      try {
        const [jobData, appsData] = await Promise.all([
          Job.get(jobId),
          Application.filter({ job_id: jobId })
        ]);

        setJob(jobData);
        setApplications(appsData || []);

        // Gracefully handle missing company reference
        if (jobData?.company_id) {
          try {
            const companyData = await Company.get(jobData.company_id);
            setCompany(companyData);
          } catch (companyError) {
            console.warn("Company not found for job:", jobData.company_id, companyError);
            // Set company to null but don't crash the page
            setCompany(null);
          }
        }

        if (appsData?.length > 0) {
          const candidateIds = [...new Set(appsData.map(app => app.candidate_id))];
          const candidatesData = await Promise.all(
            candidateIds.map(id => Candidate.get(id).catch(() => null))
          );
          setCandidates(candidatesData.filter(c => c));
        }
      } catch (error) {
        console.error("Error loading job details:", error);
      }
      setLoading(false);
    };

    loadJobDetails();
  }, [jobId]);

  const generateScreeningQuestions = async () => {
    if (!job || loadingQuestions) return;

    setLoadingQuestions(true);
    try {
      const prompt = `You are an expert technical recruiter. Generate screening interview questions for this job posting.

Job Details:
- Title: ${job.title}
- Description: ${job.description || 'N/A'}
- Requirements: ${job.requirements || 'N/A'}
- Required Skills: ${job.required_skills?.join(', ') || 'N/A'}
- Experience Required: ${job.experience_required ? `${job.experience_required}+ years` : 'Not specified'}

Generate exactly 3 screening questions:
1. **Easy Question**: Basic knowledge check (entry-level understanding)
2. **Mid-Level Question**: Intermediate technical/situational question
3. **Complex Question**: Advanced scenario-based or architectural question

For EACH question, provide:
- The question text
- A detailed model answer (what a strong candidate would say)
- Key points to look for in the candidate's response
- Red flags to watch out for

Make questions specific to the role, not generic. Focus on skills, experience, and job requirements.`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  level: { type: "string", enum: ["Easy", "Mid-Level", "Complex"] },
                  question: { type: "string" },
                  model_answer: { type: "string" },
                  key_points: { type: "array", items: { type: "string" } },
                  red_flags: { type: "array", items: { type: "string" } }
                },
                required: ["level", "question", "model_answer", "key_points", "red_flags"]
              }
            }
          },
          required: ["questions"]
        }
      });

      setScreeningQuestions(response.questions || []);
    } catch (error) {
      console.error("Error generating screening questions:", error);
      setScreeningQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Auto-generate screening questions when job loads
  useEffect(() => {
    // Only generate if job is loaded, questions haven't been generated yet, and we're not currently loading them
    if (job && screeningQuestions === null && !loadingQuestions) {
      generateScreeningQuestions();
    }
  }, [job, screeningQuestions, loadingQuestions]);

  const handleSaveJob = async (updatedJob) => {
    await Job.update(jobId, updatedJob);
    const refreshed = await Job.get(jobId);
    setJob(refreshed);
    setShowEditForm(false);
  };

  const scrollToAI = () => {
    setShowAIRecommendations(true);
    setTimeout(() => {
      const element = document.getElementById('ai-recommendations');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <Card className="animate-pulse h-48" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 lg:p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-slate-600">Job not found</p>
            <Button onClick={() => navigate(createPageUrl("Jobs"))} className="mt-4">
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColor = {
    draft: "bg-gray-100 text-gray-800",
    open: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    filled: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800"
  }[job.status] || "bg-gray-100 text-gray-800";

  const priorityColor = {
    low: "bg-blue-100 text-blue-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800"
  }[job.priority] || "bg-gray-100 text-gray-800";

  const relatedLinks = [
    {
      id: 'applications',
      label: "Applications",
      count: applications.length,
      onClick: () => navigate(createPageUrl("Submissions") + `?job_id=${jobId}`)
    },
    {
      id: 'company',
      label: "Company",
      onClick: () => company && navigate(createPageUrl("CompanyDetails") + `?id=${company.id}`)
    },
    {
      id: 'ai-matches',
      label: "AI Matches",
      onClick: scrollToAI
    }
  ];

  // Prepare context for playbook suggestions
  const playbookContext = job ? {
    type: "job",
    job_id: job.id,
    title: job.title,
    category: job.employment_type,
    required_skills: job.required_skills || [],
    experience_required: job.experience_required,
    remote_type: job.remote_type,
    priority: job.priority,
    status: job.status,
    company_id: job.company_id
  } : null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title={job.title}
        subtitle={company ? `${company.name} • ${job.location || "Remote"}` : job.location || "Remote"}
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(createPageUrl("Jobs"))}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button variant="outline" onClick={scrollToAI} className="gap-2">
              <Sparkles className="w-4 h-4" />
              AI Matches
            </Button>
            <Button variant="outline" onClick={() => setShowEmailBlast(true)}>
              <Mail className="w-4 h-4 mr-1" />
              Email Blast
            </Button>
            <Button onClick={() => setShowEditForm(true)}>
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
          </div>
        }
      />

      <RelatedQuickLinks links={relatedLinks} />

      {/* Add Contextual Playbook Suggestions after Job Details */}
      {job && (
        <ContextualSuggestions context={playbookContext} autoLoad={true} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Job Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={statusColor}>{job.status?.replace("_", " ")}</Badge>
              <Badge className={priorityColor}>{job.priority} priority</Badge>
              {job.remote_type && (
                <Badge variant="outline">{job.remote_type.replace("_", " ")}</Badge>
              )}
              {job.employment_type && (
                <Badge variant="outline">{job.employment_type.replace("_", " ")}</Badge>
              )}
            </div>

            {job.description && (
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {job.requirements && (
              <div>
                <h3 className="font-medium mb-2">Requirements</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}

            {job.required_skills && job.required_skills.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.required_skills.map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="bg-blue-50">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {job.preferred_skills && job.preferred_skills.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Preferred Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {job.preferred_skills.map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="bg-green-50">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {company && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Company</div>
                    <div className="font-medium">{company.name}</div>
                  </div>
                </div>
              )}

              {job.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Location</div>
                    <div className="font-medium">{job.location}</div>
                  </div>
                </div>
              )}

              {job.rate && (
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Rate/Salary</div>
                    <div className="font-medium">{job.rate}</div>
                  </div>
                </div>
              )}

              {job.experience_required && (
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Experience Required</div>
                    <div className="font-medium">{job.experience_required} years</div>
                  </div>
                </div>
              )}

              {job.due_date && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Target Fill Date</div>
                    <div className="font-medium">
                      {new Date(job.due_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}

              {job.positions_available && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-slate-500 mt-0.5" />
                  <div>
                    <div className="text-sm text-slate-500">Positions</div>
                    <div className="font-medium">{job.positions_available}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Applications ({applications.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="space-y-2">
                  {applications.slice(0, 5).map(app => {
                    const candidate = candidates.find(c => c.id === app.candidate_id);
                    return (
                      <Link
                        key={app.id}
                        to={createPageUrl("CandidateDetails") + `?id=${app.candidate_id}`}
                        className="block p-3 border rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown"}
                            </div>
                            <div className="text-xs text-slate-500">{app.status}</div>
                          </div>
                          {app.match_score && (
                            <Badge variant="outline">{app.match_score}% match</Badge>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                  {applications.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(createPageUrl("Submissions") + `?job_id=${jobId}`)}
                    >
                      View All {applications.length} Applications
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No applications yet</p>
              )}
            </CardContent>
          </Card>

          {/* NEW: Screening Questions Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Screening Questions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={generateScreeningQuestions}
                disabled={loadingQuestions}
                className="h-8"
              >
                <RefreshCw className={`w-3 h-3 ${loadingQuestions ? 'animate-spin' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingQuestions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                  <span className="text-sm text-slate-600">Generating questions...</span>
                </div>
              ) : screeningQuestions && screeningQuestions.length > 0 ? (
                <div className="space-y-4">
                  {screeningQuestions.map((q, idx) => (
                    <div key={idx} className="border-l-4 border-purple-400 pl-4 py-2 bg-purple-50 rounded-r">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={
                          q.level === "Easy" ? "bg-green-100 text-green-800" :
                          q.level === "Mid-Level" ? "bg-blue-100 text-blue-800" :
                          "bg-red-100 text-red-800"
                        }>
                          {q.level}
                        </Badge>
                      </div>

                      <p className="text-sm font-semibold text-slate-900 mb-2">{q.question}</p>

                      <details className="text-xs text-slate-700">
                        <summary className="cursor-pointer text-purple-700 font-medium mb-1">
                          View Model Answer
                        </summary>
                        <div className="mt-2 space-y-2 pl-2">
                          <p className="bg-white p-2 rounded border border-purple-200">
                            <strong>Answer:</strong> {q.model_answer}
                          </p>

                          {q.key_points && q.key_points.length > 0 && (
                            <div>
                              <strong className="text-green-700">Key Points:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-0.5">
                                {q.key_points.map((point, i) => (
                                  <li key={i} className="text-green-800">{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {q.red_flags && q.red_flags.length > 0 && (
                            <div>
                              <strong className="text-red-700">Red Flags:</strong>
                              <ul className="list-disc list-inside mt-1 space-y-0.5">
                                {q.red_flags.map((flag, i) => (
                                  <li key={i} className="text-red-800">{flag}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  Click refresh to generate screening questions
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Recommended Candidates Section - Now embedded on page */}
      {showAIRecommendations && <RecommendedCandidates job={job} />}

      {showEditForm && (
        <JobForm
          job={job}
          onSave={handleSaveJob}
          onCancel={() => setShowEditForm(false)}
        />
      )}

      {showEmailBlast && (
        <EmailBlastModal
          jobs={[job]}
          onClose={() => setShowEmailBlast(false)}
        />
      )}
    </div>
  );
}
