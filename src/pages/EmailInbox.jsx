
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Inbox,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Eye,
  Briefcase,
  Users,
  FileText,
  Plus,
  Send
} from "lucide-react";
import { InboundEmail } from "@/entities/InboundEmail";
import { Job } from "@/entities/Job";
import { Candidate } from "@/entities/Candidate";
import { Company } from "@/entities/Company";
import { Application } from "@/entities/Application";
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile, SendEmail } from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import PageHeader from "@/components/common/PageHeader";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

function detectRemoteType(s = "") {
  const t = (s || "").toLowerCase();
  if (t.includes("remote")) return "remote";
  if (t.includes("hybrid")) return "hybrid";
  return "onsite";
}

function detectContractType(s = "") {
  const t = (s || "").toLowerCase();
  if (/\bc2c\b|corp\s*to\s*corp/.test(t)) return "c2c";
  if (/\bw-?2\b/.test(t)) return "w2";
  if (/\b1099\b/.test(t)) return "1099";
  return "unknown";
}

function extractJobIdFromSubject(subject = "") {
  const patterns = [
    /job\s*id\s*[:-]?\s*([a-z0-9\-_]+)/i,
    /job[:-]?\s*([a-z0-9\-_]+)/i,
    /#([a-z0-9\-_]+)/i,
    /\[([a-z0-9\-_]+)\]/i
  ];
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

export default function EmailInbox() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Manual paste/upload form
  const [fromEmail, setFromEmail] = useState("");
  const [toEmail, setToEmail] = useState("talentstackjobs@gmail.com");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);

  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Job requirements bulk upload
  const [requirementsText, setRequirementsText] = useState("");
  const [requirementsFile, setRequirementsFile] = useState(null);
  const [parsingRequirements, setParsingRequirements] = useState(false);
  const [parsedJobs, setParsedJobs] = useState([]);
  const [creatingJobs, setCreatingJobs] = useState(false);
  const [jobsCreated, setJobsCreated] = useState(0);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const data = await InboundEmail.list("-created_date", 100);
      setEmails(data || []);
    } catch (error) {
      console.error("Error loading emails:", error);
      addNotification({ type: "error", title: "Load failed", message: "Could not load emails" });
      setEmails([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEmails();
  }, []);

  const handleFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    
    try {
      const { file_url } = await UploadFile({ file: f });
      const text = await fetch(file_url).then(r => r.text());
      setBody(text);
      
      if (f.name.endsWith(".eml") || f.name.endsWith(".txt")) {
        const fromMatch = text.match(/^From:\s*(.+)$/m);
        const toMatch = text.match(/^To:\s*(.+)$/m);
        const subjectMatch = text.match(/^Subject:\s*(.+)$/m);
        
        if (fromMatch) setFromEmail(fromMatch[1].trim());
        if (toMatch) {
          const recipient = toMatch[1].toLowerCase();
          if (recipient.includes("talentstackjobs")) setToEmail("talentstackjobs@gmail.com");
          else if (recipient.includes("resumes@talestack.org")) setToEmail("resumes@talestack.org");
        }
        if (subjectMatch) setSubject(subjectMatch[1].trim());
      }
      
      addNotification({ type: "success", title: "File uploaded", message: "Email content loaded" });
    } catch (error) {
      console.error("Error uploading file:", error);
      addNotification({ type: "error", title: "Upload failed", message: "Could not process file" });
    }
  };

  const handleRequirementsFileUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRequirementsFile(f);
    
    try {
      addNotification({ type: "info", title: "Uploading", message: "Processing file..." });
      const { file_url } = await UploadFile({ file: f });
      
      // Only PDF is supported by ExtractDataFromUploadedFile for robust text extraction
      if (f.name.endsWith(".pdf")) {
        const extracted = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              text_content: { type: "string" }
            }
          }
        });
        
        if (extracted.status === "success" && extracted.output?.text_content) {
          setRequirementsText(extracted.output.text_content);
          addNotification({ type: "success", title: "File processed", message: "Content extracted from PDF" });
        } else {
          // If PDF extraction fails, it's an error, not a fallback to raw text which won't work for PDF.
          throw new Error("Failed to extract text from PDF. Please ensure it's a text-searchable PDF.");
        }
      } else if (f.name.endsWith(".txt")) {
        // Plain text files can be fetched directly
        const text = await fetch(file_url).then(r => r.text());
        setRequirementsText(text);
        addNotification({ type: "success", title: "File loaded", message: "Text content loaded" });
      } else {
        // Unsupported format
        setRequirementsFile(null); // Clear the file selection
        addNotification({ 
          type: "error", 
          title: "Unsupported file type", 
          message: "Please use PDF or TXT files, or paste the content directly into the text box.",
          duration: 8000
        });
        // IMPORTANT: Return here to stop execution for unsupported files
        return; 
      }
    } catch (error) {
      console.error("Error uploading requirements file:", error);
      setRequirementsFile(null); // Clear file on error as well
      addNotification({ 
        type: "error", 
        title: "Upload failed", 
        message: error.message || "Could not process file. Please paste the content as text instead.",
        duration: 8000
      });
    }
  };

  const parseJobRequirements = async () => {
    if (!requirementsText.trim()) {
      addNotification({ type: "warning", title: "No content", message: "Please paste or upload job requirements" });
      return;
    }

    setParsingRequirements(true);
    setParsedJobs([]);

    try {
      const prompt = `You are a job requirements parser. Extract ALL job postings from the text below.

Text:
"""
${requirementsText}
"""

For EACH job posting found, extract:
- client: Company name (REQUIRED)
- title: Job title (REQUIRED)
- location: City, State or "Remote"
- rate: Pay rate with period (e.g. "$80-85/hr C2C")
- remote_type: "onsite", "remote", or "hybrid"
- employment_type: "full_time", "part_time", "contract", or "contract_to_hire"
- contract_type: "c2c", "w2", "1099", or "unknown"
- description: Full job description (all details, responsibilities, requirements)
- top_skills: Array of 5-10 most important required skills/technologies
- experience_required: Minimum years of experience (number)
- location_requirements: Any location restrictions (e.g. "local only", "must be in state")

IMPORTANT:
- Return JSON array with ALL jobs found
- Do NOT skip any job postings
- For description, include ALL details from the original posting
- For top_skills, extract technical skills, tools, technologies, certifications
- Set employment_type="contract" if C2C/W2/1099 mentioned
- If rate not found, set null

Return ONLY valid JSON array, no markdown, no explanation.`;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            jobs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  client: { type: "string" },
                  title: { type: "string" },
                  location: { anyOf: [{ type: "string" }, { type: "null" }] },
                  rate: { anyOf: [{ type: "string" }, { type: "null" }] },
                  remote_type: { type: "string", enum: ["onsite", "remote", "hybrid"] },
                  employment_type: { type: "string", enum: ["full_time", "part_time", "contract", "contract_to_hire"] },
                  contract_type: { type: "string", enum: ["c2c", "w2", "1099", "unknown"] },
                  description: { type: "string" },
                  top_skills: { type: "array", items: { type: "string" } },
                  experience_required: { anyOf: [{ type: "number" }, { type: "null" }] },
                  location_requirements: { anyOf: [{ type: "string" }, { type: "null" }] }
                },
                required: ["client", "title"]
              }
            }
          }
        }
      });

      const jobs = result?.jobs || [];
      
      if (jobs.length === 0) {
        addNotification({ type: "warning", title: "No jobs found", message: "Could not extract job postings" });
        setParsingRequirements(false);
        return;
      }

      setParsedJobs(jobs);
      addNotification({ type: "success", title: `Found ${jobs.length} jobs`, message: "Review and create" });
    } catch (error) {
      console.error("Error parsing requirements:", error);
      addNotification({ type: "error", title: "Parsing failed", message: error.message || "Could not parse requirements" });
    }
    
    setParsingRequirements(false);
  };

  const createAllJobs = async () => {
    if (parsedJobs.length === 0) return;

    setCreatingJobs(true);
    setJobsCreated(0);

    const companies = await Company.list();
    const companyMap = new Map(companies.map(c => [c.name.toLowerCase().trim(), c.id]));

    let created = 0;
    const errors = [];

    for (const job of parsedJobs) {
      try {
        let companyId = null;
        const clientName = (job.client || "").trim();
        
        if (clientName) {
          const normalizedClient = clientName.toLowerCase().trim();
          companyId = companyMap.get(normalizedClient);
          
          if (!companyId) {
            const newCompany = await Company.create({
              name: clientName,
              status: "active",
              type: "client"
            });
            companyId = newCompany.id;
            companyMap.set(normalizedClient, companyId);
          }
        }

        if (!companyId) {
          errors.push(`Skipped "${job.title}" - no client name`);
          continue;
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const jobData = {
          title: job.title,
          company_id: companyId,
          location: job.location || "",
          rate: job.rate || "",
          remote_type: job.remote_type || "onsite",
          employment_type: job.employment_type || "contract",
          contract_type: job.contract_type || "unknown",
          description: job.description || "",
          requirements: (job.top_skills || []).join(", "),
          required_skills: job.top_skills || [],
          experience_required: job.experience_required || null,
          priority: "high",
          status: "open",
          due_date: tomorrow.toISOString().split("T")[0],
          location_preference: job.location_requirements || null
        };

        await Job.create(jobData);
        created++;
        setJobsCreated(created);
      } catch (error) {
        console.error(`Error creating job "${job.title}":`, error);
        errors.push(`Failed "${job.title}": ${error.message}`);
      }
    }

    setCreatingJobs(false);

    if (errors.length > 0) {
      addNotification({ 
        type: "warning", 
        title: `Created ${created}/${parsedJobs.length} jobs`, 
        message: `${errors.length} failed. Check console.`,
        duration: 8000
      });
      console.warn("Job creation errors:", errors);
    } else {
      addNotification({ 
        type: "success", 
        title: "All jobs created", 
        message: `Successfully created ${created} jobs`,
        duration: 6000
      });
    }

    // Reset form
    setRequirementsText("");
    setRequirementsFile(null);
    setParsedJobs([]);
    setJobsCreated(0);
  };

  const processJobEmail = async (emailRecord) => {
    try {
      const prompt = `You are a job requirement parser. Extract job details from the following email:

FROM: ${emailRecord.from_email || ""}
SUBJECT: ${emailRecord.subject || ""}
BODY:
${emailRecord.body || ""}

Extract and return ONLY valid JSON (no markdown, no explanation):
{
  "client_name": "company name",
  "title": "job title",
  "location": "city, state",
  "rate": "rate with currency and period (e.g. $70/hr)",
  "contract_type": "c2c|w2|1099|unknown",
  "remote_type": "onsite|remote|hybrid",
  "description": "full description",
  "requirements": "key requirements",
  "required_skills": ["skill1", "skill2"],
  "experience_years": number or null,
  "requester_name": "name if available",
  "requester_email": "original sender if forwarded"
}`;

      const res = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            client_name: { type: "string" },
            title: { type: "string" },
            location: { anyOf: [{ type: "string" }, { type: "null" }] },
            rate: { anyOf: [{ type: "string" }, { type: "null" }] },
            contract_type: { type: "string", enum: ["c2c", "w2", "1099", "unknown"] },
            remote_type: { type: "string", enum: ["onsite", "remote", "hybrid"] },
            description: { type: "string" },
            requirements: { type: "string" },
            required_skills: { type: "array", items: { type: "string" } },
            experience_years: { anyOf: [{ type: "number" }, { type: "null" }] },
            requester_name: { anyOf: [{ type: "string" }, { type: "null" }] },
            requester_email: { anyOf: [{ type: "string" }, { type: "null" }] }
          }
        }
      });

      if (!res.client_name || !res.title) {
        throw new Error("Missing required fields: client_name or title");
      }

      const companies = await Company.list();
      let company = companies.find(c => c.name.toLowerCase() === res.client_name.toLowerCase());
      
      if (!company) {
        company = await Company.create({
          name: res.client_name,
          status: "active",
          type: "client"
        });
      }

      const jobData = {
        title: res.title,
        company_id: company.id,
        location: res.location || "",
        rate: res.rate || "",
        contract_type: res.contract_type || "unknown",
        remote_type: res.remote_type || detectRemoteType(emailRecord.body),
        employment_type: ["c2c", "w2", "1099"].includes(res.contract_type) ? "contract" : "full_time",
        description: res.description || "",
        requirements: res.requirements || "",
        required_skills: res.required_skills || [],
        experience_required: res.experience_years || null,
        requester_email: res.requester_email || emailRecord.from_email,
        requester_name: res.requester_name || null,
        status: "open",
        priority: "high"
      };

      const job = await Job.create(jobData);

      await InboundEmail.update(emailRecord.id, {
        processed: true,
        processing_status: "completed",
        created_job_id: job.id,
        processing_notes: `Created job: ${job.title}`
      });

      return job;
    } catch (error) {
      await InboundEmail.update(emailRecord.id, {
        processing_status: "failed",
        processing_notes: error.message
      });
      throw error;
    }
  };

  const processResumeEmail = async (emailRecord) => {
    try {
      const jobId = extractJobIdFromSubject(emailRecord.subject || "");
      
      if (!jobId) {
        throw new Error("No job ID found in subject line");
      }

      const jobs = await Job.list();
      const job = jobs.find(j => j.id === jobId || (j.title && j.title.includes(jobId)));
      
      if (!job) {
        throw new Error(`Job with ID ${jobId} not found`);
      }

      const prompt = `Extract candidate details from this email:

FROM: ${emailRecord.from_email || ""}
SUBJECT: ${emailRecord.subject || ""}
BODY:
${emailRecord.body || ""}

Return ONLY valid JSON:
{
  "first_name": "string",
  "last_name": "string",
  "email": "email",
  "phone": "phone",
  "current_title": "current role",
  "location": "city, state",
  "experience_years": number or null,
  "skills": ["skill1", "skill2"],
  "summary": "brief summary of candidate background"
}`;

      const candidateData = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { anyOf: [{ type: "string" }, { type: "null" }] },
            current_title: { anyOf: [{ type: "string" }, { type: "null" }] },
            location: { anyOf: [{ type: "string" }, { type: "null" }] },
            experience_years: { anyOf: [{ type: "number" }, { type: "null" }] },
            skills: { type: "array", items: { type: "string" } },
            summary: { anyOf: [{ type: "string" }, { type: "null" }] }
          }
        }
      });

      const candidate = await Candidate.create({
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        email: candidateData.email,
        phone: candidateData.phone || "",
        current_title: candidateData.current_title || "",
        location: candidateData.location || "",
        experience_years: candidateData.experience_years || null,
        skills: candidateData.skills || [],
        status: "active"
      });

      const scorePrompt = `Score this candidate for the job. Return only JSON.

Job:
Title: ${job.title}
Description: ${job.description || ""}
Requirements: ${job.requirements || ""}
Required Skills: ${(job.required_skills || []).join(", ")}

Candidate:
Name: ${candidate.first_name} ${candidate.last_name}
Title: ${candidate.current_title || ""}
Experience: ${candidate.experience_years || "n/a"} years
Skills: ${(candidate.skills || []).join(", ")}
Summary: ${candidateData.summary || ""}

Respond with:
{
  "match_score": 0-100,
  "summary": "brief match analysis",
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"]
}`;

      const scoreResult = await InvokeLLM({
        prompt: scorePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            match_score: { type: "number" },
            summary: { type: "string" },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } }
          }
        }
      });

      const matchScore = Math.min(100, Math.max(0, scoreResult.match_score || 0));

      const application = await Application.create({
        candidate_id: candidate.id,
        job_id: job.id,
        status: "sourced",
        match_score: matchScore,
        score_details: scoreResult,
        notes: `Auto-created from email. Match score: ${matchScore}/100`
      });

      const responseBody = `Thank you for submitting ${candidate.first_name} ${candidate.last_name} for ${job.title}.

Match Score: ${matchScore}/100

${scoreResult.summary || ""}

Strengths:
${(scoreResult.strengths || []).map(s => `- ${s}`).join("\n")}

${scoreResult.gaps && scoreResult.gaps.length > 0 ? `Gaps:\n${scoreResult.gaps.map(g => `- ${g}`).join("\n")}` : ""}

We will review and get back to you shortly.

Best regards,
Talent Stack Team`;

      try {
        await SendEmail({
          to: emailRecord.from_email,
          subject: `Re: ${emailRecord.subject}`,
          body: responseBody
        });
        
        await InboundEmail.update(emailRecord.id, {
          response_sent: true
        });
      } catch (emailError) {
        console.warn("Could not send auto-response:", emailError);
      }

      await InboundEmail.update(emailRecord.id, {
        processed: true,
        processing_status: "completed",
        created_candidate_id: candidate.id,
        match_score: matchScore,
        processing_notes: `Created candidate and scored ${matchScore}/100 for job ${job.title}`
      });

      return { candidate, application, matchScore };
    } catch (error) {
      await InboundEmail.update(emailRecord.id, {
        processing_status: "failed",
        processing_notes: error.message
      });
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!fromEmail || !toEmail || !subject || !body) {
      addNotification({ type: "warning", title: "Missing fields", message: "Please fill all fields" });
      return;
    }

    setProcessing(true);

    try {
      const emailRecord = await InboundEmail.create({
        from_email: fromEmail,
        to_email: toEmail,
        subject: subject,
        body: body,
        received_date: new Date().toISOString(),
        processed: false,
        processing_status: "pending"
      });

      await InboundEmail.update(emailRecord.id, { processing_status: "processing" });

      if (toEmail.includes("talentstackjobs")) {
        const job = await processJobEmail(emailRecord);
        addNotification({ 
          type: "success", 
          title: "Job created", 
          message: `Created: ${job.title}`,
          duration: 6000
        });
      } else if (toEmail.includes("resumes@talestack")) {
        const result = await processResumeEmail(emailRecord);
        addNotification({ 
          type: "success", 
          title: "Candidate processed", 
          message: `${result.candidate.first_name} ${result.candidate.last_name} - Score: ${result.matchScore}/100`,
          duration: 8000
        });
      }

      setFromEmail("");
      setSubject("");
      setBody("");
      setFile(null);
      
      await loadEmails();
    } catch (error) {
      console.error("Error processing email:", error);
      addNotification({ type: "error", title: "Processing failed", message: error.message || "Could not process email" });
    }
    
    setProcessing(false);
  };

  const reprocessEmail = async (emailRecord) => {
    setProcessing(true);
    
    try {
      await InboundEmail.update(emailRecord.id, { 
        processing_status: "processing",
        processed: false
      });

      if (emailRecord.to_email?.includes("talentstackjobs")) {
        const job = await processJobEmail(emailRecord);
        addNotification({ 
          type: "success", 
          title: "Job created", 
          message: `Created: ${job.title}` 
        });
      } else if (emailRecord.to_email?.includes("resumes@talestack")) {
        const result = await processResumeEmail(emailRecord);
        addNotification({ 
          type: "success", 
          title: "Candidate processed", 
          message: `Score: ${result.matchScore}/100` 
        });
      }

      await loadEmails();
    } catch (error) {
      console.error("Error reprocessing:", error);
      addNotification({ type: "error", title: "Reprocess failed", message: error.message });
    }
    
    setProcessing(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800"
    };
    return <Badge className={colors[status] || "bg-gray-100 text-gray-800"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Email Inbox"
        subtitle="Process job postings and candidate submissions"
        right={
          <Button variant="outline" onClick={loadEmails} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      <Tabs defaultValue="paste" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paste">Paste Email</TabsTrigger>
          <TabsTrigger value="requirements">Job Requirements</TabsTrigger>
          <TabsTrigger value="history">Email History</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Paste or Upload Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">From Email</label>
                  <Input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    placeholder="sender@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">To Email</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                  >
                    <option value="talentstackjobs@gmail.com">talentstackjobs@gmail.com (Jobs)</option>
                    <option value="resumes@talestack.org">resumes@talestack.org (Resumes)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {toEmail.includes("talentstackjobs") 
                      ? "Job postings will create Job records" 
                      : "Resumes will create Candidates and match to jobs"}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    required
                  />
                  {toEmail.includes("resumes") && (
                    <p className="text-xs text-slate-500 mt-1">
                      Include Job ID in subject (e.g., "Resume for Job #123" or "[JOB-456]")
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium">Email Body</label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Paste email content here..."
                    rows={12}
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="email-file"
                    className="hidden"
                    accept=".eml,.txt"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("email-file").click()}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Email File
                  </Button>
                  {file && <span className="text-sm text-slate-600">{file.name}</span>}
                </div>

                <Button type="submit" disabled={processing} className="gap-2">
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Process Email
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requirements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Bulk Job Requirements Upload
              </CardTitle>
              <p className="text-sm text-slate-600">
                Paste or upload multiple job requirements. AI will extract and create all jobs with Priority=High, Status=Open, Due Date=Tomorrow.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Paste Job Requirements</label>
                <Textarea
                  value={requirementsText}
                  onChange={(e) => setRequirementsText(e.target.value)}
                  placeholder="Paste multiple job requirements here (separated by job entries)...&#10;&#10;Example:&#10;Client: Morgan Stanley&#10;Title: Python Developer&#10;Location: New York, NY&#10;Rate: $72/hr C2C&#10;...&#10;&#10;Client: Santander&#10;Title: Compliance Analyst&#10;..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="requirements-file"
                  className="hidden"
                  accept=".txt,.pdf"
                  onChange={handleRequirementsFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("requirements-file").click()}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload File (PDF or TXT)
                </Button>
                {requirementsFile && <span className="text-sm text-slate-600">{requirementsFile.name}</span>}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Only PDF and TXT files are supported. For Word documents (.doc/.docx), please save as PDF or copy-paste the text.
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={parseJobRequirements} 
                  disabled={parsingRequirements || !requirementsText.trim()}
                  className="gap-2"
                >
                  {parsingRequirements ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Parse Requirements
                    </>
                  )}
                </Button>

                {parsedJobs.length > 0 && (
                  <Button 
                    onClick={createAllJobs} 
                    disabled={creatingJobs}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {creatingJobs ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating {jobsCreated}/{parsedJobs.length}...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Create All {parsedJobs.length} Jobs
                      </>
                    )}
                  </Button>
                )}
              </div>

              {parsedJobs.length > 0 && (
                <div className="border rounded-lg p-4 space-y-3 max-h-[500px] overflow-y-auto">
                  <h3 className="font-semibold text-sm">Parsed Jobs ({parsedJobs.length})</h3>
                  {parsedJobs.map((job, idx) => (
                    <Card key={idx} className="p-3">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{job.title}</p>
                            <p className="text-sm text-slate-600">{job.client}</p>
                          </div>
                          <div className="flex gap-1">
                            <Badge variant="outline">{job.remote_type}</Badge>
                            <Badge className="bg-orange-100 text-orange-800">High</Badge>
                            <Badge className="bg-green-100 text-green-800">Open</Badge>
                          </div>
                        </div>
                        <div className="text-sm text-slate-700">
                          <p><strong>Location:</strong> {job.location || "Not specified"}</p>
                          <p><strong>Rate:</strong> {job.rate || "Not specified"}</p>
                          <p><strong>Contract:</strong> {job.contract_type}</p>
                          <p><strong>Top Skills:</strong> {(job.top_skills || []).slice(0, 5).join(", ")}</p>
                        </div>
                        {job.description && (
                          <details className="text-xs text-slate-600">
                            <summary className="cursor-pointer font-medium">Description</summary>
                            <p className="mt-2 whitespace-pre-wrap">{job.description.substring(0, 300)}...</p>
                          </details>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                Email Processing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center p-8 text-slate-600">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p>No emails processed yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email) => (
                    <Card key={email.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(email.processing_status)}
                            {email.response_sent && (
                              <Badge className="bg-purple-100 text-purple-800">
                                Response Sent
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium">{email.subject}</p>
                          <p className="text-sm text-slate-600">
                            From: {email.from_email} → To: {email.to_email}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(email.created_date).toLocaleString()}
                          </p>
                          {email.processing_notes && (
                            <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded">
                              {email.processing_notes}
                            </p>
                          )}
                          {email.match_score && (
                            <p className="text-sm mt-2">
                              <Badge className="bg-blue-100 text-blue-800">
                                Match Score: {email.match_score}/100
                              </Badge>
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmail(email);
                              setShowDetails(true);
                            }}
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {email.processing_status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => reprocessEmail(email)}
                              disabled={processing}
                              className="gap-2"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {email.created_job_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={createPageUrl(`JobDetails?id=${email.created_job_id}`)}>
                                <Briefcase className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                          {email.created_candidate_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <Link to={createPageUrl(`CandidateDetails?id=${email.created_candidate_id}`)}>
                                <Users className="w-4 h-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showDetails && selectedEmail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowDetails(false)}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Email Details</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowDetails(false)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">From:</p>
                <p className="text-sm">{selectedEmail.from_email}</p>
              </div>
              <div>
                <p className="text-sm font-medium">To:</p>
                <p className="text-sm">{selectedEmail.to_email}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Subject:</p>
                <p className="text-sm">{selectedEmail.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Body:</p>
                <div className="bg-slate-50 p-3 rounded text-sm whitespace-pre-wrap max-h-96 overflow-auto">
                  {selectedEmail.body}
                </div>
              </div>
              {selectedEmail.processing_notes && (
                <div>
                  <p className="text-sm font-medium">Processing Notes:</p>
                  <p className="text-sm text-slate-600">{selectedEmail.processing_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
