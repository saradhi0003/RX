import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText, Target, Users, Zap, Shield, Database, GitBranch,
  Search, ChevronDown, ChevronUp, Sparkles, MailPlus, Brain,
  BookOpen, List, Code, Briefcase, Send, CheckCircle, TrendingUp,
  Layers, Server, Lock, Activity, Settings, Globe, Bot, BarChart2,
  Cpu, AlertTriangle, ArrowRight, Box, Key, Download
} from "lucide-react";
import { downloadBRD } from "@/components/brd/downloadBRD";

// ── Mini Components ──────────────────────────────────────────────────────────

function Section({ id, icon: Icon, title, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFC] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#2563EB]" />
          </div>
          <span className="font-semibold text-[#1E293B] text-[15px]">{title}</span>
          {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7C3AED] text-white uppercase tracking-wider">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
      </button>
      {open && <div className="px-6 pb-6 pt-2 border-t border-[#F1F5F9]">{children}</div>}
    </div>
  );
}

function InfoCard({ color = "blue", title, children, className = "" }) {
  const colors = {
    blue: "border-l-[#2563EB] bg-[#EFF6FF]",
    purple: "border-l-[#7C3AED] bg-[#F5F3FF]",
    green: "border-l-[#16A34A] bg-[#F0FDF4]",
    orange: "border-l-[#D97706] bg-[#FFFBEB]",
    red: "border-l-[#DC2626] bg-[#FEF2F2]",
    slate: "border-l-[#475569] bg-[#F8FAFC]",
    pink: "border-l-[#DB2777] bg-[#FDF2F8]",
  };
  return (
    <div className={`border-l-4 rounded-r-lg p-4 ${colors[color]} ${className}`}>
      {title && <p className="font-semibold text-[13px] mb-2">{title}</p>}
      <div className="text-[13px] space-y-1">{children}</div>
    </div>
  );
}

function FieldRow({ name, type, required, isLookup, references, description }) {
  const typeColors = {
    string: "bg-blue-100 text-blue-800", number: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800", array: "bg-orange-100 text-orange-800",
    object: "bg-pink-100 text-pink-800", date: "bg-cyan-100 text-cyan-800",
  };
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9] text-[12px]">
      <code className="font-mono font-semibold text-[#1E293B] min-w-[160px] shrink-0">{name}</code>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeColors[type] || "bg-gray-100 text-gray-800"}`}>{type}</span>
      {required && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">required</span>}
      {isLookup && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">→ {references}</span>}
      <span className="text-[#64748B] flex-1">{description}</span>
    </div>
  );
}

function EntityBlock({ name, description, fields = [], relationships = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F8FAFC] text-left">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-[#2563EB]" />
          <span className="font-semibold text-[14px] text-[#1E293B]">{name}</span>
          <span className="text-[11px] text-[#94A3B8] border border-[#E2E8F0] rounded px-1.5 py-0.5">{fields.length} fields</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-[#F1F5F9] space-y-3 pt-3">
          {description && <p className="text-[13px] text-[#64748B]">{description}</p>}
          <div className="space-y-1.5">
            {fields.map((f, i) => <FieldRow key={i} {...f} />)}
          </div>
          {relationships.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Relationships</p>
              <div className="space-y-1">
                {relationships.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] bg-[#EFF6FF] rounded px-3 py-1.5">
                    <span className="font-medium text-[#2563EB]">{r.type}</span>
                    <ArrowRight className="w-3 h-3 text-[#94A3B8]" />
                    <span className="text-[#1E293B]">{r.with}</span>
                    <span className="text-[#64748B]">({r.description})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-[#F8FAFC] rounded p-2 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-[#94A3B8] mr-1 self-center">Auto fields:</span>
            {["id", "created_date", "updated_date", "created_by"].map(f => (
              <code key={f} className="text-[10px] border border-[#E2E8F0] bg-white rounded px-1.5 py-0.5">{f}</code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ code, language = "javascript" }) {
  return (
    <pre className="bg-[#0F172A] text-[#E2E8F0] rounded-xl p-4 overflow-x-auto text-[11px] leading-relaxed font-mono">
      {code}
    </pre>
  );
}

function LayerCard({ icon: Icon, color, title, items }) {
  return (
    <div className={`border-l-4 ${color} bg-white border border-[#E2E8F0] rounded-r-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#2563EB]" />
        <p className="font-semibold text-[13px] text-[#1E293B]">{title}</p>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[12px] text-[#475569] flex items-start gap-2">
            <span className="text-[#94A3B8] mt-0.5">•</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const entities = {
  core: [
    {
      name: "Candidate", description: "Core entity representing job seekers, consultants, and bench talent in the recruitment pipeline.",
      fields: [
        { name: "first_name", type: "string", required: true, description: "First name" },
        { name: "last_name", type: "string", required: true, description: "Last name" },
        { name: "email", type: "string", required: true, description: "Email address" },
        { name: "phone", type: "string", description: "Phone number" },
        { name: "location", type: "string", description: "Current location" },
        { name: "linkedin_url", type: "string", description: "LinkedIn profile URL" },
        { name: "resume_url", type: "string", description: "Resume file URL (Base44 storage)" },
        { name: "skills", type: "array", description: "Technical and professional skills array" },
        { name: "experience_years", type: "number", description: "Total years of professional experience" },
        { name: "current_title", type: "string", description: "Current or most recent job title" },
        { name: "current_company", type: "string", description: "Current or most recent employer" },
        { name: "salary_expectation", type: "number", description: "Desired compensation" },
        { name: "availability", type: "string", description: "Availability (immediately | 2_weeks | 1_month | negotiable)" },
        { name: "status", type: "string", description: "Pipeline status: active | on_bench | our_bench | placed | inactive | do_not_contact | screened" },
        { name: "work_authorization", type: "string", description: "Work auth: citizen | permanent_resident | h1b | opt | other" },
        { name: "notes", type: "string", description: "Internal recruiter notes" },
        { name: "source", type: "string", description: "Sourcing channel (LinkedIn, referral, etc.)" },
        { name: "tags", type: "array", description: "Categorization tags" },
        { name: "bench_match_score", type: "number", description: "AI bulk bench score (0–100), persisted from BulkBenchScorer" },
        { name: "bench_score_details", type: "object", description: "Detailed AI scoring breakdown from bench scoring run" },
        { name: "screening_score", type: "number", description: "AI screening fit score (0–100) from CandidateScreening" },
        { name: "screening_date", type: "date", description: "Timestamp when screening was last performed" },
        { name: "screening_details", type: "object", description: "Detailed AI analysis: matching/missing qualifications, overall fit" },
        { name: "benchSalesRecruiterId", type: "string", description: "Linked bench sales recruiter user ID" },
        { name: "consultantVisaStatus", type: "string", description: "Consultant visa status picklist" },
        { name: "exclusiveCandidate", type: "boolean", description: "Exclusive representation flag" },
        { name: "archive", type: "boolean", description: "Archived (soft delete) flag" },
      ],
      relationships: [
        { type: "One-to-Many", with: "Application", description: "Candidates have multiple job applications" },
        { type: "One-to-Many", with: "Submission", description: "Candidates are submitted to multiple jobs" },
        { type: "One-to-Many", with: "Resume", description: "Candidates have versioned resumes" },
        { type: "One-to-Many", with: "OutreachMessage", description: "Candidates receive outreach messages" },
        { type: "One-to-Many", with: "InterviewSession", description: "Candidates are interviewed for jobs" },
        { type: "One-to-Many", with: "MatchFeedback", description: "AI match results tracked per candidate" },
      ]
    },
    {
      name: "Job", description: "Job openings and requirements from client companies. Drives the core matching and submission workflow.",
      fields: [
        { name: "title", type: "string", required: true, description: "Job title" },
        { name: "company_id", type: "string", required: true, isLookup: true, references: "Company", description: "Hiring company" },
        { name: "description", type: "string", description: "Full job description (HTML or text)" },
        { name: "requirements", type: "string", description: "Required qualifications" },
        { name: "location", type: "string", description: "Job location" },
        { name: "remote_type", type: "string", description: "Work arrangement: onsite | remote | hybrid" },
        { name: "employment_type", type: "string", description: "full_time | part_time | contract | contract_to_hire" },
        { name: "rate", type: "string", description: "Rate or salary (free text, e.g. '$120k–$150k')" },
        { name: "priority", type: "string", description: "Urgency: low | medium | high | urgent" },
        { name: "status", type: "string", description: "Lifecycle: draft | open | on_hold | filled | cancelled" },
        { name: "required_skills", type: "array", description: "Must-have technical skills" },
        { name: "preferred_skills", type: "array", description: "Nice-to-have skills" },
        { name: "experience_required", type: "number", description: "Minimum years of experience" },
        { name: "positions_available", type: "number", description: "Headcount to fill" },
        { name: "hiring_manager", type: "string", description: "Client hiring manager name" },
        { name: "due_date", type: "date", description: "Target fill date" },
        { name: "requester_email", type: "string", description: "Original requester email (parsed from inbound email)" },
        { name: "requester_name", type: "string", description: "Original requester name" },
        { name: "visa_restrictions", type: "string", description: "Work auth / visa notes from JD" },
        { name: "contract_type", type: "string", description: "Engagement model: c2c | w2 | 1099 | unknown" },
        { name: "salary_text", type: "string", description: "Raw salary text as found in JD" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Company", description: "Jobs belong to a company" },
        { type: "One-to-Many", with: "Application", description: "Jobs have multiple candidate applications" },
        { type: "One-to-Many", with: "Submission", description: "Jobs receive multiple recruiter submissions" },
        { type: "One-to-One", with: "JobStack", description: "Open jobs may be cloned to public job board" },
      ]
    },
    {
      name: "Company", description: "Client companies and connections. CRM-style entity with contacts and job access controls.",
      fields: [
        { name: "name", type: "string", required: true, description: "Company name" },
        { name: "industry", type: "string", description: "Industry sector" },
        { name: "website", type: "string", description: "Company website URL" },
        { name: "location", type: "string", description: "Primary office location" },
        { name: "description", type: "string", description: "Company overview" },
        { name: "type", type: "string", description: "client | internal" },
        { name: "status", type: "string", description: "active | prospect | inactive" },
        { name: "contacts", type: "array", description: "Array of {name, email, phone, title, is_primary}" },
        { name: "job_stack_access", type: "boolean", description: "Contacts receive Job Stack email notifications" },
        { name: "primary_phone", type: "string", description: "Primary contact phone (import helper)" },
      ],
      relationships: [
        { type: "One-to-Many", with: "Job", description: "Companies have multiple job openings" },
        { type: "One-to-Many", with: "Invoice", description: "Companies receive invoices" },
        { type: "One-to-Many", with: "Recruiter", description: "Company can have associated recruiters" },
      ]
    },
    {
      name: "Application", description: "Candidate applications to specific jobs. Core pipeline tracking entity.",
      fields: [
        { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate" },
        { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Target job" },
        { name: "status", type: "string", description: "Pipeline stage: sourced | applied | screening | submitted | interviewing | offered | hired | rejected | withdrawn" },
        { name: "stage_updated_date", type: "date", description: "Timestamp of last status change" },
        { name: "notes", type: "string", description: "Internal recruiter notes" },
        { name: "interview_dates", type: "array", description: "Array of {date, type, interviewer, notes, feedback}" },
        { name: "submitted_by", type: "string", description: "Submitting recruiter email" },
        { name: "client_feedback", type: "string", description: "Client/hiring manager feedback" },
        { name: "rejection_reason", type: "string", description: "Reason for rejection if applicable" },
        { name: "match_score", type: "number", description: "AI-generated match score (0–100)" },
        { name: "score_details", type: "object", description: "Full AI scoring breakdown: dimensions, strengths, concerns, recommendation" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Candidate", description: "Application belongs to a candidate" },
        { type: "Many-to-One", with: "Job", description: "Application is for a specific job" },
      ]
    },
  ],
  recruitment: [
    {
      name: "Submission", description: "Recruiter-initiated submissions of candidates to client jobs. Tracks follow-up and interview workflow.",
      fields: [
        { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate" },
        { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Target job" },
        { name: "recruiter_id", type: "string", required: true, description: "Submitting recruiter ID" },
        { name: "submitted_date", type: "date", description: "Submission timestamp" },
        { name: "status", type: "string", description: "submitted | under_review | interviewing | rejected | hired | withdrawn" },
        { name: "client_feedback", type: "string", description: "Feedback from client" },
        { name: "follow_up_date", type: "date", description: "Next follow-up date" },
        { name: "follow_up_completed", type: "boolean", description: "Follow-up completion flag" },
        { name: "interview_dates", type: "array", description: "Interview history with date, type, interviewer, feedback" },
        { name: "rate", type: "string", description: "Submitted rate (text)" },
        { name: "client", type: "string", description: "Client company name (denormalized)" },
        { name: "vendorName", type: "string", description: "Vendor/agency name" },
        { name: "technologyText", type: "string", description: "Technology stack text" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Candidate", description: "Submission is for a candidate" },
        { type: "Many-to-One", with: "Job", description: "Submission is for a job" },
      ]
    },
    {
      name: "Recruiter", description: "Internal and external recruiters. Performance tracking and territory management.",
      fields: [
        { name: "first_name", type: "string", required: true, description: "First name" },
        { name: "last_name", type: "string", required: true, description: "Last name" },
        { name: "email", type: "string", required: true, description: "Email" },
        { name: "phone", type: "string", description: "Phone" },
        { name: "company_id", type: "string", isLookup: true, references: "Company", description: "Associated company" },
        { name: "role", type: "string", description: "internal | external | freelance" },
        { name: "specializations", type: "array", description: "Recruiting specializations (e.g. Java, DevOps)" },
        { name: "territory", type: "string", description: "Geographic territory" },
        { name: "performance_metrics", type: "object", description: "placements_this_month, placements_this_year, revenue_generated" },
        { name: "commission_rate", type: "number", description: "Commission percentage" },
        { name: "status", type: "string", description: "active | inactive | on_leave" },
        { name: "is_marketing", type: "boolean", description: "Receives job marketing email blasts" },
      ],
      relationships: [
        { type: "One-to-Many", with: "Submission", description: "Recruiters create submissions" },
        { type: "One-to-Many", with: "Goal", description: "Recruiters have performance goals" },
        { type: "One-to-Many", with: "Timesheet", description: "Recruiters log time" },
        { type: "One-to-Many", with: "LeaveRequest", description: "Recruiters request leave" },
      ]
    },
    {
      name: "Resume", description: "Structured resume data for candidates. Supports versioning and AI-assisted building.",
      fields: [
        { name: "candidate_id", type: "string", isLookup: true, references: "Candidate", description: "Linked candidate" },
        { name: "name", type: "string", required: true, description: "Full display name" },
        { name: "headline", type: "string", description: "Short professional headline" },
        { name: "email", type: "string", description: "Contact email" },
        { name: "phone", type: "string", description: "Contact phone" },
        { name: "location", type: "string", description: "City, State" },
        { name: "summary", type: "string", description: "Professional summary paragraph" },
        { name: "experiences", type: "array", description: "Work history: [{company, role, start_date, end_date, bullets[]}]" },
        { name: "education", type: "array", description: "Education: [{school, degree, major, gpa, start_date, end_date}]" },
        { name: "projects", type: "array", description: "Projects: [{name, date, description[]}]" },
        { name: "skills", type: "array", description: "Skills keyword array" },
        { name: "theme_color", type: "string", description: "Accent color hex for resume preview" },
      ],
      relationships: [{ type: "Many-to-One", with: "Candidate", description: "Resume belongs to candidate" }]
    },
    {
      name: "OutreachMessage", description: "Tracks all communication with candidates across channels.",
      fields: [
        { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Target candidate" },
        { name: "job_id", type: "string", isLookup: true, references: "Job", description: "Related job (optional)" },
        { name: "subject", type: "string", required: true, description: "Email subject" },
        { name: "message", type: "string", required: true, description: "Message body" },
        { name: "message_type", type: "string", description: "Type of outreach (initial, follow_up, offer, etc.)" },
        { name: "channel", type: "string", description: "email | linkedin | phone | sms" },
        { name: "status", type: "string", description: "draft | sent | delivered | opened | replied" },
        { name: "response_received", type: "boolean", description: "Response flag" },
        { name: "sentiment", type: "string", description: "AI-classified response sentiment: positive | neutral | negative" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Candidate", description: "Outreach to candidate" },
        { type: "Many-to-One", with: "Job", description: "Related job" },
      ]
    },
    {
      name: "InterviewSession", description: "Interview scheduling, question tracking, scoring, and AI summaries.",
      fields: [
        { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate interviewed" },
        { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Job being interviewed for" },
        { name: "interview_date", type: "date", required: true, description: "Interview date/time" },
        { name: "interview_type", type: "string", required: true, description: "phone_screen | technical | behavioral | panel | final" },
        { name: "interviewer", type: "string", description: "Interviewer name or email" },
        { name: "status", type: "string", description: "scheduled | completed | cancelled | no_show" },
        { name: "questions", type: "array", description: "Array of {question, category, response, score}" },
        { name: "overall_score", type: "number", description: "Calculated overall interview score (0–100)" },
        { name: "recommendation", type: "string", description: "Hiring recommendation text" },
        { name: "ai_summary", type: "string", description: "AI-generated interview summary and evaluation" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Candidate", description: "Interview with candidate" },
        { type: "Many-to-One", with: "Job", description: "Interview for job" },
      ]
    },
  ],
  workflow: [
    {
      name: "Task", description: "Work items and follow-ups. Polymorphically links to any entity. Supports kanban and list views.",
      fields: [
        { name: "title", type: "string", required: true, description: "Task title" },
        { name: "description", type: "string", description: "Detailed description" },
        { name: "assigned_to", type: "string", required: true, description: "Assigned user email" },
        { name: "related_entity", type: "string", description: "Linked entity type: candidate | job | company | submission | general" },
        { name: "related_id", type: "string", description: "ID of linked entity record" },
        { name: "priority", type: "string", description: "low | medium | high | urgent" },
        { name: "status", type: "string", description: "pending | in_progress | completed | cancelled" },
        { name: "due_date", type: "date", description: "Task due date" },
        { name: "completion_notes", type: "string", description: "Notes added on completion" },
        { name: "tags", type: "array", description: "Tags for organization" },
      ],
      relationships: [{ type: "Polymorphic", with: "Candidate | Job | Company | Submission", description: "Links to any entity via related_entity + related_id" }]
    },
    {
      name: "Playbook", description: "Process documentation, best practices, and step-by-step guides. Supports AI-assisted smart search.",
      fields: [
        { name: "title", type: "string", required: true, description: "Playbook title" },
        { name: "description", type: "string", description: "Overview description" },
        { name: "category", type: "string", required: true, description: "onboarding | recruiting | client_management | procedures | templates | best_practices | interview_guides | compliance" },
        { name: "subcategory", type: "string", description: "Finer categorization" },
        { name: "documents", type: "array", description: "Linked docs: [{name, url, description, type}]" },
        { name: "steps", type: "array", description: "Process steps: [{title, description, order, checklist[], tips}]" },
        { name: "tags", type: "array", description: "Organizational tags" },
        { name: "keywords", type: "array", description: "AI search keywords" },
        { name: "usage_count", type: "number", description: "View count" },
        { name: "is_active", type: "boolean", description: "Active/published flag" },
        { name: "access_level", type: "string", description: "public | recruiter | manager | admin" },
        { name: "faqs", type: "array", description: "FAQ entries: [{question, answer}]" },
        { name: "version", type: "string", description: "Version number (e.g., '1.0')" },
      ],
      relationships: []
    },
    {
      name: "AutomationRule", description: "Event-driven workflow rules. Executes email sends or task creation on entity status transitions.",
      fields: [
        { name: "name", type: "string", required: true, description: "Rule name" },
        { name: "trigger_type", type: "string", required: true, description: "status_change | time_based | manual" },
        { name: "trigger_entity", type: "string", required: true, description: "Watching entity: Submission | Application | Task | Candidate" },
        { name: "trigger_status_from", type: "string", description: "Source status (any if omitted)" },
        { name: "trigger_status_to", type: "string", description: "Target status that fires the rule" },
        { name: "delay_minutes", type: "number", description: "Delay before executing action (browser setTimeout in current impl)" },
        { name: "action_type", type: "string", required: true, description: "send_email | create_task | send_notification" },
        { name: "email_template_id", type: "string", isLookup: true, references: "EmailTemplate", description: "Email template to use" },
        { name: "email_recipient_type", type: "string", description: "Recipient: candidate | recruiter | hiring_manager | custom" },
        { name: "email_custom_recipient", type: "string", description: "Custom email recipient address" },
        { name: "is_active", type: "boolean", description: "Rule enabled flag" },
        { name: "trigger_count", type: "number", description: "Total executions counter" },
        { name: "last_triggered", type: "date", description: "Last execution timestamp" },
      ],
      relationships: [{ type: "Many-to-One", with: "EmailTemplate", description: "Uses email template for send actions" }]
    },
    {
      name: "Goal", description: "Recruiter performance goals with progress tracking.",
      fields: [
        { name: "title", type: "string", required: true, description: "Goal title" },
        { name: "description", type: "string", description: "Detailed goal description" },
        { name: "recruiter_id", type: "string", required: true, description: "Assigned recruiter ID" },
        { name: "start_date", type: "date", required: true, description: "Goal start date" },
        { name: "end_date", type: "date", required: true, description: "Goal end date" },
        { name: "status", type: "string", description: "draft | active | completed | on_hold | cancelled" },
        { name: "progress", type: "number", description: "Progress percentage (0–100)" },
      ],
      relationships: [{ type: "Many-to-One", with: "Recruiter", description: "Goal assigned to recruiter" }]
    },
  ],
  ai: [
    {
      name: "MatchingProfile", description: "Configurable AI matching profiles with weighted criteria, model selection, and learning from feedback.",
      fields: [
        { name: "name", type: "string", required: true, description: "Profile name (e.g., 'Senior Engineer Match')" },
        { name: "job_id", type: "string", isLookup: true, references: "Job", description: "Optional specific job link" },
        { name: "job_type", type: "string", required: true, description: "technical | sales | marketing | operations | executive | general" },
        { name: "criteria_weights", type: "object", description: "Dimension weights summing to 100: {technical_skills, experience_years, role_seniority, domain_expertise, soft_skills, education, location_fit}" },
        { name: "required_skills", type: "array", description: "Skills with importance: [{skill, importance: must_have|preferred|nice_to_have, min_years}]" },
        { name: "soft_skills_keywords", type: "array", description: "Keywords to extract from profiles (e.g. 'leadership', 'autonomous')" },
        { name: "experience_range", type: "object", description: "{min_years, max_years, ideal_years}" },
        { name: "seniority_levels", type: "array", description: "Acceptable levels: intern | junior | mid | senior | lead | principal | executive" },
        { name: "ai_model", type: "string", description: "Model selection: o1 | claude-4.5 | gpt-5 | gpt-4o | auto" },
        { name: "matching_strategy", type: "string", description: "balanced | strict | lenient | learning" },
        { name: "learning_enabled", type: "boolean", description: "Adapt weights from feedback" },
        { name: "feedback_count", type: "number", description: "Total feedback entries received" },
        { name: "avg_feedback_score", type: "number", description: "Average user rating (0–5)" },
        { name: "performance_metrics", type: "object", description: "{total_matches, accepted_matches, rejected_matches, accuracy}" },
        { name: "is_active", type: "boolean", description: "Active profile flag" },
        { name: "is_default", type: "boolean", description: "Default profile for this user" },
      ],
      relationships: [{ type: "One-to-Many", with: "MatchFeedback", description: "Profile collects feedback entries" }]
    },
    {
      name: "MatchFeedback", description: "User feedback on AI match quality for continuous learning and profile improvement.",
      fields: [
        { name: "matching_profile_id", type: "string", isLookup: true, references: "MatchingProfile", description: "Profile used for match" },
        { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Matched candidate" },
        { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Matched job" },
        { name: "match_score", type: "number", required: true, description: "AI-generated score (0–100)" },
        { name: "match_details", type: "object", description: "Full scoring breakdown from AI" },
        { name: "user_rating", type: "number", description: "User star rating (1–5)" },
        { name: "user_action", type: "string", description: "viewed | contacted | interviewed | hired | rejected | skipped" },
        { name: "feedback_text", type: "string", description: "Free-text feedback on match quality" },
        { name: "criteria_accuracy", type: "object", description: "Per-dimension accuracy flags: {technical_skills_accurate, experience_accurate, soft_skills_accurate, overall_fit_accurate}" },
        { name: "suggested_improvements", type: "string", description: "User suggestions for improving matching" },
        { name: "ai_model_used", type: "string", description: "Model used for this match run" },
        { name: "was_helpful", type: "boolean", description: "Overall helpfulness flag" },
      ],
      relationships: [
        { type: "Many-to-One", with: "MatchingProfile", description: "Feedback tied to matching profile" },
        { type: "Many-to-One", with: "Candidate", description: "Feedback on candidate" },
        { type: "Many-to-One", with: "Job", description: "Feedback for job" },
      ]
    },
  ],
  admin: [
    {
      name: "User", description: "System users with roles, permissions, and access state.",
      fields: [
        { name: "email", type: "string", description: "Email address (built-in, read-only)" },
        { name: "full_name", type: "string", description: "Full name (built-in, read-only)" },
        { name: "role", type: "string", description: "Built-in role: admin | user" },
        { name: "role_id", type: "string", isLookup: true, references: "Role", description: "Custom role lookup (overrides built-in for permissions)" },
        { name: "status", type: "string", description: "active | inactive | invited" },
        { name: "is_locked", type: "boolean", description: "Account locked – forced logout on next load" },
        { name: "last_active", type: "date", description: "Last activity timestamp" },
      ],
      relationships: [{ type: "Many-to-One", with: "Role", description: "User has a custom role" }]
    },
    {
      name: "Role", description: "Permission roles defining entity-level access control matrix.",
      fields: [
        { name: "name", type: "string", required: true, description: "Role display name (e.g. Admin, Recruiter)" },
        { name: "description", type: "string", description: "Role description" },
        { name: "permissions", type: "object", required: true, description: "Map of entity → {view, create, update, delete, scope: all|own}" },
      ],
      relationships: [{ type: "One-to-Many", with: "User", description: "Role assigned to users" }]
    },
    {
      name: "AuditLog", description: "System audit trail for login events and key user actions.",
      fields: [
        { name: "user_email", type: "string", required: true, description: "Acting user email" },
        { name: "action", type: "string", required: true, description: "Action performed (e.g. 'login', 'update_status')" },
        { name: "ip", type: "string", description: "IP address (fetched via ipify)" },
        { name: "user_agent", type: "string", description: "Browser user agent string" },
        { name: "meta", type: "object", description: "Additional metadata (entity type, record ID, etc.)" },
      ],
      relationships: []
    },
    {
      name: "EmailTemplate", description: "Reusable email templates for automation rules, candidate outreach, and invoices.",
      fields: [
        { name: "title", type: "string", required: true, description: "Template title" },
        { name: "subject", type: "string", description: "Email subject line" },
        { name: "category", type: "string", description: "candidate_outreach | job_marketing | invoice | follow_up | internal_announcement | custom" },
        { name: "blocks", type: "array", description: "Structured content blocks for email builder" },
        { name: "html_body", type: "string", description: "Rendered HTML for sending" },
        { name: "preview_text", type: "string", description: "Preview text for email clients" },
        { name: "tags", type: "array", description: "Searchable tags" },
        { name: "is_active", type: "boolean", description: "Active/published flag" },
      ],
      relationships: [{ type: "One-to-Many", with: "AutomationRule", description: "Templates used by automation rules" }]
    },
    {
      name: "AppSettings", description: "Application-level configuration. Email provider settings gate all email functionality.",
      fields: [
        { name: "email_provider", type: "string", required: true, description: "none | gmail | outlook" },
        { name: "provider_connected", type: "boolean", description: "OAuth connection confirmed – enables email features" },
        { name: "from_name", type: "string", description: "Default sender display name override" },
        { name: "notes", type: "string", description: "Admin notes about integration state" },
      ],
      relationships: []
    },
    {
      name: "DashboardConfig", description: "Global dashboard widget configuration. Admins define the layout; all users see it.",
      fields: [
        { name: "name", type: "string", description: "Config name" },
        { name: "description", type: "string", description: "Description" },
        { name: "widgets", type: "array", description: "Widget definitions: [{id, title, entity, widget_type, group_by, metric, cols, date_field, months, filter}]" },
        { name: "is_global", type: "boolean", description: "Global (shared with all users) flag" },
        { name: "is_active", type: "boolean", description: "Active config flag" },
      ],
      relationships: []
    },
  ],
  finance: [
    {
      name: "Invoice", description: "Client invoices for recruitment services.",
      fields: [
        { name: "invoice_number", type: "string", required: true, description: "Invoice number" },
        { name: "company_id", type: "string", required: true, isLookup: true, references: "Company", description: "Billed company" },
        { name: "issue_date", type: "date", required: true, description: "Issue date" },
        { name: "due_date", type: "date", required: true, description: "Payment due date" },
        { name: "items", type: "array", required: true, description: "Line items: [{description, quantity, rate, amount}]" },
        { name: "subtotal", type: "number", description: "Pre-tax subtotal" },
        { name: "tax_amount", type: "number", description: "Tax amount" },
        { name: "total", type: "number", description: "Final total" },
        { name: "status", type: "string", description: "draft | sent | paid | overdue | void" },
      ],
      relationships: [{ type: "Many-to-One", with: "Company", description: "Invoice billed to company" }]
    },
    {
      name: "Expense", description: "Business expense tracking with categorization.",
      fields: [
        { name: "date", type: "date", required: true, description: "Expense date" },
        { name: "name", type: "string", required: true, description: "Expense description" },
        { name: "type", type: "string", required: true, description: "Expense category" },
        { name: "amount", type: "number", required: true, description: "Amount in USD" },
        { name: "payment_method", type: "string", description: "Payment method (card, cash, wire, etc.)" },
        { name: "vendor", type: "string", description: "Vendor or payee" },
        { name: "is_recurring", type: "boolean", description: "Recurring expense flag" },
      ],
      relationships: []
    },
  ],
  supporting: [
    {
      name: "InboundEmail", description: "Pasted or uploaded inbound emails. Parsed by AI to create jobs or candidates.",
      fields: [
        { name: "from_email", type: "string", description: "Sender email" },
        { name: "to_email", type: "string", description: "Recipient email" },
        { name: "subject", type: "string", description: "Email subject" },
        { name: "body", type: "string", description: "Email body text" },
        { name: "received_date", type: "date", description: "Email received date" },
        { name: "processed", type: "boolean", description: "Processing complete flag" },
        { name: "processing_status", type: "string", description: "pending | processing | completed | failed" },
        { name: "processing_notes", type: "string", description: "AI processing notes or error details" },
        { name: "candidate_id", type: "string", isLookup: true, references: "Candidate", description: "Created/matched candidate" },
        { name: "job_id", type: "string", isLookup: true, references: "Job", description: "Created/matched job" },
      ],
      relationships: [
        { type: "Many-to-One", with: "Candidate", description: "Parsed resume creates/matches candidate" },
        { type: "Many-to-One", with: "Job", description: "Parsed JD creates/matches job" },
      ]
    },
    {
      name: "JobStack", description: "Public job board entries cloned from internal jobs. Companies with job_stack_access receive email notifications.",
      fields: [
        { name: "title", type: "string", description: "Job title" },
        { name: "description", type: "string", description: "Job description" },
        { name: "rate", type: "string", description: "Rate or salary text" },
        { name: "due_date", type: "date", description: "Target fill date" },
        { name: "employment_type", type: "string", description: "Employment type" },
        { name: "status", type: "string", description: "active | closed" },
        { name: "client", type: "string", description: "Client company name (denormalized)" },
        { name: "original_job_id", type: "string", isLookup: true, references: "Job", description: "Source internal job" },
      ],
      relationships: [{ type: "Many-to-One", with: "Job", description: "Cloned from internal job" }]
    },
    {
      name: "Timesheet", description: "Time entries logged by recruiters. Supports weekly submission and admin approval.",
      fields: [
        { name: "user_id", type: "string", required: true, description: "User email logging time" },
        { name: "date", type: "date", required: true, description: "Work date" },
        { name: "job_id", type: "string", isLookup: true, references: "Job", description: "Job worked on (optional)" },
        { name: "hours", type: "number", required: true, description: "Hours worked (0–24)" },
        { name: "notes", type: "string", description: "Description of work" },
        { name: "status", type: "string", description: "draft | submitted | approved | rejected | needs_revision" },
      ],
      relationships: []
    },
    {
      name: "LeaveRequest", description: "Leave requests submitted by recruiters. Admin approval workflow with block on time entry.",
      fields: [
        { name: "user_id", type: "string", required: true, description: "Requesting user email" },
        { name: "type", type: "string", required: true, description: "vacation | sick | personal | unpaid | other" },
        { name: "start_date", type: "date", required: true, description: "Leave start" },
        { name: "end_date", type: "date", required: true, description: "Leave end" },
        { name: "reason", type: "string", description: "Reason for leave" },
        { name: "status", type: "string", description: "pending | approved | declined | revision_requested" },
        { name: "approver_id", type: "string", description: "Approving admin user ID/email" },
        { name: "approved_date", type: "date", description: "Approval timestamp" },
      ],
      relationships: []
    },
  ],
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BRD() {
  const [activeTab, setActiveTab] = useState("document");
  const [search, setSearch] = useState("");

  const allEntities = Object.values(entities).flat();
  const totalFields = allEntities.reduce((s, e) => s + e.fields.length, 0);

  const entityGroups = [
    { key: "core", label: "Core Entities", color: "blue", items: entities.core },
    { key: "recruitment", label: "Recruitment & Talent", color: "purple", items: entities.recruitment },
    { key: "workflow", label: "Workflow & Process", color: "green", items: entities.workflow },
    { key: "ai", label: "AI & Intelligence", color: "pink", items: entities.ai },
    { key: "admin", label: "Admin & Security", color: "orange", items: entities.admin },
    { key: "finance", label: "Finance & Billing", color: "cyan", items: entities.finance },
    { key: "supporting", label: "Supporting Tables", color: "slate", items: entities.supporting },
  ];

  const filteredGroups = entityGroups.map(g => ({
    ...g,
    items: g.items.filter(e =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
      e.fields.some(f => f.name.toLowerCase().includes(search.toLowerCase()) || (f.description || "").toLowerCase().includes(search.toLowerCase()))
    )
  })).filter(g => g.items.length > 0);

  const tabs = [
    { id: "document", label: "Document", icon: FileText },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "datamodel", label: "Data Model", icon: Database },
    { id: "ai", label: "AI & LLMs", icon: Brain },
    { id: "security", label: "Security", icon: Shield },
    { id: "api", label: "API Reference", icon: Code },
    { id: "filemap", label: "File Map", icon: Box },
  ];

  const colorBadge = { blue: "bg-blue-100 text-blue-800", purple: "bg-purple-100 text-purple-800", green: "bg-green-100 text-green-800", pink: "bg-pink-100 text-pink-800", orange: "bg-orange-100 text-orange-800", cyan: "bg-cyan-100 text-cyan-800", slate: "bg-slate-100 text-slate-700" };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#1E293B] flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[22px] font-bold text-[#1E293B]" style={{ fontFamily: "var(--font-display)" }}>Recruiter X — Business Requirements Document</h1>
                <p className="text-[13px] text-[#94A3B8]">Full system architecture · Data model · AI features · Security · API reference · As of April 2026</p>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 shrink-0 flex-wrap">
            <div className="text-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2">
              <p className="text-[20px] font-bold text-[#2563EB]">{allEntities.length}</p>
              <p className="text-[11px] text-[#94A3B8]">Entities</p>
            </div>
            <div className="text-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2">
              <p className="text-[20px] font-bold text-[#7C3AED]">{totalFields}</p>
              <p className="text-[11px] text-[#94A3B8]">Fields</p>
            </div>
            <div className="text-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-4 py-2">
              <p className="text-[20px] font-bold text-[#16A34A]">20</p>
              <p className="text-[11px] text-[#94A3B8]">AI Features</p>
            </div>
            <Button
              onClick={() => downloadBRD(entities)}
              className="bg-[#1E293B] hover:bg-[#334155] text-white gap-2 h-auto py-2 px-4"
            >
              <Download className="w-4 h-4" />
              <div className="text-left">
                <div className="text-[13px] font-semibold leading-tight">Download BRD</div>
                <div className="text-[10px] text-[#94A3B8] leading-tight">.html document</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mt-5 border-b border-[#E2E8F0] -mb-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#64748B] hover:text-[#1E293B]"}`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── DOCUMENT TAB ─────────────────────────────────────────────────────── */}
      {activeTab === "document" && (
        <div className="space-y-3">
          <Section id="scope" icon={Target} title="Scope & Overview" defaultOpen>
            <div className="space-y-4 text-[13px]">
              <p className="text-[#475569] leading-relaxed">
                <strong className="text-[#1E293B]">Recruiter X</strong> is a full-stack recruitment operations platform built as a React + Base44 application. It covers the complete recruitment lifecycle — from candidate sourcing, resume parsing, and AI-assisted matching, through submission tracking, interview coordination, placement, and invoicing — for staffing agencies and internal recruiting teams.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <InfoCard color="blue" title="Platform Stack">
                  <li>React 18 + Vite + Tailwind CSS</li>
                  <li>React Router v7 (SPA)</li>
                  <li>Base44 BaaS (entities, auth, storage)</li>
                  <li>Base44 serverless functions (Deno)</li>
                  <li>@tanstack/react-query for data fetching</li>
                  <li>framer-motion, recharts, shadcn/ui</li>
                </InfoCard>
                <InfoCard color="purple" title="Functional Domains">
                  <li>Recruitment operations (candidates, jobs, submissions)</li>
                  <li>Resume & talent intelligence (Studio, AI scoring)</li>
                  <li>Communication (templates, blasts, inbox)</li>
                  <li>Workflow & process (tasks, playbooks, automation)</li>
                  <li>Finance (invoices, expenses)</li>
                  <li>Admin & governance (RBAC, audit, settings)</li>
                </InfoCard>
                <InfoCard color="green" title="Key Design Decisions">
                  <li>Frontend-heavy orchestration (workflow in React)</li>
                  <li>BaaS-style backend — all data via Base44 SDK</li>
                  <li>AI-first augmentation across all major flows</li>
                  <li>Mixed internal/public surfaces in one app</li>
                  <li>Permission-aware UI + server-side RLS</li>
                  <li>Right-side preview panel for quick context</li>
                </InfoCard>
              </div>
            </div>
          </Section>

          <Section id="users" icon={Users} title="2. Users & Roles">
            <div className="space-y-4 text-[13px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard color="blue" title="Admin">
                  <li>Full access to all entities and all records</li>
                  <li>Manage Roles, DashboardConfig, AppSettings</li>
                  <li>Create/edit global dashboards and shared views</li>
                  <li>Approve timesheets and leave requests</li>
                  <li>Access audit logs, access control, AI Agents, Email Blast</li>
                  <li>Invite and manage all users</li>
                </InfoCard>
                <InfoCard color="purple" title="Recruiter (User)">
                  <li>View most records; create/update own records</li>
                  <li>Full Candidate create + update (status, notes, scores)</li>
                  <li>Submit timesheets; create/view own leave requests</li>
                  <li>Access to Jobs, Companies, Submissions (own scope)</li>
                  <li>Limited delete by scope; cannot access admin pages</li>
                  <li>Bulk scoring and saved views per visibility</li>
                </InfoCard>
              </div>
              <InfoCard color="slate" title="Permission Matrix (per entity)">
                <p className="mb-2">Each entity in Role.permissions has: <code className="bg-white px-1 rounded border">{"{ view, create, update, delete, scope: 'all'|'own' }"}</code></p>
                <li><strong>scope: 'own'</strong> — enforces created_by = user.email filter client-side; RLS mirrors server-side</li>
                <li><strong>scope: 'all'</strong> — user can see and act on all records of that entity</li>
                <li>PermissionsProvider resolves matrix and exposes <code>can(entity, action)</code> and <code>listFilterFor(entity)</code></li>
                <li>Special RLS exceptions: Task → assigned_to, Submission → recruiter_id</li>
              </InfoCard>
            </div>
          </Section>

          <Section id="features" icon={Sparkles} title="3. Functional Requirements">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
              {[
                { title: "3.1 Dashboard", items: ["KPI metrics: active roles, pipeline count, monthly placements", "Pipeline funnel with conversion rates per stage", "Today's Tasks panel with inline complete", "Recent Candidates table with AI scores and stage", "AI Insights panel (live + on-demand LLM analysis)", "Tab views: Overview, Pipeline, Activity", "Admin: configurable global widget dashboard (KPI, Bar, Pie, Line, Stacked)", "Custom widget drag-and-drop reordering"] },
                { title: "3.2 Candidates", items: ["Searchable talent pool with saved views and column customization", "Bulk operations: status update, delete, scoring", "Paste-to-Add from resume text or LinkedIn bio (AI extraction)", "Bulk Resume Upload with PDF extraction and deduplication", "AI Candidate Screening (fit score + analysis)", "AI Candidate Summary panel with regenerate and Q&A", "AI Enrichment: auto-fill missing profile fields", "Duplicate detection and merge assistance", "Right-side preview panel with inline status edit"] },
                { title: "3.3 Jobs", items: ["List with search, saved views, priority and status filters", "Careers sync: open jobs published via syncJobToCareers function", "Email Blast to marketing recruiters or selected candidates", "AI Candidate Matching: top-N ranked candidates with scores", "Auto-matching agent trigger on job creation", "Job Stack cloning for public job board", "Company job stack email notifications on new openings", "Inbound email parsing to auto-create jobs"] },
                { title: "3.4 Submissions / Applications", items: ["Create submission with candidate + job + recruiter", "Kanban and list views with drag-and-drop status updates", "Saved views with filters, columns, sort, and visibility controls", "Follow-up date tracking with overdue indicators", "Auto-create follow-up Task on submission creation", "Automation rules fire on status transitions", "Client feedback tracking per submission", "Interview date history with feedback per round"] },
                { title: "3.5 Resume Studio", items: ["Build tab: inline form editor + live PDF-style preview", "AI Resume Builder: generate tailored JSON resume from JD", "Score tab: paste/upload JD and resume, get weighted fit score", "Version comparison: side-by-side diff of resume versions", "JD-Resume compare: match strengths and gaps", "Scoring model: Hard Skills > Education > Job Title > Soft Skills", "Export to PDF; theme color customization"] },
                { title: "3.6 AI Assistant (Global)", items: ["Floating launcher on every authenticated page", "Loads page-aware context (candidates, jobs, applications)", "Conversational Q&A with suggested quick prompts", "Action planning: AI determines intent and executes CRUD", "AI Quick Actions (⌘J): natural language shortcut layer", "Supports: navigate, create_candidate, create_job, create_task, search"] },
                { title: "3.7 Email Inbox", items: ["Paste or upload inbound email content", "AI parses job requirement emails → creates/updates Job", "AI parses resume emails → creates/updates Candidate + Application", "Processing status transitions with notes", "Linked to created records for traceability"] },
                { title: "3.8 My Work & Approvals", items: ["Quick time entry form (saves as draft)", "Weekly timesheet view with daily hour grid", "Leave requests with type, date range, reason", "Leave validation: blocks time entry on leave dates", "Approvals page: batch approve timesheets and leaves", "AI Insights on workload, productivity, leave patterns", "Auto-notify admins on timesheet submission"] },
                { title: "3.9 Playbooks", items: ["Categorized process documentation library", "Step-by-step guides with checklists and tips", "Document attachments (PDF, video, link, template)", "AI Smart Search: semantic search across playbooks", "Contextual Suggestions: AI recommends relevant playbooks", "Version history and changelog tracking", "Access level control: public | recruiter | manager | admin"] },
                { title: "3.10 Automation Rules", items: ["Trigger: entity status change (e.g. Submission → submitted)", "Actions: send_email via template, create_task, send_notification", "Configurable delay in minutes (browser setTimeout)", "Recipient types: candidate, recruiter, hiring_manager, custom", "Active/inactive toggle; trigger count and last-triggered tracking", "Visual rule builder with entity and status selectors"] },
                { title: "3.11 Finance", items: ["Invoices: line items, tax, totals, status lifecycle", "Email invoice to company contacts via template", "Invoice summary: pending and received totals", "Expenses: category, date, amount, vendor, recurring flag", "Permission-gated: view/create controlled by role"] },
                { title: "3.12 Access Control", items: ["User management: search, invite, role assignment, lock/unlock", "Role builder: toggle view/create/update/delete per entity", "Scope selector: all or own per entity", "Audit log viewer: login events, user actions, IP, user agent", "Auto-logout after 3 hours of inactivity", "Forced logout on locked account (detected on next load)"] },
              ].map(({ title, items }) => (
                <div key={title} className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <p className="font-semibold text-[13px] text-[#1E293B]">{title}</p>
                  </div>
                  <ul className="p-4 space-y-1.5">
                    {items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#475569]">
                        <CheckCircle className="w-3 h-3 text-[#16A34A] mt-0.5 shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          <Section id="nonfunctional" icon={Settings} title="4. Non-Functional Requirements">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
              <InfoCard color="blue" title="Performance">
                <li>Roles and quick stats cached (15-min TTL) to avoid redundant fetches</li>
                <li>Dashboard load guard: 30s debounce on re-fetch</li>
                <li>Right-side preview loads entity data on demand (lazy)</li>
                <li>React Query for server state caching and deduplication</li>
                <li>AI calls scoped to minimum context window needed</li>
              </InfoCard>
              <InfoCard color="purple" title="Responsiveness">
                <li>Tailwind responsive layout for mobile and desktop</li>
                <li>Dedicated Mobile page with simplified task/candidate views</li>
                <li>MobileTabBar for bottom navigation on small screens</li>
                <li>Collapsible, pinnable sidebar with state persisted to localStorage</li>
              </InfoCard>
              <InfoCard color="green" title="Reliability & Error Handling">
                <li>Errors bubble to surface (no silent catch) for fast iteration</li>
                <li>Automation delays use browser setTimeout — not durable for production</li>
                <li>AI calls wrapped with loading state and user feedback</li>
                <li>File uploads via Base44 (not arbitrary storage writes)</li>
              </InfoCard>
              <InfoCard color="orange" title="UX Conventions">
                <li>ESC closes all major modals</li>
                <li>⌘K: command palette global search</li>
                <li>⌘J: AI quick actions conversational panel</li>
                <li>?: keyboard shortcuts help overlay</li>
                <li>Right-click preview panel for candidate/job/company/task/playbook</li>
                <li>Click on detail links intercepts to open preview (not navigate)</li>
              </InfoCard>
            </div>
          </Section>

          <Section id="workflows" icon={Activity} title="5. Backend Workflows (Client-Orchestrated)">
            <div className="space-y-3 text-[13px]">
              <p className="text-[#64748B]">Most workflow logic runs in React components. These are the primary orchestration flows:</p>
              {[
                { n: "1", title: "Candidate Ingestion", steps: ["Resume file upload → Base44 UploadFile → file_url stored on Candidate", "PDF extraction via ExtractDataFromUploadedFile → structured JSON", "Email deduplication check before create", "create/update Candidate record with extracted fields", "Optional: CandidateAIEnrichment fills missing fields via InvokeLLM"] },
                { n: "2", title: "Job Publishing & Careers Sync", steps: ["Job create/update with status='open'", "Optional: clone to JobStack for public job board", "Notify companies with job_stack_access via email", "Invoke syncJobToCareers backend function → POST to talentstack.org/api/jobs", "On status change to filled/cancelled: update or remove from public board"] },
                { n: "3", title: "Email Inbox Parsing", steps: ["User pastes or uploads inbound email content", "Saved as InboundEmail with processing_status='pending'", "AI (InvokeLLM) detects: job requirement or resume email", "Job path: extract title, skills, company, rate → create/update Job", "Resume path: extract candidate fields → create/update Candidate → create Application"] },
                { n: "4", title: "Automation Rule Execution", steps: ["User action changes entity status (e.g. Submission → submitted)", "executeAutomation loads active AutomationRule rows matching trigger", "For each match: delay via setTimeout, then execute action", "send_email: render EmailTemplate + send via SendEmail integration", "create_task: create Task record linked to the entity", "Update AutomationRule.trigger_count and last_triggered"] },
                { n: "5", title: "AI Candidate Matching", steps: ["Recruiter opens Job → Advanced Matching tab", "Fetch all active Candidates", "For each candidate: call InvokeLLM with job + candidate data + MatchingProfile weights", "Receive structured score: dimensions, strengths, concerns, recommendation", "Save MatchFeedback record; user rates → profile learns", "Top candidates shown ranked by score with visual breakdown"] },
                { n: "6", title: "Bulk Bench Scoring", steps: ["Recruiter selects Candidate View (default: status=our_bench)", "Selects open/draft Job to score against", "For each candidate with resume_url: call InvokeLLM with resume + job", "Skip candidates without resume (mark Skipped)", "Persist bench_match_score + bench_score_details to Candidate", "Progress bar UI with per-candidate status"] },
              ].map(w => (
                <div key={w.n} className="border border-[#E2E8F0] rounded-xl p-4">
                  <p className="font-semibold text-[#1E293B] mb-2">{w.n}. {w.title}</p>
                  <ol className="space-y-1 ml-2">
                    {w.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#475569]">
                        <span className="text-[#2563EB] font-semibold shrink-0">{i + 1}.</span>{s}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </Section>

          <Section id="integrations" icon={Zap} title="6. Integrations">
            <div className="space-y-3 text-[13px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { name: "Core.InvokeLLM", color: "purple", desc: "Primary AI integration. Used for: candidate summaries, screening scores, bench scoring, resume scoring, JD comparison, outreach drafting, interview assistance, duplicate detection, email blast content, playbook search, pipeline insights, analytics narratives.", params: "prompt, response_json_schema, add_context_from_internet, file_urls, model" },
                  { name: "Core.UploadFile", color: "blue", desc: "Upload resumes, JDs, and documents to Base44 storage. Returns file_url stored on Candidate or Resume entities.", params: "file (binary)" },
                  { name: "Core.ExtractDataFromUploadedFile", color: "green", desc: "OCR and text extraction from PDF/CSV/Excel/images. Used for resume parsing and bulk import flows.", params: "file_url, json_schema" },
                  { name: "Core.SendEmail", color: "orange", desc: "Send transactional emails. Gated by AppSettings (provider must be connected). Used for invoice emails, follow-ups, automation rule actions, and job blast.", params: "to, subject, body, from_name" },
                  { name: "Core.GenerateImage", color: "pink", desc: "AI image generation. Registered in integrations.js but not prominently used in current UI.", params: "prompt, existing_image_urls" },
                  { name: "syncJobToCareers (function)", color: "slate", desc: "Custom serverless function (Deno). Authenticates requester, loads job + company, transforms to public payload, POSTs to https://talentstack.org/api/jobs. Called when job status = open.", params: "job_id" },
                ].map(int => (
                  <div key={int.name} className={`border-l-4 ${int.color === "purple" ? "border-[#7C3AED]" : int.color === "blue" ? "border-[#2563EB]" : int.color === "green" ? "border-[#16A34A]" : int.color === "orange" ? "border-[#D97706]" : int.color === "pink" ? "border-[#DB2777]" : "border-[#475569]"} border border-[#E2E8F0] rounded-r-xl p-4`}>
                    <code className="font-mono font-semibold text-[13px] text-[#1E293B]">{int.name}</code>
                    <p className="text-[12px] text-[#475569] mt-1 mb-2">{int.desc}</p>
                    <p className="text-[11px] text-[#94A3B8]"><strong>Params:</strong> {int.params}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="future" icon={TrendingUp} title="7. Future Enhancements">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
              <InfoCard color="blue" title="AI & Matching">
                <li>Semantic similarity search with vector embeddings</li>
                <li>Predictive analytics: time-to-fill, offer acceptance probability</li>
                <li>Auto-scheduling interviews based on availability</li>
                <li>Sentiment analysis on client feedback</li>
                <li>AI-driven follow-up suggestion engine</li>
              </InfoCard>
              <InfoCard color="purple" title="Automation & Durability">
                <li>Move automation execution from browser to durable backend workers</li>
                <li>Scheduled jobs via Base44 automations (cron/interval)</li>
                <li>Real-agent runtime for AI Agents page (currently mock)</li>
                <li>Smart nurturing campaigns with branching logic</li>
              </InfoCard>
              <InfoCard color="green" title="Communication">
                <li>Two-way email sync (Gmail/Outlook connector)</li>
                <li>Video interview recording and transcription</li>
                <li>Candidate portal for self-service applications</li>
                <li>SMS/WhatsApp outreach channel</li>
              </InfoCard>
              <InfoCard color="orange" title="Analytics & Reporting">
                <li>Pipeline conversion and funnel analytics</li>
                <li>Recruiter performance leaderboard</li>
                <li>Revenue and placement forecasting</li>
                <li>AI score impact on placement outcomes</li>
              </InfoCard>
            </div>
          </Section>

          <Section id="glossary" icon={BookOpen} title="8. Glossary">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
              {[
                ["Match Score", "Weighted AI-calculated alignment (0–100) between a candidate and a job"],
                ["Bench Score", "AI score for candidates on the bench against open jobs (bench_match_score)"],
                ["Screening Score", "AI fit score from CandidateScreening (screening_score)"],
                ["Scope (All/Own)", "Permission scope — 'own' limits records to created_by; 'all' gives full access"],
                ["RLS", "Row-Level Security — server-side enforcement mirroring client permission rules"],
                ["Pipeline Health", "AI-assessed recruitment pipeline state: healthy | at_risk | critical"],
                ["AI Quick Actions", "Conversational AI panel (⌘J) for executing actions via natural language"],
                ["Paste to Add", "Quick candidate creation from unstructured resume or LinkedIn text"],
                ["MatchingProfile", "Configurable AI matching config with weighted criteria and model selection"],
                ["MatchFeedback", "User rating/action on an AI match — feeds continuous learning loop"],
                ["Job Stack", "Public job board — open jobs cloned and published for external visibility"],
                ["AutomationRule", "Event-driven rule that fires email send or task creation on status change"],
                ["Bench", "Candidates available for placement — 'on_bench' (vendor) or 'our_bench' (internal)"],
                ["InvokeLLM", "Base44 integration for calling LLMs — the primary AI execution surface"],
                ["DashboardConfig", "Saved global widget layout for the Dashboard (admin-controlled)"],
                ["Preview Panel", "Right-side sliding panel for quick entity viewing without full navigation"],
              ].map(([term, def]) => (
                <div key={term} className="flex items-start gap-2 p-2 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                  <span className="font-semibold text-[#1E293B] min-w-[160px] shrink-0">{term}</span>
                  <span className="text-[#64748B]">{def}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── ARCHITECTURE TAB ──────────────────────────────────────────────────── */}
      {activeTab === "architecture" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LayerCard icon={Globe} color="border-[#2563EB]" title="1. Presentation Tier" items={[
              "Internal recruiter/admin SPA (React Router)",
              "Public marketing pages (Landing, Blog, Careers, Contact, Products, Services)",
              "Command palette (⌘K), AI quick actions (⌘J), keyboard shortcuts (?)",
              "Right-side preview panel (Candidate, Job, Company, Application, Task, Playbook)",
              "Dashboard with tabs, KPI cards, kanban boards, AI insights",
              "Resume Studio (build, score, compare, AI builder)",
              "Mobile-optimized pages and components",
            ]} />
            <LayerCard icon={Cpu} color="border-[#7C3AED]" title="2. Client Application Tier" items={[
              "App.jsx: AuthProvider + QueryClientProvider + BrowserRouter + VisualEditAgent + Toaster",
              "pages.config.js: page registry and routing source of truth",
              "Layout.jsx: sidebar nav, quick stats, search, preview orchestration, AI assistant",
              "PermissionsContext: role/permission matrix, list filters, can() checks",
              "AuthContext: public app settings, token validation, me() resolution",
              "NavigationTracker, NotificationToast, refreshBus, window custom events",
              "rolesCache: 15-min in-memory cache for Role entities",
            ]} />
            <LayerCard icon={Server} color="border-[#16A34A]" title="3. Platform / Backend Tier (Base44)" items={[
              "Entity store: list, filter, get, create, update, delete per entity",
              "Auth: token-based JWT, me(), logout(), redirectToLogin()",
              "Base44 integrations: InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile, GenerateImage",
              "Serverless functions (Deno): syncJobToCareers",
              "File storage: UploadFile returns permanent public URL",
              "RLS enforcement: mirrors client-side permission rules server-side",
            ]} />
            <LayerCard icon={Globe} color="border-[#D97706]" title="4. External Services" items={[
              "talentstack.org/api/jobs: public careers job sync endpoint",
              "ipify.org: IP address resolution for audit logs",
              "LLM inference: via Base44 Core.InvokeLLM (provider abstracted)",
              "Email delivery: via Base44 Core.SendEmail (Gmail/Outlook-gated)",
              "Google Fonts: Bricolage Grotesque, IBM Plex Sans, JetBrains Mono",
            ]} />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <p className="font-semibold text-[#1E293B] text-[14px] mb-4">Key Routing & Bootstrap</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
              <InfoCard color="blue" title="App.jsx Bootstrap Order">
                <li>AuthProvider wraps everything — loads public settings first</li>
                <li>QueryClientProvider for React Query</li>
                <li>BrowserRouter + NavigationTracker</li>
                <li>AuthenticatedApp: checks isLoadingPublicSettings, isLoadingAuth</li>
                <li>Handles user_not_registered and auth_required errors</li>
                <li>Renders Layout + Routes from pagesConfig loop</li>
              </InfoCard>
              <InfoCard color="purple" title="pages.config.js">
                <li>Single source of truth for route → component mapping</li>
                <li>Internal: Dashboard, Candidates, Jobs, Companies, Submissions, Tasks, Goals, Recruiters, Consultants, Expenses, Invoices, AccessControl, AutomationRules, EmailSettings, EmailInbox, AIAgents, ResumeStudio, Playbooks, DuplicateManager, MyWork, Approvals, EmailBlast, BRD</li>
                <li>Public: Landing, Home, Products, Services, Blog, Contact, Careers</li>
                <li>Detail: CandidateDetails, CompanyDetails, JobDetails, TaskDetails, PlaybookDetails</li>
              </InfoCard>
              <InfoCard color="green" title="Layout.jsx Services">
                <li>Sidebar: collapsible (ChevronsLeft/Right), pinnable (Pin/PinOff), state in localStorage</li>
                <li>Quick Stats: active jobs, new candidates, this month placements</li>
                <li>Preview orchestration: listens for preview:open custom events</li>
                <li>Auto-logout: 3-hour inactivity timer resets on mouse/key activity</li>
                <li>Audit log: login event with IP captured once per session</li>
                <li>Auto-complete tasks on candidate/application status change</li>
                <li>Permission patch: ensures Recruiter role can update Candidates</li>
              </InfoCard>
            </div>
          </div>
        </div>
      )}

      {/* ── DATA MODEL TAB ────────────────────────────────────────────────────── */}
      {activeTab === "datamodel" && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input placeholder="Search entities, fields, descriptions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>

          {filteredGroups.map(group => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${colorBadge[group.color]}`}>{group.label}</span>
                <span className="text-[12px] text-[#94A3B8]">{group.items.length} {group.items.length === 1 ? "entity" : "entities"}</span>
              </div>
              {group.items.map(e => <EntityBlock key={e.name} {...e} />)}
            </div>
          ))}
        </div>
      )}

      {/* ── AI TAB ────────────────────────────────────────────────────────────── */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InfoCard color="blue" title="LLM Access Pattern">
              <p className="text-[#64748B] mb-2">All LLM calls go through Base44's <code>Core.InvokeLLM</code>. No vendor SDK is called directly. Base44 handles provider selection and model execution.</p>
              <li><strong>Default model:</strong> gpt-4o-mini (auto)</li>
              <li><strong>Premium models:</strong> o1, claude-4.5, gpt-5, gpt-4o</li>
              <li><strong>Pattern:</strong> structured JSON schema output</li>
              <li><strong>Context:</strong> page-aware data summaries as prompt context</li>
            </InfoCard>
            <InfoCard color="purple" title="Models Referenced in UI">
              <li><strong>o1:</strong> Complex multi-criteria reasoning (matching)</li>
              <li><strong>gpt-4o:</strong> Fast reliable scoring and generation</li>
              <li><strong>claude-4.5:</strong> Balanced analysis and summarization</li>
              <li><strong>gpt-5:</strong> Advanced understanding (matching profiles)</li>
              <li><strong>auto:</strong> System picks best for the task</li>
            </InfoCard>
            <InfoCard color="green" title="LLM Usage Styles">
              <li>Structured JSON extraction (resume parsing, inbox parsing)</li>
              <li>Scoring and ranking (screening, bench, matching)</li>
              <li>Summarization (candidate summary, interview recap)</li>
              <li>Content generation (outreach, email blast, resume builder)</li>
              <li>Recommendation reasoning (insights, analytics, suggestions)</li>
              <li>Duplicate detection assistance (DuplicateManager)</li>
            </InfoCard>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <p className="font-semibold text-[#1E293B] text-[14px] mb-4">AI Feature Inventory</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
              {[
                { n: "1", name: "AI Assistant", comp: "components/ai/Assistant", desc: "Page-aware conversational assistant. Loads context from multiple entities. Supports Q&A and action execution (create records, navigate). Floating launcher on every page." },
                { n: "2", name: "AI Quick Actions (⌘J)", comp: "components/common/AIQuickActions", desc: "Natural language shortcut layer. Detects intent: navigate, create_candidate, create_job, create_task, search. Executes actions with confirmation." },
                { n: "3", name: "Advanced Candidate Matching", comp: "components/ai/AdvancedCandidateMatching", desc: "Weighted multi-criteria matching (7 dimensions). Configurable MatchingProfile with model selection. Persists MatchFeedback for learning loop." },
                { n: "4", name: "Candidate Screening", comp: "components/ai/CandidateScreening", desc: "AI fit analysis for a candidate against a specific job. Outputs screening_score + detailed matching/missing qualifications. Stored on Candidate entity." },
                { n: "5", name: "Bulk Bench Scoring", comp: "components/ai/BulkBenchScorer", desc: "Batch AI scoring of a candidate cohort (Candidate View) against a selected job. Skips candidates without resume. Persists bench_match_score to Candidate." },
                { n: "6", name: "Advanced Scoring", comp: "components/ai/AdvancedScoring", desc: "Individual deep scoring of a candidate for a job. Detailed dimension breakdown displayed with visual progress bars." },
                { n: "7", name: "Bulk Scoring", comp: "components/ai/BulkScoring", desc: "Multi-candidate scoring in a batch operation. Used for pipeline analysis across a subset of candidates." },
                { n: "8", name: "Resume AI Assistant", comp: "components/resume/ResumeAIAssistant", desc: "In-Resume Studio AI chat. Provides suggestions for improving resume content, tailoring to JDs, and filling gaps." },
                { n: "9", name: "Resume LLM Builder", comp: "components/resume/ResumeLLMBuilder", desc: "Generates a complete structured JSON resume from a job description or free-form input. Populates all resume sections." },
                { n: "10", name: "Resume Scorer", comp: "components/resume/ResumeScorer", desc: "Paste or upload JD and resume. Calculates weighted fit score with Hard Skills, Education, Job Title, Soft Skills breakdown." },
                { n: "11", name: "Candidate AI Summary", comp: "components/ai/CandidateAISummary", desc: "Auto-generated candidate profile summary. Displayed in candidate preview/details. Supports regeneration and Q&A follow-up." },
                { n: "12", name: "Candidate AI Enrichment", comp: "components/ai/CandidateAIEnrichment", desc: "Fills missing candidate fields (title, skills, experience, location) by analyzing existing data with InvokeLLM." },
                { n: "13", name: "Candidate Outreach", comp: "components/ai/CandidateOutreach", desc: "AI-generated outreach email draft for recruiters. Personalized to candidate profile and target job. Multiple tones available." },
                { n: "14", name: "Interview Assistant", comp: "components/ai/InterviewAssistant", desc: "Question library with 5 categories, per-question scoring (1–5), live score calculator, and AI summary of the interview session." },
                { n: "15", name: "Talent Pipeline Analytics", comp: "components/ai/TalentPipelineAnalytics", desc: "AI-generated pipeline insights: skill gaps, hiring forecast, pipeline health, conversion analysis, trend narratives." },
                { n: "16", name: "Email Inbox AI Parsing", comp: "pages/EmailInbox", desc: "Detects if inbound email is a job requirement or candidate resume. Extracts structured data and creates/updates Job or Candidate + Application records." },
                { n: "17", name: "Email Blast AI Content", comp: "pages/EmailBlast", desc: "AI-generates professional campaign email body from a subject line. Includes intro, value props, CTA, signature." },
                { n: "18", name: "Playbook Smart Search", comp: "components/playbooks/PlaybookSmartSearch", desc: "Semantic search across playbooks using AI. Returns most relevant playbooks for a natural language query." },
                { n: "19", name: "Contextual Suggestions", comp: "components/playbooks/ContextualSuggestions", desc: "AI recommends relevant playbooks based on current page context or user query." },
                { n: "20", name: "Duplicate Manager", comp: "pages/DuplicateManager", desc: "AI-assisted detection of duplicate candidate or company records. Provides merge reasoning and similarity scoring." },
              ].map(f => (
                <div key={f.n} className="border border-[#E2E8F0] rounded-xl p-3">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="font-bold text-[#2563EB] shrink-0">{f.n}.</span>
                    <div>
                      <p className="font-semibold text-[#1E293B]">{f.name}</p>
                      <code className="text-[10px] text-[#94A3B8]">{f.comp}</code>
                    </div>
                  </div>
                  <p className="text-[#475569] text-[11px] ml-5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <InfoCard color="orange" title="AI Agents Status (April 2026)">
            <p className="text-[#92400E] mb-2">The AIAgents page presents a product concept and builder UI. In the current codebase it operates on mock agent data and should be treated as a partially implemented management surface, <strong>not a production-grade agent runtime</strong>. The agents/ directory contains JSON configs for job_matcher and talent_matcher but these are not yet wired to a durable execution engine.</p>
            <li>Visual agent management with performance stats (mock)</li>
            <li>Agent builder UI: trigger config, tool permissions, AI model selection</li>
            <li>Planned: real event-driven execution via Base44 entity automations</li>
          </InfoCard>
        </div>
      )}

      {/* ── SECURITY TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <InfoCard color="blue" title="Authentication">
                <li>Base44-hosted authentication — no custom auth backend</li>
                <li>JWT token accepted from URL param <code>access_token</code>, removed from URL after capture</li>
                <li>App validates public app settings before user auth check</li>
                <li>Login redirect: <code>base44.auth.redirectToLogin(nextUrl)</code></li>
                <li>Logout: <code>base44.auth.logout(redirectUrl)</code></li>
                <li>Auto-logout: 3-hour inactivity timer (mousemove, keydown, mousedown, touchstart)</li>
                <li>Forced logout on next load if user is_locked = true or status ≠ active</li>
              </InfoCard>
              <InfoCard color="purple" title="Authorization (RBAC)">
                <li>Built-in user.role (admin | user) + custom Role entity</li>
                <li>PermissionsProvider resolves: isAdmin, can(entity, action), listFilterFor(entity)</li>
                <li>Supported actions per entity: view, create, update, delete</li>
                <li>Scope: 'all' (full access) or 'own' (created_by filter)</li>
                <li>Special scopes: Task → assigned_to; Submission → recruiter_id</li>
                <li>PermissionGate component prevents disallowed UI elements from rendering</li>
                <li>AccessBlocker shown to locked/inactive users who slip past auth</li>
              </InfoCard>
            </div>
            <div className="space-y-3">
              <InfoCard color="green" title="Data Security">
                <li>Email sending requires AppSettings.provider_connected = true</li>
                <li>File uploads via Base44 integrations (not arbitrary storage writes)</li>
                <li>Only one custom backend function (syncJobToCareers) — validates auth before acting</li>
                <li>Audit log captures login events with IP (ipify) and user agent</li>
                <li>RLS on Base44 platform mirrors client-side permission rules server-side</li>
                <li>Sensitive entities (Role, AppSettings, AuditLog) locked to admin-only RLS</li>
              </InfoCard>
              <InfoCard color="red" title="Known Risks & Limitations">
                <li>Frontend-heavy orchestration: most workflow logic executes in the browser (session/network sensitive)</li>
                <li>Automation delays use browser setTimeout — not durable for production background jobs</li>
                <li>Client-side permission enforcement: server-side RLS not fully visible in this repo</li>
                <li>AI Agents page is a product shell on mock data — not a real execution engine</li>
                <li>Auth token handling depends on Base44 platform guarantees</li>
                <li>No server-side rate limiting on entity operations beyond Base44 platform limits</li>
              </InfoCard>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
            <p className="font-semibold text-[#1E293B] mb-3">Permission Matrix (Typical Configuration)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <th className="text-left px-3 py-2 font-semibold text-[#475569]">Entity</th>
                    {["Admin View", "Admin Write", "Recruiter View", "Recruiter Write", "Scope"].map(h => (
                      <th key={h} className="text-center px-3 py-2 font-semibold text-[#475569]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Candidate", "✓", "✓", "✓", "✓ (update)", "all / own"],
                    ["Job", "✓", "✓", "✓", "✓", "all"],
                    ["Company", "✓", "✓", "✓", "✓", "all"],
                    ["Application", "✓", "✓", "✓ (own)", "✓ (own)", "own"],
                    ["Submission", "✓", "✓", "✓ (own)", "✓ (own)", "own (recruiter_id)"],
                    ["Task", "✓", "✓", "✓ (own)", "✓ (own)", "own (assigned_to)"],
                    ["Invoice / Expense", "✓", "✓", "✓ (if granted)", "—", "own"],
                    ["Role / AuditLog", "✓", "✓", "—", "—", "admin only"],
                    ["AppSettings", "✓", "✓", "—", "—", "admin only"],
                    ["DashboardConfig", "✓", "✓", "✓ (read)", "—", "admin write"],
                  ].map(([entity, ...cells]) => (
                    <tr key={entity} className="border-b border-[#F8FAFC] hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2 font-medium text-[#1E293B]">{entity}</td>
                      {cells.map((c, i) => (
                        <td key={i} className={`px-3 py-2 text-center ${c === "✓" ? "text-[#16A34A]" : c === "—" ? "text-[#94A3B8]" : "text-[#475569]"}`}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── API TAB ────────────────────────────────────────────────────────────── */}
      {activeTab === "api" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoCard color="blue" title="Base URL & Authentication">
              <li><strong>Base URL:</strong> <code>https://api.base44.com</code></li>
              <li><strong>Auth:</strong> Bearer JWT token in Authorization header</li>
              <li><strong>Content-Type:</strong> application/json</li>
              <li>Token refreshes on activity; expires after 3 hours inactivity</li>
              <li>Existing secrets: <code>XAI_API_KEY</code> (xAI/Grok for advanced reasoning)</li>
            </InfoCard>
            <InfoCard color="green" title="SDK Usage (Frontend)">
              <p className="mb-2">Import the pre-initialized client:</p>
              <code className="block bg-white rounded border p-2 text-[11px]">{"import { base44 } from '@/api/base44Client';"}</code>
            </InfoCard>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-[#1E293B] text-[14px]">SDK Entity Operations</p>
            <CodeBlock code={`import { base44 } from '@/api/base44Client';

// LIST — returns array, sorted by field (prefix '-' for descending), with limit
const candidates = await base44.entities.Candidate.list('-created_date', 50);

// FILTER — by field values, with sort and limit
const activeCandidates = await base44.entities.Candidate.filter(
  { status: 'active' },
  '-updated_date',
  100
);

// GET — single record by ID
const candidate = await base44.entities.Candidate.get(candidateId);

// CREATE — returns created record with auto-generated id, created_date, etc.
const newCandidate = await base44.entities.Candidate.create({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@email.com',
  skills: ['JavaScript', 'React', 'Node.js'],
  status: 'active'
});

// UPDATE — partial update by ID, returns updated record
await base44.entities.Candidate.update(candidateId, {
  status: 'screening',
  screening_score: 87
});

// DELETE — by ID
await base44.entities.Candidate.delete(candidateId);

// BULK CREATE — array of objects
await base44.entities.Candidate.bulkCreate([
  { first_name: 'A', last_name: 'B', email: 'a@b.com' },
  { first_name: 'C', last_name: 'D', email: 'c@d.com' },
]);

// SCHEMA — returns JSON schema without built-in fields
const schema = await base44.entities.Candidate.schema();

// SUBSCRIBE — real-time updates
const unsubscribe = base44.entities.Candidate.subscribe((event) => {
  // event.type: 'create' | 'update' | 'delete'
  // event.id: record ID
  // event.data: current record data
  console.log(event.type, event.data);
});
// Call unsubscribe() to clean up`} />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-[#1E293B] text-[14px]">Auth & User Operations</p>
            <CodeBlock code={`import { base44 } from '@/api/base44Client';

// Get current user
const user = await base44.auth.me();
// Returns: { id, email, full_name, role, role_id, status, is_locked, ... }

// Check if authenticated
const authed = await base44.auth.isAuthenticated(); // returns boolean

// Update current user data
await base44.auth.updateMe({ role_id: 'some-role-id' });

// Logout (redirects to redirectUrl or reloads)
base44.auth.logout(redirectUrl?);

// Redirect to login
base44.auth.redirectToLogin(nextUrl?);

// Invite a user
await base44.users.inviteUser('user@example.com', 'user'); // role: 'user' | 'admin'`} />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-[#1E293B] text-[14px]">Integration Calls</p>
            <CodeBlock code={`import { base44 } from '@/api/base44Client';

// InvokeLLM — structured JSON output
const result = await base44.integrations.Core.InvokeLLM({
  prompt: "Analyze this candidate for the Senior React Developer role...",
  response_json_schema: {
    type: "object",
    properties: {
      score: { type: "number" },
      strengths: { type: "array", items: { type: "string" } },
      concerns: { type: "array", items: { type: "string" } },
      recommendation: { type: "string", enum: ["strong_hire", "hire", "maybe", "no_hire"] }
    }
  },
  model: "auto" // or "o1", "claude-4.5", "gpt-5", "gpt-4o"
});

// UploadFile
const { file_url } = await base44.integrations.Core.UploadFile({ file: fileBlob });

// ExtractDataFromUploadedFile
const { output } = await base44.integrations.Core.ExtractDataFromUploadedFile({
  file_url: "https://...",
  json_schema: { type: "object", properties: { name: { type: "string" }, skills: { type: "array" } } }
});

// SendEmail (requires AppSettings.provider_connected = true)
await base44.integrations.Core.SendEmail({
  to: "candidate@example.com",
  subject: "Interview Invitation",
  body: "<p>We'd like to schedule...</p>",
  from_name: "TalentStack Recruiting"
});`} />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-[#1E293B] text-[14px]">Backend Function: syncJobToCareers</p>
            <CodeBlock code={`// Invoke from frontend (Platform V2 — direct import)
import { syncJobToCareers } from "@/functions/syncJobToCareers";

const response = await syncJobToCareers({ job_id: "some-job-uuid" });
// Returns: { success: true, message: "Job synced" } or { error: "..." }

// ── Backend function implementation (Deno) ──
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id } = await req.json();
  if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 });

  const job = await base44.asServiceRole.entities.Job.get(job_id);
  const company = job.company_id
    ? await base44.asServiceRole.entities.Company.get(job.company_id)
    : null;

  const payload = {
    title: job.title,
    description: job.description,
    rate: job.rate,
    location: job.location,
    remote_type: job.remote_type,
    employment_type: job.employment_type,
    required_skills: job.required_skills,
    client: company?.name || "Confidential",
    status: job.status,
  };

  const res = await fetch("https://talentstack.org/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return Response.json({ success: res.ok });
});`} />
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
            <p className="font-semibold text-[#1E293B] text-[14px]">Entity JSON Structures</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-[12px] font-semibold text-[#475569] mb-2">Candidate (full)</p>
                <CodeBlock code={`{
  // Auto-generated
  "id": "uuid",
  "created_date": "2026-04-01T10:00:00Z",
  "updated_date": "2026-04-01T10:00:00Z",
  "created_by": "recruiter@agency.com",
  
  // Required
  "first_name": "Sarah",
  "last_name": "Chen",
  "email": "sarah.chen@email.com",
  
  // Profile
  "phone": "+1-555-0123",
  "location": "SF Bay Area",
  "linkedin_url": "https://linkedin.com/in/sarahchen",
  "resume_url": "https://storage.../resume.pdf",
  "current_title": "Sr. Full-Stack Engineer",
  "current_company": "Stripe",
  "experience_years": 8,
  "skills": ["React", "TypeScript", "Node.js", "AWS"],
  "salary_expectation": 180000,
  "availability": "2_weeks",
  "status": "active",
  "work_authorization": "citizen",
  "notes": "Strong payment infra background",
  "source": "LinkedIn",
  
  // AI scores
  "bench_match_score": 91,
  "bench_score_details": { "technical_skills": 95, "experience_level": 90 },
  "screening_score": 94,
  "screening_date": "2026-04-01T09:00:00Z",
  "screening_details": {
    "matching_qualifications": ["React", "Node.js", "AWS"],
    "missing_qualifications": ["Kubernetes"],
    "overall_fit": "Strong match"
  }
}`} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-[#475569] mb-2">Application (full)</p>
                <CodeBlock code={`{
  "id": "uuid",
  "created_date": "2026-04-01T10:00:00Z",
  "updated_date": "2026-04-20T14:00:00Z",
  "created_by": "recruiter@agency.com",
  
  // Required
  "candidate_id": "candidate-uuid",
  "job_id": "job-uuid",
  
  // Pipeline
  "status": "interviewing",
  "stage_updated_date": "2026-04-18T10:00:00Z",
  "submitted_by": "recruiter@agency.com",
  "client_feedback": "Excellent candidate, proceeding to final",
  
  // Interviews
  "interview_dates": [
    {
      "date": "2026-04-10T14:00:00Z",
      "type": "phone_screen",
      "interviewer": "John Smith",
      "notes": "Strong communication",
      "feedback": "Proceed to technical"
    },
    {
      "date": "2026-04-18T10:00:00Z",
      "type": "technical",
      "interviewer": "Jane Doe",
      "notes": "Excellent coding skills",
      "feedback": "Recommend hire"
    }
  ],
  
  // AI matching
  "match_score": 94,
  "score_details": {
    "technical_skills": 96,
    "experience_match": 92,
    "culture_fit": 90,
    "location_compatibility": 100,
    "strengths": ["React/Node — 8 yrs", "Stripe background"],
    "concerns": ["No Kubernetes exp"],
    "recommendation": "Strong hire"
  }
}`} />
              </div>
            </div>
          </div>

          <InfoCard color="orange" title="Rate Limits & Best Practices">
            <li>100 requests/minute per user; 1000 requests/hour per user (Base44 platform limits)</li>
            <li>Bulk operations limited to 100 records per request</li>
            <li>Use filter() with specific fields + sort + limit to minimize data transfer</li>
            <li>Cache frequently accessed data (roles via rolesCache, company lists)</li>
            <li>Use bulkCreate for mass inserts; avoid N+1 create loops</li>
            <li>Implement loading guards (dashGuard pattern) to prevent duplicate concurrent fetches</li>
            <li>React Query for automatic deduplication and background refetching</li>
          </InfoCard>
        </div>
      )}

      {/* ── FILE MAP TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "filemap" && <FileMapTab />}
    </div>
  );
}

// ── FILE MAP COMPONENT (extracted for size) ───────────────────────────────────

function FileGroup({ title, color = "blue", children }) {
  const [open, setOpen] = useState(true);
  const colors = { blue: "border-[#2563EB] bg-[#EFF6FF]", purple: "border-[#7C3AED] bg-[#F5F3FF]", green: "border-[#16A34A] bg-[#F0FDF4]", orange: "border-[#D97706] bg-[#FFFBEB]", slate: "border-[#475569] bg-[#F8FAFC]", pink: "border-[#DB2777] bg-[#FDF2F8]", cyan: "border-[#0891B2] bg-[#ECFEFF]", red: "border-[#DC2626] bg-[#FEF2F2]" };
  return (
    <div className={`border-l-4 ${colors[color]} rounded-r-xl overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity">
        <span className="font-semibold text-[13px] text-[#1E293B]">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  );
}

function FileEntry({ name, path, purpose, details = [], deps = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E2E8F0] rounded-lg bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between px-3 py-2.5 text-left hover:bg-[#F8FAFC] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="font-mono text-[12px] font-semibold text-[#1E293B]">{name}</code>
            {path && <span className="text-[10px] text-[#94A3B8]">{path}</span>}
          </div>
          <p className="text-[11px] text-[#475569] mt-0.5">{purpose}</p>
        </div>
        {(details.length > 0 || deps.length > 0) && (
          open ? <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-1" />
        )}
      </button>
      {open && (details.length > 0 || deps.length > 0) && (
        <div className="px-3 pb-3 pt-1 border-t border-[#F1F5F9] space-y-2">
          {details.length > 0 && (
            <ul className="space-y-1">
              {details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-[#475569]">
                  <span className="text-[#2563EB] shrink-0 mt-0.5">→</span>{d}
                </li>
              ))}
            </ul>
          )}
          {deps.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1">Key dependencies / entities used</p>
              <div className="flex flex-wrap gap-1">
                {deps.map((d, i) => <code key={i} className="text-[10px] bg-[#F1F5F9] border border-[#E2E8F0] rounded px-1.5 py-0.5">{d}</code>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileMapTab() {
  return (
    <div className="space-y-5 text-[13px]">
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
        <p className="font-semibold text-[#1E293B] mb-1">Complete File Reference</p>
        <p className="text-[12px] text-[#64748B]">Every entity schema, backend function, component, page, and config file — purpose, responsibilities, key logic, and dependencies. Click any row to expand details.</p>
      </div>

      {/* ── ENTITIES ── */}
      <FileGroup title="Entities (Base44 JSON Schemas)" color="blue">
        {[
          { name: "Application.json", purpose: "Candidate–job pipeline tracking. Core submission flow entity.", details: ["Statuses: sourced → applied → screening → submitted → interviewing → offered → hired → rejected → withdrawn", "match_score + score_details: AI-generated scoring breakdown stored after AdvancedCandidateMatching run", "interview_dates: array of interview rounds with date, type, interviewer, notes, feedback", "stage_updated_date: auto-updated timestamp for SLA tracking", "RLS: read/write scoped to created_by or admin — recruiters only see own applications", "Used by: Submissions page, ApplicationPreview, CandidateDetails, Dashboard pipeline counts"] },
          { name: "AppSettings.json", purpose: "Global app configuration. Gates all email functionality.", details: ["email_provider: none | gmail | outlook — user selects in EmailSettings page", "provider_connected: boolean — must be true for ANY email feature to work (SendEmail gated here)", "from_name: optional sender display name override", "RLS: admin-only read and write — regular users cannot see or change settings", "Single-row table — one record represents the app's live config"] },
          { name: "AuditLog.json", purpose: "System audit trail for compliance and security monitoring.", details: ["Captures login events with IP (fetched from ipify.org) and user_agent on every session", "action field: 'login', 'update_status', or any custom event string", "meta: JSON object for additional context (entity type, record ID, old/new values)", "Write-only from client — no update or delete exposed in UI", "RLS: admin-only read — regular users cannot see audit log", "Layout.jsx writes one record per session via sessionStorage 'audit_logged' guard"] },
          { name: "AutomationRule.json", purpose: "Event-driven workflow rules. Fires email sends or task creation on entity status transitions.", details: ["trigger_entity: Submission | Application | Task | Candidate", "trigger_status_from / trigger_status_to: state machine transition to match", "action_type: send_email | create_task | send_notification", "email_template_id: lookup to EmailTemplate used for send actions", "email_recipient_type: candidate | recruiter | hiring_manager | custom", "delay_minutes: setTimeout-based delay (not durable — browser-dependent)", "trigger_count + last_triggered: execution tracking for monitoring", "executeAutomation.jsx loads all active rules and matches against each status change event"] },
          { name: "BlogPost.json", purpose: "CMS-style blog content for the public Blog page.", details: ["title, summary, cover_image_url, content (inferred), published_at, is_published", "Blog.jsx renders published posts as cards with cover images", "Created and managed from within the app by admins", "RLS: public read for is_published=true; admin write"] },
          { name: "Candidate.json", purpose: "Primary talent pool entity. Central to all recruitment workflows.", details: ["Required: first_name, last_name, email — minimum viable candidate record", "status enum: active | on_bench | our_bench | placed | inactive | do_not_contact | screened", "work_authorization: citizen | permanent_resident | h1b | opt | other — key for US staffing", "bench_match_score: persisted from BulkBenchScorer AI run (0–100)", "screening_score: persisted from CandidateScreening AI run (0–100)", "screening_details: {matching_qualifications[], missing_qualifications[], overall_fit}", "archive: soft-delete flag — archived candidates excluded from default views", "benchSalesRecruiterId, optRecruiterId, talentstackRecruiterId: multi-recruiter assignment fields", "consultantVisaStatus, consultantDob, consultantEmail: extended consultant profile fields", "workLocationPreference, exclusiveCandidate, underTraining: staffing-specific metadata", "RLS write: created_by OR admin OR user role — broad write access for recruiter teams"] },
          { name: "CandidateView.json", purpose: "Saved filter/sort/column presets for the Candidates list page.", details: ["name: view label shown in dropdown", "filters: JSON object matching Candidate field filters (e.g. {status: 'active'})", "sort: sort string (e.g. '-created_date')", "visibility: private | team — controls who sees the view", "is_default: boolean — one view per user can be default", "Used by: Candidates page view switcher, BulkBenchScorer cohort selector"] },
          { name: "Company.json", purpose: "CRM-style client company and connection management.", details: ["contacts: array of {name, email, phone, title, is_primary} — contacts used for email blast and invoice delivery", "job_stack_access: boolean — if true, all contacts receive email when new job is published to Job Stack", "type: client | internal — distinguishes paying clients from internal org", "status: active | prospect | inactive — CRM pipeline state", "primary_phone, secondary_phone: import helper fields for CSV bulk import", "RLS: open read; write scoped to created_by or admin"] },
          { name: "CompanyView.json", purpose: "Saved view presets for the Companies (Connections) list page.", details: ["columns: array of visible column keys and order", "filters: JSON filter object for company fields", "sort: sort order string", "visibility: private | team", "is_default flag per user"] },
          { name: "Consultant.json", purpose: "External consultant/contractor profiles for placement.", details: ["rate_min, rate_max, rate_type (hourly|daily|project): billing rate range", "specialization: array of expertise areas", "availability: available | busy | unavailable", "rating: 1–5 performance rating", "portfolio_url, linkedin_url: external profile links", "RLS: open read; write by created_by or admin"] },
          { name: "DashboardConfig.json", purpose: "Admin-defined global dashboard widget layout shared with all users.", details: ["widgets: array of widget config objects: {id, title, entity, widget_type, group_by, metric, cols, date_field, months, filter}", "widget_type: kpi | bar | pie | line | stacked", "is_global + is_active: only one active global config rendered for all users", "Admins drag-and-drop widget order; BuilderModal.jsx for creation/editing", "WidgetRenderer.jsx reads widget config and renders the appropriate chart/KPI"] },
          { name: "EmailTemplate.json", purpose: "Reusable email templates for automation, outreach, and invoices.", details: ["blocks: structured content block array for the visual EmailTemplateBuilder", "html_body: pre-rendered HTML used by SendEmail integration", "category: candidate_outreach | job_marketing | invoice | follow_up | internal_announcement | custom", "preview_text: shown in email client preview pane", "is_active: soft-delete / publish toggle", "Used by: AutomationRule (send_email action), EmailComposerModal, InvoiceForm"] },
          { name: "Expense.json", purpose: "Business expense tracking for finance management.", details: ["type: expense category (travel, software, marketing, etc.)", "is_recurring: flags recurring expenses for monthly reporting", "payment_method: card | cash | wire | check | other", "vendor: payee name for reconciliation", "RLS: created_by or admin — each user sees only own expenses unless admin"] },
          { name: "Goal.json", purpose: "Recruiter performance goal tracking with progress measurement.", details: ["recruiter_id: links to Recruiter or User ID for assignment", "start_date + end_date: goal period (e.g. quarterly)", "progress: 0–100 percentage updated manually or via completion logic", "status: draft | active | completed | on_hold | cancelled", "RLS: write by created_by or admin — recruiters manage own goals"] },
          { name: "InboundEmail.json", purpose: "Parsed inbound emails (job requirements or resumes). AI extraction pipeline.", details: ["from_email, to_email, subject, body: raw email content pasted or uploaded by user", "processing_status: pending | processing | completed | failed", "processing_notes: AI reasoning or error messages from parsing run", "candidate_id, job_id: linked records created/matched during AI parsing", "Flow: paste email → save as InboundEmail → LLM detects type → extracts fields → create/update Job or Candidate"] },
          { name: "InterviewSession.json", purpose: "Interview scheduling, question tracking, scoring, and AI summary generation.", details: ["interview_type: phone_screen | technical | behavioral | panel | final | case_study", "questions: array of {question, category, response, score} — per-question 1–5 rating", "overall_score: calculated weighted average from per-question scores (0–100)", "ai_summary: InvokeLLM-generated narrative evaluation of the session", "recommendation: final hiring recommendation text", "status: scheduled | completed | cancelled | no_show"] },
          { name: "Invoice.json", purpose: "Client invoices for recruitment placement and service fees.", details: ["items: array of {description, quantity, rate, amount} line items", "subtotal, tax_amount, total: calculated and stored (not computed on read)", "status: draft | sent | paid | overdue | void", "company_id: billed company — contacts used for email delivery", "InvoicePreview renders PDF-style preview; InvoiceForm handles creation/editing"] },
          { name: "Job.json", purpose: "Job openings and requirements from client companies. Core matching and submission driver.", details: ["status: draft | open | on_hold | filled | cancelled — 'open' triggers careers sync", "priority: low | medium | high | urgent — drives Dashboard open roles urgency", "remote_type: onsite | remote | hybrid", "employment_type: full_time | part_time | contract | contract_to_hire", "contract_type: c2c | w2 | 1099 | unknown — US staffing engagement model", "required_skills + preferred_skills: arrays used by AI matching", "requester_email + requester_name: parsed from inbound email by EmailInbox flow", "visa_restrictions: work auth notes extracted from JD text", "RLS: open read; write by created_by or admin"] },
          { name: "JobStack.json", purpose: "Public job board entries cloned from internal jobs.", details: ["original_job_id: links back to the source Job record", "client: denormalized company name for public display (without exposing company entity)", "status: active | closed — controls public visibility", "Companies with job_stack_access=true receive email notifications on new entries", "JobStack page (public) renders active entries for external candidates to apply"] },
          { name: "JobView.json", purpose: "Saved view presets for the Jobs list page.", details: ["columns: visible column keys array", "type: list | board (board view future-proofed)", "filters: JSON filter object for job fields", "sort, is_default, visibility: standard view fields"] },
          { name: "LeaveRequest.json", purpose: "Leave requests submitted by recruiters with admin approval workflow.", details: ["type: vacation | sick | personal | unpaid | other", "status: pending | approved | declined | revision_requested", "approver_id: admin user who acted on the request", "approved_date: timestamp of approval/decline action", "Leave dates block time entry in My Work page (WeeklyTimesheet validates against approved leaves)", "Auto-notification to admins on submission (via SendEmail integration)"] },
          { name: "MatchFeedback.json", purpose: "User feedback on AI match quality for continuous learning and profile improvement.", details: ["user_rating: 1–5 stars on match quality", "user_action: viewed | contacted | interviewed | hired | rejected | skipped", "criteria_accuracy: per-dimension accuracy booleans {technical_skills_accurate, experience_accurate, soft_skills_accurate, overall_fit_accurate}", "suggested_improvements: free-text recruiter feedback for profile tuning", "ai_model_used: which model generated this match (for comparison analysis)", "processing_time_ms: latency tracking for model performance comparison", "was_helpful: single overall helpfulness boolean"] },
          { name: "MatchingProfile.json", purpose: "Configurable AI matching profiles with weighted criteria, model selection, and learning.", details: ["criteria_weights: object with 7 dimensions (technical_skills, experience_years, role_seniority, domain_expertise, soft_skills, education, location_fit) — should sum to 100", "required_skills: array of {skill, importance: must_have|preferred|nice_to_have, min_years}", "soft_skills_keywords: extracted from candidate notes/profiles by AI (e.g. 'leadership', 'autonomous')", "matching_strategy: balanced | strict | lenient | learning", "ai_model: o1 | claude-4.5 | gpt-5 | gpt-4o | auto", "performance_metrics: {total_matches, accepted_matches, rejected_matches, accuracy}", "is_default: user's default profile applied to new matching runs"] },
          { name: "OutreachMessage.json", purpose: "Communication tracking with candidates across all channels.", details: ["channel: email | linkedin | phone | sms", "status: draft | sent | delivered | opened | replied", "sentiment: AI-classified positive | neutral | negative (from reply text)", "message_type: initial | follow_up | offer | rejection | interview_invite", "response_received: boolean flag for follow-up scheduling logic"] },
          { name: "Playbook.json", purpose: "Process documentation library with step-by-step guides, FAQs, and resource links.", details: ["steps: array of {title, description, order, checklist[], tips} — ordered process steps", "documents: array of {name, url, description, type: pdf|doc|video|link|template}", "keywords: array for AI semantic search indexing", "applicable_to: {job_types[], industries[], experience_levels[]} — contextual matching", "faqs: [{question, answer}] — in-playbook FAQ section", "version + changelog: version history tracking", "usage_count: incremented on view — popularity metric", "access_level: public | recruiter | manager | admin — visibility control", "RLS: read if is_active=true or created_by or admin"] },
          { name: "Recruiter.json", purpose: "Internal and external recruiter profiles with performance tracking.", details: ["role: internal | external | freelance — staffing model classification", "specializations: technology/domain expertise array (Java, DevOps, etc.)", "territory: geographic assignment for territory management", "performance_metrics: {placements_this_month, placements_this_year, revenue_generated}", "commission_rate: percentage for compensation calculation", "is_marketing: boolean — if true, receives job marketing email blasts from EmailBlastModal", "status: active | inactive | on_leave"] },
          { name: "Resume.json", purpose: "Structured resume data supporting versioning, AI building, and PDF preview.", details: ["experiences: [{company, role, location, start_date, end_date, bullets[]}] — work history", "education: [{school, degree, major, gpa, start_date, end_date, details[]}]", "projects: [{name, date, description[]}] — portfolio projects", "theme_color: hex accent color for ResumePreview PDF rendering", "candidate_id: optional link — resumes can exist standalone or linked to Candidate", "Multiple resumes per candidate supported (versioning via VersionsCompare)"] },
          { name: "Role.json", purpose: "Custom permission roles defining entity-level access control matrix.", details: ["permissions: map of entityName → {view: bool, create: bool, update: bool, delete: bool, scope: 'all'|'own'}", "scope 'own' enforces created_by filter client-side; RLS mirrors server-side", "Admin patches Recruiter role on app load to ensure Candidate.update is always available", "PermissionsContext reads Role on every session to resolve can() and listFilterFor()"] },
          { name: "Submission.json", purpose: "Recruiter-initiated candidate submissions to client jobs. Follow-up and interview tracking.", details: ["recruiter_id: required — submission ownership and scoped read/write", "follow_up_date + follow_up_completed: follow-up reminder system displayed in Submissions list", "interview_dates: interview round history array", "Kanban board statuses: submitted | under_review | interviewing | rejected | hired | withdrawn", "Auto-create Task (next-day follow-up) on submission creation", "companyName, squadTeam, h1bCap: denormalized formula-storage fields from legacy CRM import", "uniqueKey: case-insensitive dedup key for bulk import scenarios"] },
          { name: "SubmissionView.json", purpose: "Saved view presets for Submissions list and kanban.", details: ["view_type: board | list", "columns: visible column keys for list; kanban lane order for board", "filters, sort, visibility, is_default: standard view fields"] },
          { name: "Task.json", purpose: "Polymorphic work items and follow-ups linked to any entity.", details: ["related_entity: candidate | job | company | submission | general — entity type for linking", "related_id: UUID of the linked record — enables RelatedQuickLinks to surface tasks on any preview", "assigned_to: user email — primary scoping field for RLS", "priority: low | medium | high | urgent — drives Dashboard task urgency and color coding", "completion_notes: added on completion — visible in activity history", "Auto-completed by Layout.jsx when linked Candidate/Application status changes to inactive/rejected"] },
          { name: "TaskView.json", purpose: "Saved view presets for Tasks list and kanban.", details: ["view_type: board | list", "columns: statuses as kanban lanes for board view", "filters: e.g. {assigned_to: user.email, status: 'pending'}", "sort, visibility, is_default: standard view fields"] },
          { name: "Timesheet.json", purpose: "Time entries logged by recruiters with weekly submission and admin approval workflow.", details: ["date + hours: core fields — each entry is one day's work log", "job_id: optional job linkage for project-based time tracking", "status: draft | submitted | approved | rejected | needs_revision", "user_id: user email — RLS scopes to own entries or admin", "WeeklyTimesheet groups entries by week; RangeTimesheet spans custom date ranges", "Admins see all timesheets in Approvals page; batch approve with 'Approve All'"] },
        ].map(e => <FileEntry key={e.name} name={e.name} path="entities/" {...e} />)}
      </FileGroup>

      {/* ── FUNCTIONS ── */}
      <FileGroup title="Backend Functions (Deno Serverless)" color="orange">
        <FileEntry name="syncJobToCareers.ts" path="base44/functions/"
          purpose="Syncs an open job to the public TalentStack careers endpoint. Only durable backend operation in the app."
          details={[
            "Authenticates via createClientFromRequest(req) + base44.auth.me() — rejects if not authenticated",
            "Validates job_id presence in request body — returns 400 if missing",
            "Fetches Job and linked Company using base44.asServiceRole (bypasses RLS for server-side read)",
            "Transforms internal job record to public payload: title, description, rate, location, remote_type, employment_type, required_skills, client (company.name or 'Confidential'), status",
            "POSTs to https://talentstack.org/api/jobs with Content-Type: application/json",
            "Returns {success: true} on 2xx response; {error: 'Failed to sync'} on failure",
            "Called from Jobs.jsx on job save when status = 'open'",
            "Imported and invoked via: import { syncJobToCareers } from '@/functions/syncJobToCareers'"
          ]}
          deps={["Job", "Company", "base44.asServiceRole"]}
        />
      </FileGroup>

      {/* ── API ── */}
      <FileGroup title="src/api — Client SDK Layer" color="slate">
        <FileEntry name="base44Client.js" path="src/api/"
          purpose="Initializes and exports the Base44 SDK client singleton used throughout the entire app."
          details={[
            "Reads app_id and server_url from src/lib/app-params.js (resolved from VITE env vars + URL params)",
            "Creates client via createClient({appId, serverUrl})",
            "Exports { base44 } — imported in virtually every page and component that touches data",
            "Also exports all entity SDK handles via re-export from entities.js"
          ]}
        />
        <FileEntry name="entities.js" path="src/api/"
          purpose="Re-exports all entity SDK handles from base44Client for direct named imports."
          details={[
            "Exports: Candidate, Job, Company, Application, Submission, Task, Recruiter, etc.",
            "Components import entity handles from here: import { Candidate, Job } from '@/entities/all'",
            "Convenience layer — avoids base44.entities.Candidate.list() verbose syntax"
          ]}
        />
        <FileEntry name="integrations.js" path="src/api/"
          purpose="Re-exports Base44 integration functions for direct use in components."
          details={[
            "Exports: InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile, GenerateImage",
            "Components import: import { InvokeLLM } from '@/integrations/Core'",
            "Wraps base44.integrations.Core.* for cleaner import paths"
          ]}
        />
      </FileGroup>

      {/* ── COMPONENTS/AI ── */}
      <FileGroup title="components/ai — AI Feature Components" color="purple">
        {[
          { name: "AdvancedCandidateMatching.jsx", purpose: "Multi-criteria AI candidate matching against a job using configurable MatchingProfile weights.", details: ["Loads all active Candidates; user selects or uses default MatchingProfile", "Calls InvokeLLM with job + candidate + profile weights for each candidate", "Renders ranked results with per-dimension score bars, strengths, concerns, recommendation badge", "Saves MatchFeedback record on user action (contact, interview, reject, skip)", "Supports model selection: o1, claude-4.5, gpt-5, gpt-4o, auto", "Used in JobDetails page Advanced Matching tab"], deps: ["Candidate", "Job", "MatchingProfile", "MatchFeedback", "InvokeLLM"] },
          { name: "AdvancedScoring.jsx", purpose: "Deep single-candidate scoring against a job with detailed dimension breakdown.", details: ["Calls InvokeLLM with full candidate profile + job requirements", "Returns: overall score, technical_skills, experience, culture_fit, location scores", "Visual progress bars per dimension with color coding (green/yellow/red)", "Saves score to Application.score_details if application exists"], deps: ["Candidate", "Job", "InvokeLLM"] },
          { name: "Assistant.jsx", purpose: "Global floating AI assistant panel. Page-aware conversational chat with action execution.", details: ["Loads context data from Candidates, Jobs, Applications, Tasks based on current page", "Maintains conversation history array for multi-turn context", "InvokeLLM call with action_type classification: qa | navigate | create_candidate | create_task | search", "Quick prompt buttons: 'Top candidates', 'Overdue tasks', 'Pipeline health'", "Floating launcher button bottom-right of every authenticated page", "Collapsed state persisted in component state; expands as side panel"], deps: ["Candidate", "Job", "Application", "Task", "InvokeLLM"] },
          { name: "BulkBenchScorer.jsx", purpose: "Batch AI scoring of a candidate cohort (Candidate View) against a selected job.", details: ["User selects a CandidateView (defaults to status=our_bench) and an open/draft Job", "Iterates candidates — skips those without resume_url (marks as 'Skipped')", "For each scored candidate: InvokeLLM with resume text + job requirements", "Persists bench_match_score (number) + bench_score_details (object) to Candidate", "Real-time progress bar with per-candidate status (Pending/Scoring/Done/Skipped/Error)", "Summary stats at completion: scored, skipped, errors"], deps: ["Candidate", "CandidateView", "Job", "InvokeLLM"] },
          { name: "BulkScoring.jsx", purpose: "Multi-candidate scoring in a single modal for pipeline analysis.", details: ["Scores selected candidates against a job in sequence", "Lighter than BulkBenchScorer — does not persist to Candidate entity", "Used for ad-hoc pipeline review; results shown in-modal only"], deps: ["Candidate", "Job", "InvokeLLM"] },
          { name: "CandidateOutreach.jsx", purpose: "AI-generated personalized outreach email drafting for recruiters.", details: ["Inputs: candidate profile + target job + tone selector (professional, friendly, urgent)", "InvokeLLM generates subject line + email body", "User can regenerate, edit, or send directly via SendEmail integration", "Saves OutreachMessage record on send with status='sent'"], deps: ["Candidate", "Job", "OutreachMessage", "InvokeLLM", "SendEmail"] },
          { name: "CandidateScreening.jsx", purpose: "AI fit analysis for a single candidate against a job. Produces screening_score.", details: ["Calls InvokeLLM with candidate resume/skills + job requirements", "Returns: screening_score (0–100), matching_qualifications[], missing_qualifications[], overall_fit", "Persists screening_score + screening_details + screening_date to Candidate entity", "Shown in CandidateDetails Screening tab and right-side preview panel"], deps: ["Candidate", "Job", "InvokeLLM"] },
          { name: "CandidateWorkflowAgent.jsx", purpose: "Orchestrates multi-step AI workflow for a candidate (screen → score → outreach).", details: ["Chains: CandidateScreening → AdvancedScoring → CandidateOutreach in sequence", "Used to automate the full intake-to-outreach workflow in one action", "Progress indicator for each step; stops on error"], deps: ["Candidate", "Job", "InvokeLLM"] },
          { name: "InterviewAssistant.jsx", purpose: "AI-powered interview management: question generation, per-question scoring, session summary.", details: ["Question library: 5 categories (technical, behavioral, cultural, situational, role-specific)", "Per-question 1–5 rating slider; live weighted score calculator", "AI Summary: InvokeLLM generates narrative evaluation using scores + question responses", "Saves InterviewSession record with questions[], overall_score, ai_summary, recommendation"], deps: ["InterviewSession", "Candidate", "Job", "InvokeLLM"] },
          { name: "MatchingProfileEditor.jsx", purpose: "UI for creating and editing MatchingProfile records with weight sliders and model selection.", details: ["7 dimension weight sliders (technical_skills, experience_years, role_seniority, domain_expertise, soft_skills, education, location_fit) with live sum-to-100 validation", "Skill importance selector: must_have | preferred | nice_to_have per skill", "Model selector: o1, claude-4.5, gpt-5, gpt-4o, auto", "Strategy dropdown: balanced | strict | lenient | learning", "Performance metrics display: acceptance rate, accuracy over time"], deps: ["MatchingProfile"] },
          { name: "RecommendedCandidates.jsx", purpose: "Shows top AI-recommended candidates for a job based on existing match scores.", details: ["Filters Candidates with bench_match_score or screening_score above threshold", "Sorted by score descending; displayed as ranked card list", "Quick actions: view profile, start matching, create application"], deps: ["Candidate", "Application", "MatchFeedback"] },
          { name: "ResumeComparison.jsx", purpose: "Side-by-side comparison of two candidate resumes.", details: ["Loads two Resume records by ID", "Renders dual-column preview layout with highlights on differences", "Used in Resume Studio Compare tab"], deps: ["Resume"] },
          { name: "ResumeVersionComparison.jsx", purpose: "Compares two versions of the same candidate's resume (version history diff).", details: ["Renders structured diff: added sections, removed bullets, changed summaries", "Color-coded: green for additions, red for removals", "Used in Resume Studio Versions tab"], deps: ["Resume"] },
          { name: "ScoreDisplay.jsx", purpose: "Reusable score badge/bar component used across all AI scoring surfaces.", details: ["Input: score (0–100), label, variant (badge|bar|circle)", "Color logic: ≥85 green, ≥70 yellow, <70 red", "Used in: CandidatePreview, Submissions table, AdvancedScoring, BulkBenchScorer results"] },
          { name: "TalentPipelineAnalytics.jsx", purpose: "AI-generated pipeline insights and trend narratives.", details: ["Aggregates pipeline stage counts, skill gaps, conversion rates", "InvokeLLM generates: pipeline_health (healthy|at_risk|critical), skill_gaps[], hiring_forecast, key_bottlenecks[]", "Renders insight cards with urgency indicators", "Called from Dashboard AI Insights panel 'Refresh' button"], deps: ["Candidate", "Job", "Application", "InvokeLLM"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/ACCOUNTS ── */}
      <FileGroup title="components/accounts — Finance Components" color="cyan">
        {[
          { name: "EmailComposerModal.jsx", purpose: "Modal for composing and sending emails to company contacts.", details: ["To field: auto-populated from Company.contacts array", "Supports EmailTemplate selection — pre-fills subject and body", "Calls SendEmail integration on submit; gated by AppSettings.provider_connected", "Used for invoice delivery and general company communication"], deps: ["Company", "EmailTemplate", "SendEmail"] },
          { name: "ExpenseForm.jsx", purpose: "Create/edit expense records with category, vendor, amount, and recurring flag.", details: ["Type dropdown: travel, software, marketing, payroll, office, other", "is_recurring checkbox shows recurring badge in Expenses list", "Date picker, amount input with currency formatting"], deps: ["Expense"] },
          { name: "InvoiceForm.jsx", purpose: "Full invoice creation/editing with line items, tax, and totals.", details: ["Dynamic line item rows: add/remove items with description, quantity, rate, auto-calculated amount", "Tax rate input with auto-calculated tax_amount and total", "Company selector (lookup to Company.contacts for email delivery)", "Status dropdown: draft | sent | paid | overdue | void", "EmailComposerModal triggered for invoice delivery to company contacts"], deps: ["Invoice", "Company", "EmailTemplate"] },
          { name: "InvoicePreview.jsx", purpose: "PDF-style invoice rendering for print and preview.", details: ["Renders invoice items as table with subtotal, tax, total rows", "Company logo placeholder, invoice number, issue/due dates", "Print-optimized CSS via @media print", "Shown in Invoices page side panel before sending"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/AGENTS ── */}
      <FileGroup title="components/agents — AI Agent Builder" color="purple">
        <FileEntry name="AIAgentBuilder.jsx" purpose="Visual builder UI for configuring AI agent definitions (currently management shell on mock data)."
          details={[
            "Agent form: name, description, trigger_type (entity|scheduled|manual), trigger_entity, conditions",
            "Tool configuration: select entities and allowed_operations per tool",
            "AI model selection for agent reasoning: o1, claude-4.5, gpt-5, gpt-4o",
            "Workflow steps builder: add AI prompt steps, entity operation steps, email steps",
            "Enable/disable toggle; execution stats display (runs, success rate, avg duration)",
            "Note: currently operates on mock agent data — not a production execution engine"
          ]}
        />
      </FileGroup>

      {/* ── COMPONENTS/CANDIDATES ── */}
      <FileGroup title="components/candidates — Candidate Components" color="blue">
        {[
          { name: "BulkResumeUpload.jsx", purpose: "Upload multiple PDF resumes at once; AI extracts and creates/updates Candidate records.", details: ["File picker accepts multiple PDFs; uploads each via UploadFile", "ExtractDataFromUploadedFile extracts structured candidate data from each PDF", "Email deduplication: checks existing Candidates by email before create", "Progress tracker per file: Uploading → Extracting → Saving → Done | Error", "Creates Candidate with resume_url + extracted fields; updates if email match found"], deps: ["Candidate", "UploadFile", "ExtractDataFromUploadedFile"] },
          { name: "CandidateAIEnrichment.jsx", purpose: "Fills missing candidate profile fields using AI analysis of existing data.", details: ["Detects missing fields: current_title, skills, experience_years, location, summary", "InvokeLLM prompt: infer missing fields from notes, current_company, linkedin_url", "Applies only missing fields — does not overwrite existing data", "Shows diff preview before applying; user confirms before save"], deps: ["Candidate", "InvokeLLM"] },
          { name: "CandidateAISummary.jsx", purpose: "AI-generated candidate profile summary panel with Q&A follow-up.", details: ["InvokeLLM generates 2–3 paragraph professional summary from all candidate fields", "Displayed as collapsible panel in CandidateDetails and preview", "Regenerate button: re-runs with 'focus on [aspect]' variation prompts", "Q&A mode: user types question about candidate; AI answers with citations from profile"], deps: ["Candidate", "InvokeLLM"] },
          { name: "CandidateDetails.jsx", purpose: "Full candidate detail page with tabs: Overview, Applications, Submissions, Tasks, Resumes, Activity.", details: ["Overview tab: all profile fields in edit mode + AI summary panel", "Applications tab: linked Application records with status and match scores", "Submissions tab: linked Submission records with follow-up status", "Tasks tab: linked Task records via related_entity='candidate' + related_id", "Resumes tab: linked Resume versions; open in Studio or compare", "Activity tab: timeline of status changes and recruiter interactions", "Edit mode: inline form editing with CandidateForm"], deps: ["Candidate", "Application", "Submission", "Task", "Resume"] },
          { name: "CandidateForm.jsx", purpose: "Create/edit candidate modal form with all profile fields.", details: ["Required: first_name, last_name, email — validates before save", "Skills: tag input with add/remove", "work_authorization, availability, status: enum selects", "Resume upload: UploadFile integration; resume_url stored on Candidate", "linkedin_url validation; salary_expectation as number input"], deps: ["Candidate", "UploadFile"] },
          { name: "CandidatePreview.jsx", purpose: "Right-side preview panel card for a candidate. Quick info without full navigation.", details: ["Shows: avatar, name, title, company, location, status badge, skills chips", "AI screening score display via ScoreDisplay component", "Quick actions: Edit (navigates to CandidateDetails), Create Task, Screen with AI", "Status update dropdown: inline status change from preview", "Applications summary: count and latest stage"], deps: ["Candidate", "Application"] },
          { name: "CandidatesBulkUpdateModal.jsx", purpose: "Bulk update status, assigned recruiter, or tags across selected candidates.", details: ["Field selector: which field to update (status, benchSalesRecruiterId, tags)", "Value input appropriate to field type (enum select, user picker, tag input)", "Confirmation count shown; bulk update via Promise.all(candidates.map(c => Candidate.update))", "Used from Candidates page selection toolbar"], deps: ["Candidate"] },
          { name: "PasteToAddCandidate.jsx", purpose: "Quick candidate creation from pasted resume text or LinkedIn bio.", details: ["Large textarea for pasting unstructured text", "InvokeLLM extracts: first_name, last_name, email, phone, current_title, experience_years, skills[], work_authorization, location, summary", "Shows extracted fields preview before saving — user can edit any field", "Creates Candidate with extracted data; original text stored in notes field", "Duplicate check by email before create"], deps: ["Candidate", "InvokeLLM"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/COMMON ── */}
      <FileGroup title="components/common — Shared UI Utilities" color="slate">
        {[
          { name: "AccessBlocker.jsx", purpose: "Full-page overlay shown to locked or inactive users who reach authenticated routes.", details: ["Displays user email, lock reason (is_locked vs. inactive status)", "Sign out button calls base44.auth.logout()", "Contact admin message with app branding"] },
          { name: "AIQuickActions.jsx", purpose: "Conversational AI action panel triggered by ⌘J or floating button.", details: ["Chat interface with history; InvokeLLM classifies intent: navigate | create_candidate | create_job | create_task | search | upload_resume | log_time | request_leave", "Executes action: navigate via React Router, create via entity SDK, show confirmation", "Keyboard shortcut: ⌘J / Ctrl+J; also triggered by window 'openAIQuickActions' event", "Maintains conversation_history array for multi-turn context"], deps: ["Candidate", "Job", "Task", "InvokeLLM"] },
          { name: "CommandPalette.jsx", purpose: "Global search command palette triggered by ⌘K.", details: ["cmdk library for fuzzy search interface", "Searches across: pages (navigation), candidates (name/email), jobs (title), companies (name)", "Recent searches stored in localStorage", "Enter navigates or triggers preview:open event for entity results"] },
          { name: "DataListModal.jsx", purpose: "Generic modal for displaying tabular data from Dashboard metric card clicks.", details: ["Accepts: title, columns (key+label array), rows (data array)", "Renders sortable table with column headers", "Used by Dashboard openModalFor() for candidates, jobs, companies, hires lists"] },
          { name: "DeleteConfirmModal.jsx", purpose: "Confirmation dialog before destructive delete operations.", details: ["Shows entity name and record title to delete", "Requires typing 'delete' or clicking confirm button", "Used across Candidates, Jobs, Companies, Tasks, Submissions pages"] },
          { name: "EmailModal.jsx", purpose: "Quick email composition modal using EmailTemplate selection.", details: ["Template picker populates subject + body", "To field with multiple recipient support", "Calls SendEmail; gated by AppSettings.provider_connected", "Used from Candidate and Submission quick action menus"], deps: ["EmailTemplate", "SendEmail"] },
          { name: "ImportModal.jsx", purpose: "CSV/Excel bulk import modal for any entity.", details: ["File upload; ExtractDataFromUploadedFile extracts rows", "Column mapping UI: map CSV columns to entity fields", "Preview first 5 rows before import; row-by-row create with error tracking"], deps: ["ExtractDataFromUploadedFile"] },
          { name: "InviteUserModal.jsx", purpose: "Admin modal to invite new users by email with role assignment.", details: ["Email input + role selector (admin | user)", "Calls base44.users.inviteUser(email, role)", "Shows success confirmation with invited email"] },
          { name: "KeyboardShortcuts.jsx", purpose: "Keyboard shortcuts reference overlay triggered by '?' key.", details: ["Lists all shortcuts: ⌘K (search), ⌘J (AI actions), ? (this panel), ESC (close modals)", "Displayed as modal with shortcut badges"] },
          { name: "ListViewSettingsModal.jsx", purpose: "Modal for creating and editing saved list view configurations.", details: ["Fields: name, visibility (private|team), default flag", "Filter builder: add/remove field filter conditions", "Sort selector: field + direction", "Column selector: drag-and-drop column ordering and visibility", "Used by: CandidateView, JobView, SubmissionView, TaskView, CompanyView"], deps: ["CandidateView", "JobView", "SubmissionView", "TaskView"] },
          { name: "PageHeader.jsx", purpose: "Standardized page title, subtitle, and action area component.", details: ["title prop: h1-level page name with display font", "subtitle prop: secondary description line", "children: right-aligned action buttons slot", "Used at top of every internal page for consistent layout"] },
          { name: "PermissionGate.jsx", purpose: "Wrapper that conditionally renders children based on permission check.", details: ["Props: entity (string), action ('view'|'create'|'update'|'delete')", "Uses usePermissions().can(entity, action) — renders null if not permitted", "Used throughout UI to hide/show buttons, tabs, and form sections based on role"] },
          { name: "PermissionsContext.jsx", purpose: "React context providing role-based access control resolution for all components.", details: ["Loads current User + Role on mount; reloads on storage events for multi-tab sync", "Computes isAdmin: user.role='admin' OR role.name.toLowerCase()='admin'", "can(entity, action): checks Role.permissions[entity][action]", "listFilterFor(entity): returns filter object for scoped data fetching (e.g. {created_by: me.email})", "Special cases: Task → {assigned_to: me.email}, Submission → {recruiter_id: me.id}"], deps: ["User", "Role"] },
          { name: "QuickActions.jsx", purpose: "Floating quick-add menu for creating common records from anywhere in the app.", details: ["Listens for 'quickAction' window event from Layout.jsx navigation actions", "Routes: add_candidate → Candidates page + triggers add form, add_job, add_company, etc."] },
          { name: "refreshBus.jsx", purpose: "Lightweight pub/sub event bus for triggering entity list refreshes across components.", details: ["subscribe(entityName, callback): register refresh listener", "publish(entityName): notify all listeners to re-fetch", "Used after CRUD operations to sync sibling components without prop drilling"] },
          { name: "RelatedQuickLinks.jsx", purpose: "Shows related entity quick-links on any preview panel (tasks, applications, submissions for a candidate).", details: ["Props: entity type + record ID", "Queries Tasks, Applications, Submissions by related_id", "Renders count badges and quick-navigate links"] },
          { name: "RightPreviewPanel.jsx", purpose: "Sliding right-side panel container for entity previews.", details: ["Animates in/out from right edge (framer-motion slide)", "Listens for 'preview:open' and 'preview:close' window events", "Closes on route change (useEffect on location.pathname)", "Renders appropriate preview component based on entity type"] },
          { name: "StatusPath.jsx", purpose: "Visual pipeline status path component showing current stage and transitions.", details: ["Renders horizontal step indicators for Application/Submission status flow", "Highlights current stage; completed stages shown with checkmark", "Click to advance status (if user has update permission)"] },
          { name: "useDebouncedValue.jsx", purpose: "React hook for debouncing search input values.", details: ["Usage: const debouncedSearch = useDebouncedValue(searchQuery, 300)", "Prevents excessive API calls during typing; standard 300ms delay"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/AUTOMATION ── */}
      <FileGroup title="components/automation — Workflow Automation" color="orange">
        <FileEntry name="AutomationRuleForm.jsx" purpose="Create/edit AutomationRule records with trigger and action configuration."
          details={["Trigger type selector: status_change | time_based | manual", "Entity selector: Submission | Application | Task | Candidate", "Status from/to selectors: enum values per entity", "Action type: send_email (shows template picker) | create_task (shows task config)", "Delay minutes input for deferred execution", "Active toggle"]}
          deps={["AutomationRule", "EmailTemplate"]}
        />
        <FileEntry name="executeAutomation.jsx" purpose="Client-side automation rule executor triggered on entity status changes."
          details={["Called from Submissions and Applications pages after status update", "Loads all active AutomationRule rows matching trigger_entity + trigger_status_to", "Optional trigger_status_from check for specific transitions", "setTimeout delay per rule's delay_minutes setting", "send_email: renders EmailTemplate, calls SendEmail with recipient determined by email_recipient_type", "create_task: creates Task record linked to the triggering entity", "Updates AutomationRule.trigger_count++ and last_triggered timestamp"]}
          deps={["AutomationRule", "EmailTemplate", "Task", "SendEmail"]}
        />
      </FileGroup>

      {/* ── COMPONENTS/JOBS ── */}
      <FileGroup title="components/jobs — Job Components" color="blue">
        {[
          { name: "BulkJobPaste.jsx", purpose: "Paste multiple job descriptions at once; AI parses each into Job records.", details: ["Textarea for pasting 1+ JDs separated by delimiter", "InvokeLLM extracts per JD: title, required_skills, location, remote_type, employment_type, rate, experience_required", "Preview cards for each parsed job before saving", "Bulk create via Job.bulkCreate()"], deps: ["Job", "InvokeLLM"] },
          { name: "EmailBlastModal.jsx", purpose: "Send job marketing emails to selected recruiters (is_marketing=true) or candidates.", details: ["Recipient selector: all marketing recruiters OR selected candidates", "Template picker or compose inline", "AI Generate option: InvokeLLM drafts job marketing email from job data", "SendEmail called per recipient; progress tracking"], deps: ["Job", "Recruiter", "Candidate", "EmailTemplate", "InvokeLLM", "SendEmail"] },
          { name: "JobForm.jsx", purpose: "Create/edit job modal with all fields including skills, rate, and requirements.", details: ["Required: title, company_id — company selector with search", "Skills: tag inputs for required_skills and preferred_skills", "Status/priority enums; remote_type and employment_type selects", "Due date picker; positions_available number input", "On save with status='open': triggers syncJobToCareers function call"], deps: ["Job", "Company"] },
          { name: "JobNotificationEmail.jsx", purpose: "Renders job notification email HTML for Job Stack company notifications.", details: ["Template: job title, description, skills, rate, apply CTA", "Rendered HTML passed to SendEmail for job_stack_access companies"] },
          { name: "JobsBulkUpdateModal.jsx", purpose: "Bulk update status or priority across selected jobs.", details: ["Field selector: status | priority", "Value selector: enum options per field", "Confirmation count; bulk update via Promise.all"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/RESUME ── */}
      <FileGroup title="components/resume — Resume Studio Components" color="green">
        {[
          { name: "ResumeFormLeft.jsx", purpose: "Left-panel inline form editor for the Resume Studio Build tab.", details: ["Section accordions: Summary, Experience, Education, Projects, Skills", "Dynamic rows for experience and education entries (add/remove/reorder)", "Bullet point inputs for experience bullets array", "theme_color hex picker for accent color", "Auto-saves on field blur; linked to ResumePreview via shared state"], deps: ["Resume"] },
          { name: "ResumePreview.jsx", purpose: "Right-panel PDF-style resume preview rendered from Resume entity data.", details: ["Real-time render from ResumeFormLeft state", "theme_color applied to section headers and name", "Zoom controls (50%–150%); Print button triggers window.print()", "Responsive two-column layout with left info bar + right content"] },
          { name: "ResumeAIAssistant.jsx", purpose: "In-Resume Studio conversational AI for content improvement suggestions.", details: ["Chat panel alongside editor; user asks for improvements", "InvokeLLM with current resume JSON + user message", "Can target specific section: 'improve my summary', 'add more bullets to my Stripe experience'", "Apply suggestion button patches specific resume field"], deps: ["Resume", "InvokeLLM"] },
          { name: "ResumeLLMBuilder.jsx", purpose: "AI-powered full resume generation from a job description or role input.", details: ["Input: target job title/description or paste JD", "InvokeLLM generates complete Resume JSON: summary, experiences[], education[], skills[], projects[]", "Preview generated resume before saving; user edits before confirm", "Creates or updates Resume record on save"], deps: ["Resume", "InvokeLLM"] },
          { name: "ResumeScorer.jsx", purpose: "JD vs Resume fit scoring with weighted dimension breakdown.", details: ["Two inputs: paste/upload JD text + paste/upload resume text", "InvokeLLM returns: overall_score, hard_skills_score, education_score, title_match_score, soft_skills_score", "Weight display: Hard Skills (35%), Education (25%), Job Title (20%), Soft Skills (20%)", "Used in Resume Studio Score tab and ResumeAnalysis page"], deps: ["InvokeLLM"] },
          { name: "JDResumeCompare.jsx", purpose: "Side-by-side JD vs Resume comparison with gap analysis.", details: ["Renders two-column view: JD requirements vs candidate resume sections", "AI identifies: matched requirements (green), gaps (red), partial matches (yellow)", "Actionable recommendations: 'Add Kubernetes to skills'"], deps: ["InvokeLLM"] },
          { name: "BulkRanker.jsx", purpose: "Ranks multiple resumes against a single JD in batch.", details: ["Upload multiple resume PDFs; extract text from each", "Score each against JD via InvokeLLM", "Sort by score descending; tabular results with download option"], deps: ["InvokeLLM", "UploadFile", "ExtractDataFromUploadedFile"] },
          { name: "VersionsCompare.jsx", purpose: "Side-by-side diff comparison of two Resume versions.", details: ["Loads two Resume records by ID; renders dual ResumePreview", "Highlighted diff sections for changed content"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── COMPONENTS/SUBMISSIONS + TASKS ── */}
      <FileGroup title="components/submissions + tasks — Pipeline Components" color="blue">
        {[
          { name: "submissions/KanbanBoard.jsx", purpose: "Drag-and-drop kanban for submissions across status lanes.", details: ["@hello-pangea/dnd for drag-and-drop; dropping card updates Submission.status", "Lanes: submitted → under_review → interviewing → hired / rejected", "SubmissionKanbanCard per card; column counts shown in lane header", "executeAutomation called on status change"], deps: ["Submission", "AutomationRule"] },
          { name: "submissions/SubmissionForm.jsx", purpose: "Create/edit submission modal with candidate + job + recruiter selection.", details: ["Candidate search dropdown; Job search dropdown; Recruiter select", "follow_up_date date picker; notes textarea", "On create: auto-creates next-day follow-up Task linked to submission"], deps: ["Submission", "Candidate", "Job", "Recruiter", "Task"] },
          { name: "submissions/FollowUpForm.jsx", purpose: "Quick follow-up update form for marking follow_up_completed and logging client_feedback.", details: ["follow_up_date update; client_feedback textarea", "follow_up_completed toggle", "Used from Submissions list quick-action menu"] },
          { name: "submissions/SubmissionDetails.jsx", purpose: "Detailed submission view with interview history and status timeline.", details: ["Interview rounds display with dates, types, feedback", "Status path visual indicator", "AI summary of submission history (InvokeLLM)"], deps: ["Submission", "Candidate", "Job"] },
          { name: "tasks/KanbanBoard.jsx", purpose: "Kanban board for Tasks with drag-and-drop status updates.", details: ["Lanes: pending → in_progress → completed", "TaskKanbanCard per card with priority color coding", "Drag updates Task.status via Task.update()"] },
          { name: "tasks/TaskForm.jsx", purpose: "Create/edit task modal with entity linking and assignment.", details: ["Title, description, priority, status, due_date inputs", "related_entity + related_id selectors for polymorphic linking", "assigned_to: user email selector from Users list", "Tags input for categorization"] },
          { name: "tasks/TaskDetails.jsx", purpose: "Expanded task view with linked entity context and completion notes.", details: ["Shows linked entity (candidate/job/company) with quick-navigate link", "Completion notes textarea shown when completing", "Activity timeline for status changes"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── PAGES ── */}
      <FileGroup title="pages — Application Pages" color="purple">
        {[
          { name: "AccessControl.jsx", purpose: "Admin page for user management, role assignment, and permission matrix editing.", details: ["Users tab: list all users, search by name/email, assign role_id, lock/unlock, invite via InviteUserModal", "Roles tab: create/edit Role records with per-entity permission toggles (view/create/update/delete) and scope (all|own)", "Audit Log tab: view AuditLog records with IP, user agent, timestamp", "Permission matrix rendered as checkbox grid: rows = entities, cols = actions", "Role patch on load: auto-ensures Recruiter role has Candidate.update permission"], deps: ["User", "Role", "AuditLog"] },
          { name: "AIAgents.jsx", purpose: "Admin management surface for AI automation agents (currently mock data).", details: ["Agent list with status indicators, trigger type, last run, success rate", "Performance stats: total runs, success rate, avg duration", "Enable/disable toggle per agent", "AIAgentBuilder modal for creating/editing agent definitions", "Pre-configured agents: Job Matcher, Follow-up Reminder, Profile Enrichment (mock data)"] },
          { name: "Approvals.jsx", purpose: "Admin workflow for approving/declining timesheets and leave requests.", details: ["Quick stats: pending leaves, pending timesheets, total hours awaiting, users waiting", "'Approve All' batch action for efficiency", "Timesheets tab: grouped by user + week with hours summary; approve/reject/needs_revision per group", "Leave Requests tab: pending requests with date range, type, reason; approve/decline actions", "AI Insights: InvokeLLM analyzes workload distribution, leave patterns, approval efficiency"], deps: ["Timesheet", "LeaveRequest", "InvokeLLM"] },
          { name: "AutomationRules.jsx", purpose: "CRUD page for AutomationRule records with active/inactive management.", details: ["List with trigger entity, status transition, action type, trigger count, last triggered", "AutomationRuleForm modal for create/edit", "Toggle active state; delete with confirmation", "Preview: 'When [entity] changes to [status] → [action]' summary text"] },
          { name: "BRD.jsx", purpose: "This file — comprehensive Business Requirements Document with 7 tabs.", details: ["Document, Architecture, Data Model, AI & LLMs, Security, API Reference, File Map tabs", "EntityBlock with expandable field rows + relationship graph", "Section collapsible components for document sections", "FileGroup + FileEntry components for this file map"] },
          { name: "Candidates.jsx", purpose: "Main talent pool page with saved views, bulk ops, AI scoring, and import.", details: ["Saved view selector (CandidateView); default view applied on load", "Search debounced 300ms; filter by status, skills, work_auth, location", "Sort by created_date, name, screening_score, bench_match_score", "Bulk select → bulk status update, delete, score via CandidatesBulkUpdateModal and BulkBenchScorer", "Paste to Add button (purple) → PasteToAddCandidate modal", "Bulk Resume Upload → BulkResumeUpload modal", "Pagination: 50 per page", "Right-side preview on row click → CandidatePreview panel"], deps: ["Candidate", "CandidateView", "Application"] },
          { name: "Companies.jsx", purpose: "CRM-style connections management with contact viewing and bulk ops.", details: ["List with search, industry filter, status filter, type filter", "CompanyDetailsModal for quick view with job count, contacts list", "CompanyForm for create/edit", "CompanyEmailBlastModal for sending email blasts to selected company contacts", "BulkUpdateModal for bulk status/type changes", "job_stack_access toggle per company for Job Stack notifications"], deps: ["Company", "Job"] },
          { name: "Dashboard.jsx", purpose: "Main operational dashboard with 3 tabs: Overview, Pipeline, Activity.", details: ["Overview: Pipeline Funnel + Today's Tasks (top); Recent Candidates table + AI Insights (bottom)", "Pipeline: stage KPI cards, conversion funnel with drop-off rates, bar chart, open roles table", "Activity: summary KPIs, recent candidate activity feed, all pending tasks panel", "Admin: customizable global widget dashboard (BuilderModal + WidgetRenderer)", "Loads: Candidates, Jobs, Companies, Applications, Submissions, Tasks — all in parallel", "dashGuard: 30s debounce prevents duplicate concurrent fetches", "AI Insights via TalentPipelineAnalytics or inline InvokeLLM call"], deps: ["Candidate", "Job", "Company", "Application", "Submission", "Task", "DashboardConfig"] },
          { name: "DuplicateManager.jsx", purpose: "AI-assisted detection and resolution of duplicate candidate and company records.", details: ["Loads all Candidates; InvokeLLM compares name/email/phone similarity", "Groups suspected duplicates; shows confidence score per pair", "Merge action: combine fields from both records into one; delete duplicate", "Also supports Company deduplication"], deps: ["Candidate", "Company", "InvokeLLM"] },
          { name: "EmailBlast.jsx", purpose: "Mass email campaign tool for all company contacts.", details: ["Aggregates contacts from all Company.contacts arrays; deduplicates emails", "Stats: total companies, total contacts, unique emails", "Selective company inclusion/exclusion via checkbox list", "AI Generate: InvokeLLM drafts professional campaign body from subject line", "Export: copy to clipboard (comma-separated), download CSV, open in email client via mailto BCC"], deps: ["Company", "InvokeLLM"] },
          { name: "EmailInbox.jsx", purpose: "AI-powered inbound email parsing for job requirements and resumes.", details: ["User pastes or uploads email content; saved as InboundEmail", "AI detect flow: InvokeLLM classifies as 'job_requirement' or 'resume'", "Job flow: extract title, skills, rate, location, company → create/update Job", "Resume flow: extract candidate fields → create/update Candidate → create Application", "Processing status shown per email with notes"], deps: ["InboundEmail", "Job", "Candidate", "Application", "InvokeLLM"] },
          { name: "EmailSettings.jsx", purpose: "Admin configuration for email provider connection.", details: ["Provider selector: Gmail | Outlook | None", "provider_connected toggle (manual confirmation — no OAuth in current impl)", "from_name override input", "Warning banner shown on all email features when provider_connected=false"], deps: ["AppSettings"] },
          { name: "Goals.jsx", purpose: "Recruiter performance goal management with progress tracking.", details: ["List with recruiter name, title, date range, progress bar, status", "GoalForm modal for create/edit with progress slider", "Filter by recruiter, status, date range"], deps: ["Goal", "Recruiter"] },
          { name: "Jobs.jsx", purpose: "Job management with saved views, AI matching, bulk ops, and careers sync.", details: ["Saved view selector (JobView); column visibility controls", "Priority color coding; status workflow", "AI Recommended Candidates button per job → RecommendedCandidates modal", "EmailBlastModal for job marketing", "BulkJobPaste for multi-JD import", "syncJobToCareers called on status change to 'open'", "BulkUpdateModal for mass status/priority updates"], deps: ["Job", "Company", "Candidate", "JobView"] },
          { name: "MyWork.jsx", purpose: "Personal time tracking and leave management for recruiters.", details: ["Overview tab: this week's hours, approved hours total, pending leave requests", "Quick Entry tab: single-day time entry form (saves as draft)", "Weekly Submit tab: WeeklyTimesheet component for weekly grid entry and submission", "Leave Requests tab: list own requests + LeaveForm to create new", "Leave validation: blocks time entry on dates with approved leave"], deps: ["Timesheet", "LeaveRequest"] },
          { name: "PipelineAnalytics.jsx", purpose: "Detailed recruitment pipeline analytics with charts and AI insights.", details: ["Stage conversion funnel chart (recharts BarChart)", "Time-to-fill analysis by job and stage", "Recruiter performance comparison", "AI narrative: TalentPipelineAnalytics generates insights"], deps: ["Application", "Submission", "Job", "Candidate", "InvokeLLM"] },
          { name: "Playbooks.jsx", purpose: "Process documentation library with AI search and contextual suggestions.", details: ["Category filter sidebar; search by title, tags, keywords", "PlaybookSmartSearch: InvokeLLM semantic search across all playbooks", "ContextualSuggestions: AI recommends relevant playbooks for current context", "Usage count incremented on open"], deps: ["Playbook"] },
          { name: "ResumeStudio.jsx", purpose: "Full-featured resume tool with 4 tabs: Build, Score, Compare, Analyze.", details: ["Build tab: ResumeFormLeft + ResumePreview side-by-side with zoom/print", "Score tab: ResumeScorer with JD vs Resume input", "Compare tab: ResumeComparison and VersionsCompare", "Analyze tab: JDResumeCompare and BulkRanker", "ResumeAIAssistant floating assistant panel", "ResumeLLMBuilder for AI-generated resume"], deps: ["Resume", "Candidate"] },
          { name: "SkillMatrix.jsx", purpose: "Skill coverage matrix across candidates and open jobs.", details: ["Matrix: rows = required skills from open jobs, cols = candidates", "Green cell if candidate has skill; red if missing", "Helps identify coverage gaps for sourcing priorities"], deps: ["Candidate", "Job"] },
          { name: "Submissions.jsx", purpose: "Application/submission tracking in kanban and list views.", details: ["View toggle: kanban (KanbanBoard) | list (table)", "Saved SubmissionView selector", "Follow-up overdue indicators (red if follow_up_date < today)", "Quick status update; FollowUpForm modal", "executeAutomation called on every status change"], deps: ["Submission", "Candidate", "Job", "AutomationRule"] },
          { name: "Tasks.jsx", purpose: "Task management in kanban and list views with bulk ops.", details: ["View toggle: kanban (KanbanBoard) | list", "Saved TaskView selector", "Filter by assigned_to, priority, status, due_date, related_entity", "Bulk complete, delete, reassign", "KanbanBoard drag-and-drop updates Task.status"], deps: ["Task", "TaskView"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── LIB ── */}
      <FileGroup title="src/lib — Core Library Files" color="slate">
        {[
          { name: "AuthContext.jsx", purpose: "React context for authentication state management across the app.", details: ["Loads public app settings from Base44 public API on mount (isLoadingPublicSettings)", "Checks URL param 'access_token' → stores in session → removes from URL", "Calls base44.auth.me() to resolve current user (isLoadingAuth)", "Exposes: isAuthenticated, user, isLoadingAuth, isLoadingPublicSettings, authError, logout, navigateToLogin", "authError types: 'user_not_registered' | 'auth_required'", "App.jsx wraps with AuthProvider; AuthenticatedApp reads context"] },
          { name: "app-params.js", purpose: "Resolves Base44 app configuration from environment variables and URL params.", details: ["Reads: VITE_BASE44_APP_ID, VITE_BASE44_BACKEND_URL from import.meta.env", "Also reads URL params: app_id, server_url, access_token, functions_version (override for dev)", "Exports: appId, serverUrl, functionsVersion for base44Client initialization"] },
          { name: "NavigationTracker.jsx", purpose: "Tracks page navigation for analytics and state reset.", details: ["useLocation() hook; fires on every route change", "Scrolls window to top on navigation", "Can be extended for analytics event tracking"] },
          { name: "PageNotFound.jsx", purpose: "404 page rendered for unmatched routes.", details: ["Displays 404 message with navigation back to Dashboard", "Styled with app branding; Route path='*' in App.jsx"] },
          { name: "query-client.js", purpose: "Configures and exports the React Query QueryClient instance.", details: ["queryClientInstance: QueryClient with defaultOptions (staleTime, retry config)", "Exported and passed to QueryClientProvider in App.jsx"] },
          { name: "utils.js", purpose: "Shared utility functions used across the app.", details: ["createPageUrl(pageName): converts page name to route URL (e.g. 'Candidates' → '/Candidates')", "cn(): Tailwind class merger (clsx + tailwind-merge)", "format helpers for dates, currency, truncation"] },
          { name: "VisualEditAgent.jsx", purpose: "Base44 visual editing agent hook for in-platform development tools.", details: ["Mounts Base44's visual editing overlay for the app builder interface", "Only active in development/edit mode; no-op in production"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>

      {/* ── CONFIG FILES ── */}
      <FileGroup title="Root Config Files" color="slate">
        {[
          { name: "App.jsx", purpose: "Application root. Composes auth, routing, providers, and global components.", details: ["Providers in order: AuthProvider → QueryClientProvider → BrowserRouter → NavigationTracker", "AuthenticatedApp: shows loading spinner, handles authError, renders LayoutWrapper + Routes", "Routes from pagesConfig loop + explicit additional routes for new pages", "Mounts: Toaster, VisualEditAgent", "LayoutWrapper: wraps each route with Layout.jsx if defined in pagesConfig"] },
          { name: "pages.config.js", purpose: "Page registry — single source of truth for route-to-component mapping.", details: ["Object map: { PageName: PageComponent } used to generate Routes in App.jsx", "Layout: Layout.jsx applied to all pages via LayoutWrapper", "mainPage: 'Dashboard' — the / route component", "New pages NOT auto-generated — must be manually added to this file AND App.jsx"] },
          { name: "Layout.jsx", purpose: "Authenticated shell. Sidebar, header, preview panel, AI assistant, global event handling.", details: ["Sidebar: collapsible (localStorage state), pinnable, permission-aware nav groups", "Header: search bar (opens CommandPalette), notification bell, user dropdown", "Quick Stats in sidebar: active jobs, new candidates, monthly placements", "Preview orchestration: listens for 'preview:open' CustomEvent → renders RightPreviewPanel", "Auto-logout: 3-hour inactivity timer; forced logout for locked/inactive users", "Keyboard shortcuts: ⌘K → CommandPalette, ⌘J → AIQuickActions, ? → KeyboardShortcuts", "Automation patch: entity status change interception for auto-complete tasks"] },
          { name: "index.css", purpose: "Global styles, design tokens, and font imports.", details: ["@import: Bricolage Grotesque (display/headings), IBM Plex Sans (UI body), JetBrains Mono (code)", "@layer base: CSS custom properties (--background, --foreground, --primary, --sidebar-*, --font-*)", "Tailwind base, components, utilities layers", "Light theme default; .dark class for dark mode overrides"] },
          { name: "tailwind.config.js", purpose: "Tailwind CSS theme configuration mapping CSS variables to utility classes.", details: ["colors: background, foreground, card, primary, secondary, muted, accent, destructive, border, chart-1..5, sidebar-* — all mapped from CSS vars", "fontFamily: display (Bricolage Grotesque), ui (IBM Plex Sans), mono (JetBrains Mono)", "borderRadius: uses --radius CSS var", "animations: accordion-down, accordion-up (shadcn/ui)", "plugins: tailwindcss-animate"] },
          { name: "vite.config.js", purpose: "Vite bundler configuration with Base44 plugin.", details: ["@base44/vite-plugin: handles app ID injection, functions proxy, and dev server config", "Path alias: '@' → './src'", "React plugin for JSX transform"] },
          { name: "package.json", purpose: "Project dependencies and scripts.", details: ["Key deps: react 18, react-router-dom 7, @tanstack/react-query 5, framer-motion 11, recharts 2, @hello-pangea/dnd 17, lucide-react, shadcn/ui (all radix components)", "Dev deps: vite, tailwindcss, eslint", "Scripts: dev, build, preview, lint"] },
          { name: "index.html", purpose: "HTML entry point with font preloads and React mount point.", details: ["<div id='root'> — React mount target", "<script type='module' src='/src/main.jsx'> — app entry", "Meta tags for SEO and viewport; favicon reference"] },
        ].map(c => <FileEntry key={c.name} {...c} />)}
      </FileGroup>
    </div>
  );
}