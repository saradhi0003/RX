
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Target,
  Users,
  Zap,
  Shield,
  Database,
  GitBranch,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Table,
  Sparkles, // Added Sparkles import
  MailPlus // Added MailPlus import
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";

const EntityCard = ({ entity, expanded, onToggle }) => {
  const getFieldTypeColor = (type) => {
    const colors = {
      string: "bg-blue-100 text-blue-800",
      number: "bg-green-100 text-green-800",
      boolean: "bg-purple-100 text-purple-800",
      array: "bg-orange-100 text-orange-800",
      object: "bg-pink-100 text-pink-800",
      date: "bg-cyan-100 text-cyan-800"
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-lg">{entity.name}</CardTitle>
            <Badge variant="outline">{entity.fields.length} fields</Badge>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        {entity.description && (
          <p className="text-sm text-slate-600 mt-2">{entity.description}</p>
        )}
      </CardHeader>
      
      {expanded && (
        <CardContent className="space-y-4">
          {/* Fields */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Fields</h4>
            <div className="space-y-2">
              {entity.fields.map((field, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded border bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">{field.name}</span>
                      <Badge className={getFieldTypeColor(field.type)} variant="secondary">
                        {field.type}
                      </Badge>
                      {field.required && (
                        <Badge className="bg-red-100 text-red-800">required</Badge>
                      )}
                      {field.isLookup && (
                        <Badge className="bg-indigo-100 text-indigo-800">→ {field.references}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{field.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationships */}
          {entity.relationships?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Relationships
              </h4>
              <div className="space-y-2">
                {entity.relationships.map((rel, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded">
                    <span className="font-medium">{rel.type}:</span>
                    <span>{rel.with}</span>
                    <span className="text-slate-500">({rel.description})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Built-in Fields */}
          <div className="bg-slate-100 rounded p-3">
            <p className="text-xs text-slate-600 mb-2">
              <strong>Built-in fields (auto-generated):</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">id</Badge>
              <Badge variant="outline" className="text-xs">created_date</Badge>
              <Badge variant="outline" className="text-xs">updated_date</Badge>
              <Badge variant="outline" className="text-xs">created_by</Badge>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default function BRD() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntities, setExpandedEntities] = useState({});
  const [activeTab, setActiveTab] = useState("overview");

  const toggleEntity = (entityName) => {
    setExpandedEntities(prev => ({
      ...prev,
      [entityName]: !prev[entityName]
    }));
  };

  // Data Model Definition
  const dataModel = {
    core: [
      {
        name: "Candidate",
        description: "Core entity representing job seekers and talent in the pipeline",
        fields: [
          { name: "first_name", type: "string", required: true, description: "First name" },
          { name: "last_name", type: "string", required: true, description: "Last name" },
          { name: "email", type: "string", required: true, description: "Email address" },
          { name: "phone", type: "string", description: "Phone number" },
          { name: "location", type: "string", description: "Current location" },
          { name: "linkedin_url", type: "string", description: "LinkedIn profile URL" },
          { name: "resume_url", type: "string", description: "Resume file URL" },
          { name: "skills", type: "array", description: "Technical and professional skills" },
          { name: "experience_years", type: "number", description: "Years of experience" },
          { name: "current_title", type: "string", description: "Current job title" },
          { name: "current_company", type: "string", description: "Current employer" },
          { name: "salary_expectation", type: "number", description: "Salary expectation" },
          { name: "availability", type: "string", description: "Availability timeframe (immediately, 2_weeks, 1_month, negotiable)" },
          { name: "status", type: "string", description: "Candidate status (active, on_bench, our_bench, placed, inactive, do_not_contact, screened)" },
          { name: "work_authorization", type: "string", description: "Work authorization status" },
          { name: "notes", type: "string", description: "Internal notes" },
          { name: "bench_match_score", type: "number", description: "AI bulk bench score (0-100)" },
          { name: "screening_score", type: "number", description: "AI screening fit score (0-100)" }
        ],
        relationships: [
          { type: "One-to-Many", with: "Application", description: "Candidates can have multiple job applications" },
          { type: "One-to-Many", with: "Submission", description: "Candidates can be submitted to multiple jobs" },
          { type: "One-to-Many", with: "Resume", description: "Candidates can have multiple resume versions" },
          { type: "One-to-Many", with: "OutreachMessage", description: "Candidates receive outreach messages" }
        ]
      },
      {
        name: "Job",
        description: "Job openings and requirements from client companies",
        fields: [
          { name: "title", type: "string", required: true, description: "Job title" },
          { name: "company_id", type: "string", required: true, isLookup: true, references: "Company", description: "Company lookup" },
          { name: "description", type: "string", description: "Job description" },
          { name: "requirements", type: "string", description: "Required qualifications" },
          { name: "location", type: "string", description: "Job location" },
          { name: "remote_type", type: "string", description: "Work arrangement (onsite, remote, hybrid)" },
          { name: "employment_type", type: "string", description: "Employment type (full_time, part_time, contract, contract_to_hire)" },
          { name: "rate", type: "string", description: "Rate or salary range" },
          { name: "priority", type: "string", description: "Job priority (low, medium, high, urgent)" },
          { name: "status", type: "string", description: "Job status (draft, open, on_hold, filled, cancelled)" },
          { name: "required_skills", type: "array", description: "Required technical skills" },
          { name: "preferred_skills", type: "array", description: "Preferred additional skills" },
          { name: "experience_required", type: "number", description: "Minimum years of experience" },
          { name: "positions_available", type: "number", description: "Number of positions to fill" },
          { name: "due_date", type: "date", description: "Target fill date" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Company", description: "Jobs belong to a company" },
          { type: "One-to-Many", with: "Application", description: "Jobs have multiple applications" },
          { type: "One-to-Many", with: "Submission", description: "Jobs receive multiple submissions" }
        ]
      },
      {
        name: "Company",
        description: "Client companies and internal organizations",
        fields: [
          { name: "name", type: "string", required: true, description: "Company name" },
          { name: "industry", type: "string", description: "Industry sector" },
          { name: "website", type: "string", description: "Company website" },
          { name: "location", type: "string", description: "Primary location" },
          { name: "description", type: "string", description: "Company description" },
          { name: "type", type: "string", description: "Company type (client, internal)" },
          { name: "status", type: "string", description: "Company status (active, prospect, inactive)" },
          { name: "contacts", type: "array", description: "Company contacts with roles" },
          { name: "job_stack_access", type: "boolean", description: "If true, contacts receive Job Stack emails" }
        ],
        relationships: [
          { type: "One-to-Many", with: "Job", description: "Companies have multiple job openings" },
          { type: "One-to-Many", with: "Invoice", description: "Companies receive invoices" }
        ]
      },
      {
        name: "Application",
        description: "Candidate applications to specific jobs",
        fields: [
          { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate lookup" },
          { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Job lookup" },
          { name: "status", type: "string", description: "Application status (sourced, applied, screening, submitted, interviewing, offered, hired, rejected, withdrawn)" },
          { name: "stage_updated_date", type: "date", description: "When status was last updated" },
          { name: "notes", type: "string", description: "Application notes" },
          { name: "interview_dates", type: "array", description: "Interview history with feedback" },
          { name: "submitted_by", type: "string", description: "Recruiter who submitted" },
          { name: "client_feedback", type: "string", description: "Feedback from client" },
          { name: "match_score", type: "number", description: "AI-generated match score (0-100)" },
          { name: "score_details", type: "object", description: "Detailed score breakdown from AI" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Candidate", description: "Application belongs to a candidate" },
          { type: "Many-to-One", with: "Job", description: "Application is for a specific job" }
        ]
      }
    ],
    recruitment: [
      {
        name: "Submission",
        description: "Candidate submissions to client jobs by recruiters",
        fields: [
          { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate lookup" },
          { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Job lookup" },
          { name: "recruiter_id", type: "string", required: true, description: "Recruiter who made submission" },
          { name: "submitted_date", type: "date", description: "Submission date" },
          { name: "status", type: "string", description: "Submission status (submitted, under_review, interviewing, rejected, hired, withdrawn)" },
          { name: "client_feedback", type: "string", description: "Client feedback" },
          { name: "follow_up_date", type: "date", description: "Next follow-up date" },
          { name: "follow_up_completed", type: "boolean", description: "Follow-up completion flag" },
          { name: "interview_dates", type: "array", description: "Interview history" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Candidate", description: "Submission is for a candidate" },
          { type: "Many-to-One", with: "Job", description: "Submission is for a job" },
          { type: "Many-to-One", with: "Recruiter", description: "Submission created by recruiter" }
        ]
      },
      {
        name: "Recruiter",
        description: "Internal and external recruiters",
        fields: [
          { name: "first_name", type: "string", required: true, description: "First name" },
          { name: "last_name", type: "string", required: true, description: "Last name" },
          { name: "email", type: "string", required: true, description: "Email address" },
          { name: "phone", type: "string", description: "Phone number" },
          { name: "role", type: "string", description: "Recruiter type (internal, external, freelance)" },
          { name: "specializations", type: "array", description: "Recruiting specializations" },
          { name: "territory", type: "string", description: "Geographic territory" },
          { name: "performance_metrics", type: "object", description: "Performance tracking metrics" },
          { name: "status", type: "string", description: "Recruiter status (active, inactive, on_leave)" }
        ],
        relationships: [
          { type: "One-to-Many", with: "Submission", description: "Recruiters create submissions" },
          { type: "One-to-Many", with: "LeaveRequest", description: "Recruiters request leave" },
          { type: "One-to-Many", with: "Timesheet", description: "Recruiters log time" }
        ]
      },
      {
        name: "Resume",
        description: "Candidate resume versions and content",
        fields: [
          { name: "candidate_id", type: "string", isLookup: true, references: "Candidate", description: "Linked candidate" },
          { name: "name", type: "string", required: true, description: "Display name" },
          { name: "headline", type: "string", description: "Professional headline" },
          { name: "email", type: "string", description: "Contact email" },
          { name: "phone", type: "string", description: "Contact phone" },
          { name: "summary", type: "string", description: "Professional summary" },
          { name: "experiences", type: "array", description: "Work experience entries" },
          { name: "education", type: "array", description: "Education entries" },
          { name: "projects", type: "array", description: "Projects list" },
          { name: "skills", type: "array", description: "Skills keywords" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Candidate", description: "Resume belongs to candidate" }
        ]
      },
      {
        name: "OutreachMessage",
        description: "Communication tracking with candidates",
        fields: [
          { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate ID" },
          { name: "job_id", type: "string", isLookup: true, references: "Job", description: "Related job (optional)" },
          { name: "subject", type: "string", required: true, description: "Email subject" },
          { name: "message", type: "string", required: true, description: "Message content" },
          { name: "message_type", type: "string", description: "Type of outreach" },
          { name: "channel", type: "string", description: "Communication channel (email, linkedin, phone)" },
          { name: "status", type: "string", description: "Message status (draft, sent, delivered, opened, replied)" },
          { name: "response_received", type: "boolean", description: "Response flag" },
          { name: "sentiment", type: "string", description: "Response sentiment (positive, neutral, negative)" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Candidate", description: "Outreach to candidate" },
          { type: "Many-to-One", with: "Job", description: "Related to job (optional)" }
        ]
      },
      {
        name: "InterviewSession",
        description: "Interview sessions and evaluations",
        fields: [
          { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Candidate ID" },
          { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Job ID" },
          { name: "interview_date", type: "date", required: true, description: "Interview date/time" },
          { name: "interview_type", type: "string", required: true, description: "Interview type (phone_screen, technical, behavioral, etc.)" },
          { name: "interviewer", type: "string", description: "Interviewer name/email" },
          { name: "status", type: "string", description: "Interview status (scheduled, completed, cancelled, no_show)" },
          { name: "questions", type: "array", description: "Interview questions and responses" },
          { name: "overall_score", type: "number", description: "Overall interview score (0-100)" },
          { name: "recommendation", type: "string", description: "Hiring recommendation" },
          { name: "ai_summary", type: "string", description: "AI-generated interview summary" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Candidate", description: "Interview with candidate" },
          { type: "Many-to-One", with: "Job", description: "Interview for job" }
        ]
      }
    ],
    workflow: [
      {
        name: "Task",
        description: "Work items and follow-ups",
        fields: [
          { name: "title", type: "string", required: true, description: "Task title" },
          { name: "description", type: "string", description: "Task description" },
          { name: "assigned_to", type: "string", required: true, description: "User email assigned to" },
          { name: "related_entity", type: "string", description: "What this relates to (candidate, job, company, submission, general)" },
          { name: "related_id", type: "string", description: "ID of related entity" },
          { name: "priority", type: "string", description: "Task priority (low, medium, high, urgent)" },
          { name: "status", type: "string", description: "Task status (pending, in_progress, completed, cancelled)" },
          { name: "due_date", type: "date", description: "Due date" },
          { name: "completion_notes", type: "string", description: "Notes upon completion" }
        ],
        relationships: [
          { type: "Polymorphic", with: "Multiple", description: "Can link to Candidate, Job, Company, Submission" }
        ]
      },
      {
        name: "Playbook",
        description: "Process documentation and best practices",
        fields: [
          { name: "title", type: "string", required: true, description: "Playbook title" },
          { name: "description", type: "string", description: "Playbook description" },
          { name: "category", type: "string", required: true, description: "Category (onboarding, recruiting, procedures, etc.)" },
          { name: "documents", type: "array", description: "Linked documents and resources" },
          { name: "steps", type: "array", description: "Step-by-step process with checklists" },
          { name: "tags", type: "array", description: "Tags for organization" },
          { name: "keywords", type: "array", description: "Search keywords for AI matching" },
          { name: "usage_count", type: "number", description: "View count" },
          { name: "is_active", type: "boolean", description: "Active flag" }
        ],
        relationships: []
      },
      {
        name: "AutomationRule",
        description: "Automated workflow rules and triggers",
        fields: [
          { name: "name", type: "string", required: true, description: "Rule name" },
          { name: "trigger_type", type: "string", required: true, description: "What triggers automation (status_change, time_based, manual)" },
          { name: "trigger_entity", type: "string", required: true, description: "Which entity triggers (Submission, Application, Task)" },
          { name: "trigger_status_to", type: "string", description: "Status to trigger on" },
          { name: "action_type", type: "string", required: true, description: "Action to perform (send_email, create_task, send_notification)" },
          { name: "email_template_id", type: "string", isLookup: true, references: "EmailTemplate", description: "Email template to use" },
          { name: "is_active", type: "boolean", description: "Rule active flag" }
        ],
        relationships: [
          { type: "Many-to-One", with: "EmailTemplate", description: "Uses email template" }
        ]
      }
    ],
    ai: [
      {
        name: "MatchingProfile",
        description: "AI matching configuration profiles",
        fields: [
          { name: "name", type: "string", required: true, description: "Profile name" },
          { name: "job_type", type: "string", required: true, description: "Job category" },
          { name: "criteria_weights", type: "object", description: "Custom weights for matching criteria (should sum to 100)" },
          { name: "required_skills", type: "array", description: "Skills with importance levels" },
          { name: "soft_skills_keywords", type: "array", description: "Keywords to extract from profiles" },
          { name: "ai_model", type: "string", description: "AI model to use (o1, claude-4.5, gpt-5, auto)" },
          { name: "matching_strategy", type: "string", description: "Matching strategy (balanced, strict, lenient, learning)" },
          { name: "learning_enabled", type: "boolean", description: "Learn from feedback" },
          { name: "performance_metrics", type: "object", description: "Performance tracking" }
        ],
        relationships: [
          { type: "One-to-Many", with: "MatchFeedback", description: "Has feedback entries" }
        ]
      },
      {
        name: "MatchFeedback",
        description: "User feedback on AI match quality",
        fields: [
          { name: "matching_profile_id", type: "string", isLookup: true, references: "MatchingProfile", description: "Profile used" },
          { name: "candidate_id", type: "string", required: true, isLookup: true, references: "Candidate", description: "Matched candidate" },
          { name: "job_id", type: "string", required: true, isLookup: true, references: "Job", description: "Matched job" },
          { name: "match_score", type: "number", required: true, description: "AI-generated score (0-100)" },
          { name: "user_rating", type: "number", description: "User rating (1-5 stars)" },
          { name: "user_action", type: "string", description: "Action taken (viewed, contacted, interviewed, hired, rejected)" },
          { name: "was_helpful", type: "boolean", description: "Helpful flag" }
        ],
        relationships: [
          { type: "Many-to-One", with: "MatchingProfile", description: "Feedback for profile" },
          { type: "Many-to-One", with: "Candidate", description: "Feedback on candidate" },
          { type: "Many-to-One", with: "Job", description: "Feedback for job" }
        ]
      }
    ],
    admin: [
      {
        name: "User",
        description: "System users with roles and permissions",
        fields: [
          { name: "email", type: "string", description: "Email (built-in)" },
          { name: "full_name", type: "string", description: "Full name (built-in)" },
          { name: "role", type: "string", description: "Built-in role (admin, user)" },
          { name: "role_id", type: "string", isLookup: true, references: "Role", description: "Custom role lookup" },
          { name: "status", type: "string", description: "Access state (active, inactive, invited)" },
          { name: "is_locked", type: "boolean", description: "Account locked flag" },
          { name: "last_active", type: "date", description: "Last active timestamp" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Role", description: "User has a role" }
        ]
      },
      {
        name: "Role",
        description: "Permission roles for access control",
        fields: [
          { name: "name", type: "string", required: true, description: "Role name (e.g., Admin, Recruiter)" },
          { name: "description", type: "string", description: "Role description" },
          { name: "permissions", type: "object", required: true, description: "Map of entity permissions (view, create, update, delete, scope)" }
        ],
        relationships: [
          { type: "One-to-Many", with: "User", description: "Role assigned to users" }
        ]
      },
      {
        name: "AuditLog",
        description: "System audit trail",
        fields: [
          { name: "user_email", type: "string", required: true, description: "User email" },
          { name: "action", type: "string", required: true, description: "Action performed" },
          { name: "ip", type: "string", description: "IP address" },
          { name: "user_agent", type: "string", description: "Browser user agent" },
          { name: "meta", type: "object", description: "Extra metadata" }
        ],
        relationships: []
      },
      {
        name: "EmailTemplate",
        description: "Reusable email templates",
        fields: [
          { name: "title", type: "string", required: true, description: "Template title" },
          { name: "subject", type: "string", description: "Email subject" },
          { name: "category", type: "string", description: "Template category" },
          { name: "blocks", type: "array", description: "Structured content blocks" },
          { name: "html_body", type: "string", description: "Rendered HTML" },
          { name: "is_active", type: "boolean", description: "Active flag" }
        ],
        relationships: [
          { type: "One-to-Many", with: "AutomationRule", description: "Used by automation rules" }
        ]
      }
    ],
    finance: [
      {
        name: "Invoice",
        description: "Client invoices for services",
        fields: [
          { name: "invoice_number", type: "string", required: true, description: "Invoice number" },
          { name: "company_id", type: "string", required: true, isLookup: true, references: "Company", description: "Billed company" },
          { name: "issue_date", type: "date", required: true, description: "Issue date" },
          { name: "due_date", type: "date", required: true, description: "Due date" },
          { name: "items", type: "array", required: true, description: "Line items with quantity and price" },
          { name: "subtotal", type: "number", description: "Sum of items" },
          { name: "tax_amount", type: "number", description: "Tax amount" },
          { name: "total", type: "number", description: "Final total" },
          { name: "status", type: "string", description: "Invoice status (draft, sent, paid, overdue, void)" }
        ],
        relationships: [
          { type: "Many-to-One", with: "Company", description: "Invoice for company" }
        ]
      },
      {
        name: "Expense",
        description: "Business expenses tracking",
        fields: [
          { name: "date", type: "date", required: true, description: "Expense date" },
          { name: "name", type: "string", required: true, description: "Expense description" },
          { name: "type", type: "string", required: true, description: "Expense category" },
          { name: "amount", type: "number", required: true, description: "Amount" },
          { name: "payment_method", type: "string", description: "Payment method" },
          { name: "vendor", type: "string", description: "Vendor/Payee" },
          { name: "is_recurring", type: "boolean", description: "Recurring flag" }
        ],
        relationships: []
      }
    ]
  };

  // Flatten all entities for search
  const allEntities = [
    ...dataModel.core,
    ...dataModel.recruitment,
    ...dataModel.workflow,
    ...dataModel.ai,
    ...dataModel.admin,
    ...dataModel.finance
  ];

  const filteredEntities = allEntities.filter(entity =>
    entity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entity.fields.some(field => 
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const entityGroups = [
    { key: "core", label: "Core Entities", entities: dataModel.core, color: "blue" },
    { key: "recruitment", label: "Recruitment & Talent", entities: dataModel.recruitment, color: "purple" },
    { key: "workflow", label: "Workflow & Process", entities: dataModel.workflow, color: "green" },
    { key: "ai", label: "AI & Intelligence", entities: dataModel.ai, color: "pink" },
    { key: "admin", label: "Admin & Security", entities: dataModel.admin, color: "orange" },
    { key: "finance", label: "Finance & Billing", entities: dataModel.finance, color: "cyan" }
  ];

  const sections = [
    {
      icon: Target,
      title: "Overview",
      description: "High-level system architecture and purpose",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700 leading-relaxed">
            <strong>TalentStack Recruiter X</strong> is a comprehensive recruitment management platform designed for staffing agencies
            and internal recruiting teams. The system manages the complete recruitment lifecycle from candidate sourcing
            through placement and invoicing.
          </p>

          {/* NEW: Recent Updates Section */}
          <Card className="border-l-4 border-l-purple-500 bg-purple-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Latest Updates & Features
              </h4>
              <div className="space-y-2 text-sm text-purple-800">
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px]">AI Agents:</span>
                  <span>Intelligent automation agents that trigger on entity events (e.g., job creation) to perform AI analysis, create applications, and execute complex workflows</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px]">Email Blast:</span>
                  <span>Mass email campaign tool for reaching all company contacts with AI-generated content and CSV export capabilities</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px]">Advanced Matching:</span>
                  <span>Configurable AI matching with weighted criteria, multiple reasoning models (o1, Claude 4.5, GPT-5), learning from feedback, and performance tracking</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-[120px]">Workflow Automation:</span>
                  <span>Auto-completion of related tasks, background AI job matching on creation, and contextual AI assistance across the platform</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold">Data Model</h4>
                </div>
                <p className="text-sm text-slate-600">
                  {allEntities.length} entities with {allEntities.reduce((sum, e) => sum + e.fields.length, 0)} total fields
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold">Relationships</h4>
                </div>
                <p className="text-sm text-slate-600">
                  Complex relationship graph with lookups, one-to-many, and polymorphic links
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold">AI-Powered</h4>
                </div>
                <p className="text-sm text-slate-600">
                  Machine learning for candidate matching, screening, and workflow automation
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      icon: Users,
      title: "Key Features",
      description: "Core capabilities and workflows",
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Talent Management</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <li>Candidate database with skills, experience, work auth</li>
              <li>Resume parsing and version management</li>
              <li>AI-powered candidate screening and matching</li>
              <li>Bulk operations and import/export</li>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job & Application Tracking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <li>Job requisition management with client companies</li>
              <li>Multi-stage application pipeline</li>
              <li>Interview scheduling and feedback</li>
              <li>Submission tracking with client feedback</li>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI & Automation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <li>Semantic candidate-job matching with configurable weights</li>
              <li>Automated workflow rules and triggers</li>
              <li>Candidate screening and outreach automation</li>
              <li>Learning system with feedback loops</li>
              <li className="font-semibold text-purple-700">NEW: AI Agents for entity-triggered workflows</li>
              <li className="font-semibold text-purple-700">NEW: Background job matching on creation</li>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Management</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <li>Invoice generation and tracking</li>
              <li>Expense management with recurring support</li>
              <li>Recruiter performance metrics</li>
              <li>Role-based access control</li>
              <li className="font-semibold text-purple-700">NEW: Email blast campaigns with AI content generation</li>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      icon: Zap,
      title: "AI Agent System",
      description: "Intelligent automation and workflow agents",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700 leading-relaxed">
            The AI Agent system enables intelligent, event-driven automation that can perform complex workflows,
            AI analysis, and multi-step operations without manual intervention.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="text-base">Agent Triggers</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <li><strong>Entity Events:</strong> Triggered on create, update, or delete of specific entities</li>
                <li><strong>Scheduled:</strong> Time-based execution (hourly, daily, weekly, monthly)</li>
                <li><strong>Manual:</strong> User-initiated execution</li>
                <li><strong>Conditional:</strong> With status and field-based conditions</li>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="text-base">Agent Actions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <li><strong>AI Analysis:</strong> Use o1, GPT-4o, Claude 4.5, or GPT-5 for reasoning</li>
                <li><strong>Entity Operations:</strong> Create, update, query, or delete records</li>
                <li><strong>Email Sending:</strong> Send templated or dynamic emails</li>
                <li><strong>Task Creation:</strong> Auto-generate follow-up tasks</li>
                <li><strong>Multi-step Workflows:</strong> Chain multiple actions together</li>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base text-blue-900">Example: Job Matcher Agent</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-800 space-y-2">
              <p><strong>Trigger:</strong> When Job entity is created with status="open"</p>
              <p><strong>Actions:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Fetch all active candidates from database</li>
                <li>Use AI (o1 reasoning model) to score each candidate against job requirements</li>
                <li>Store match results in job metadata for instant access</li>
                <li>Auto-create application records for top 10 matches (score ≥ 80)</li>
              </ol>
              <p><strong>Execution:</strong> Runs asynchronously in background with 5-minute timeout</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-base text-green-900">Agent Configuration</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-green-800">
              <p className="mb-2">Agents are configured via JSON files in the <code className="bg-white px-2 py-1 rounded">agents/</code> directory with:</p>
              <ul className="space-y-1 ml-4">
                <li>• Name, description, and instructions</li>
                <li>• Trigger configuration (type, entity, conditions)</li>
                <li>• Tool configurations (entity access permissions)</li>
                <li>• Workflow steps with AI prompts and actions</li>
                <li>• Execution settings (async, timeout, enabled state)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )
    },
    {
      icon: MailPlus,
      title: "Email Blast System",
      description: "Mass communication and campaign management",
      content: (
        <div className="space-y-4">
          <p className="text-slate-700 leading-relaxed">
            The Email Blast system enables recruiters and admins to create targeted email campaigns
            for all company contacts with AI-generated content and flexible export options.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-cyan-500">
              <CardHeader>
                <CardTitle className="text-base">Contact Collection</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <li>Aggregates all contacts from Company entities</li>
                <li>Deduplicates email addresses</li>
                <li>Displays statistics (total companies, contacts, unique emails)</li>
                <li>Allows selective company inclusion/exclusion</li>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle className="text-base">AI Content Generation</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <li>Generates professional email content from subject line</li>
                <li>Includes company introduction and value propositions</li>
                <li>Adds call-to-action and service highlights</li>
                <li>Professional signature template</li>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="text-base">Export Options</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <li>Copy comma-separated list to clipboard</li>
                <li>Export to CSV file</li>
                <li>Open in email client with pre-filled content</li>
                <li>BCC-ready for privacy compliance</li>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-base text-amber-900">Usage Workflow</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-800">
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Navigate to <strong>Admin Controls → Email Blast</strong></li>
                <li>Review statistics and select target companies</li>
                <li>Enter email subject line</li>
                <li>Either write message manually or use <strong>AI Generate</strong> button</li>
                <li>Review and customize AI-generated content</li>
                <li>Copy email list (or export to CSV)</li>
                <li>Use <strong>Open in Email Client</strong> or paste into Gmail/Outlook BCC field</li>
                <li>Send campaign</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={[{ label: "BRD" }]} />
      
      <PageHeader
        title="Business Requirements Document"
        subtitle="Comprehensive system architecture and data model documentation"
      />

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "overview"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab("datamodel")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "datamodel"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Database className="w-4 h-4 inline mr-2" />
          Data Model
        </button>
        <button
          onClick={() => setActiveTab("relationships")}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === "relationships"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GitBranch className="w-4 h-4 inline mr-2" />
          Relationships
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <Card key={idx}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>{section.title}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">{section.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>{section.content}</CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Data Model Tab */}
      {activeTab === "datamodel" && (
        <div className="space-y-6">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search entities, fields, descriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Entity Groups */}
          {entityGroups.map((group) => {
            const displayEntities = searchQuery
              ? group.entities.filter(e => filteredEntities.includes(e))
              : group.entities;

            if (displayEntities.length === 0) return null;

            return (
              <div key={group.key} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={`bg-${group.color}-100 text-${group.color}-800`}>
                    {group.label}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {displayEntities.length} {displayEntities.length === 1 ? 'entity' : 'entities'}
                  </span>
                </div>

                {displayEntities.map((entity) => (
                  <EntityCard
                    key={entity.name}
                    entity={entity}
                    expanded={expandedEntities[entity.name]}
                    onToggle={() => toggleEntity(entity.name)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Relationships Tab */}
      {activeTab === "relationships" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Key Entity Relationships</CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Understanding how entities connect to enable comprehensive talent management workflows
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Core Recruitment Flow */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-600" />
                  Core Recruitment Flow
                </h4>
                <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-blue-100 text-blue-800">Company</Badge>
                    <span className="text-slate-600">→ has many →</span>
                    <Badge className="bg-purple-100 text-purple-800">Jobs</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-blue-100 text-blue-800">Candidate</Badge>
                    <span className="text-slate-600">→ applies to →</span>
                    <Badge className="bg-purple-100 text-purple-800">Jobs</Badge>
                    <span className="text-slate-600">→ creates →</span>
                    <Badge className="bg-green-100 text-green-800">Application</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-orange-100 text-orange-800">Recruiter</Badge>
                    <span className="text-slate-600">→ submits →</span>
                    <Badge className="bg-blue-100 text-blue-800">Candidate</Badge>
                    <span className="text-slate-600">→ to →</span>
                    <Badge className="bg-purple-100 text-purple-800">Job</Badge>
                    <span className="text-slate-600">→ creates →</span>
                    <Badge className="bg-green-100 text-green-800">Submission</Badge>
                  </div>
                </div>
              </div>

              {/* AI Matching System */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-pink-600" />
                  AI Matching System
                </h4>
                <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-pink-100 text-pink-800">MatchingProfile</Badge>
                    <span className="text-slate-600">→ defines weights for →</span>
                    <Badge className="bg-blue-100 text-blue-800">Candidate</Badge>
                    <span className="text-slate-600">+</span>
                    <Badge className="bg-purple-100 text-purple-800">Job</Badge>
                    <span className="text-slate-600">matching</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-pink-100 text-pink-800">MatchFeedback</Badge>
                    <span className="text-slate-600">→ trains →</span>
                    <Badge className="bg-pink-100 text-pink-800">MatchingProfile</Badge>
                    <span className="text-slate-600">with user ratings</span>
                  </div>
                </div>
              </div>

              {/* Communication & Workflow */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-600" />
                  Communication & Workflow
                </h4>
                <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-blue-100 text-blue-800">Candidate</Badge>
                    <span className="text-slate-600">← receives ←</span>
                    <Badge className="bg-cyan-100 text-cyan-800">OutreachMessage</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-green-100 text-green-800">Task</Badge>
                    <span className="text-slate-600">→ can link to →</span>
                    <span className="text-slate-600">[Candidate | Job | Company | Submission]</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-cyan-100 text-cyan-800">InterviewSession</Badge>
                    <span className="text-slate-600">→ connects →</span>
                    <Badge className="bg-blue-100 text-blue-800">Candidate</Badge>
                    <span className="text-slate-600">+</span>
                    <Badge className="bg-purple-100 text-purple-800">Job</Badge>
                  </div>
                </div>
              </div>

              {/* Admin & Security */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Admin & Security
                </h4>
                <div className="bg-slate-50 rounded-lg p-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-orange-100 text-orange-800">User</Badge>
                    <span className="text-slate-600">→ has one →</span>
                    <Badge className="bg-orange-100 text-orange-800">Role</Badge>
                    <span className="text-slate-600">→ defines permissions</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge className="bg-cyan-100 text-cyan-800">EmailTemplate</Badge>
                    <span className="text-slate-600">→ used by →</span>
                    <Badge className="bg-green-100 text-green-800">AutomationRule</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Built-in Fields Notice */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Built-in System Fields
              </h4>
              <p className="text-sm text-slate-600 mb-3">
                Every entity automatically includes these system-managed fields:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded p-3">
                  <div className="font-mono text-xs font-semibold mb-1">id</div>
                  <div className="text-xs text-slate-600">Unique identifier (UUID)</div>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <div className="font-mono text-xs font-semibold mb-1">created_date</div>
                  <div className="text-xs text-slate-600">Creation timestamp (ISO 8601)</div>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <div className="font-mono text-xs font-semibold mb-1">updated_date</div>
                  <div className="text-xs text-slate-600">Last update timestamp</div>
                </div>
                <div className="bg-slate-50 rounded p-3">
                  <div className="font-mono text-xs font-semibold mb-1">created_by</div>
                  <div className="text-xs text-slate-600">Creator user email</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
