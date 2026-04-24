export function downloadBRD(entities) {
  const allEntities = Object.values(entities).flat();
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const entitySections = Object.entries(entities).map(([group, ents]) =>
    `<h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-top:32px;font-size:18px">${group.charAt(0).toUpperCase() + group.slice(1)} Entities</h2>` +
    ents.map(e => `
      <div style="margin-bottom:20px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
        <div style="background:#1E293B;color:white;padding:10px 16px;font-weight:bold;font-size:15px">${e.name}</div>
        <div style="padding:12px 16px;font-size:13px;color:#475569">${e.description || ""}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#F8FAFC">
            <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #E2E8F0;color:#64748B">Field</th>
            <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #E2E8F0;color:#64748B">Type</th>
            <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #E2E8F0;color:#64748B">Required</th>
            <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #E2E8F0;color:#64748B">Description</th>
          </tr></thead>
          <tbody>
            ${e.fields.map((f, i) => `
              <tr style="background:${i % 2 === 0 ? "#fff" : "#F8FAFC"}">
                <td style="padding:5px 12px;border-bottom:1px solid #F1F5F9;font-family:monospace;font-weight:600;color:#1E293B">${f.name}</td>
                <td style="padding:5px 12px;border-bottom:1px solid #F1F5F9;color:#2563EB">${f.type}</td>
                <td style="padding:5px 12px;border-bottom:1px solid #F1F5F9;color:${f.required ? "#DC2626" : "#94A3B8"}">${f.required ? "Yes" : "—"}</td>
                <td style="padding:5px 12px;border-bottom:1px solid #F1F5F9;color:#475569">${f.description || ""}${f.isLookup ? ` <em>(→ ${f.references})</em>` : ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        ${e.relationships && e.relationships.length > 0 ? `
          <div style="padding:10px 16px;background:#EFF6FF;font-size:12px">
            <strong style="color:#2563EB">Relationships:</strong>
            ${e.relationships.map(r => `<span style="margin-left:8px;background:#DBEAFE;padding:2px 8px;border-radius:4px">${r.type} → ${r.with}: ${r.description}</span>`).join("")}
          </div>` : ""}
      </div>`).join("")
  ).join("");

  const aiFeatures = [
    ["AI Assistant", "components/ai/Assistant.jsx", "Page-aware chat with action execution (QA, navigate, create)"],
    ["AI Quick Actions (⌘J)", "components/common/AIQuickActions.jsx", "Natural language shortcut layer for CRUD and navigation"],
    ["Advanced Candidate Matching", "components/ai/AdvancedCandidateMatching.jsx", "7-dimension weighted matching with MatchingProfile + feedback loop"],
    ["Candidate Screening", "components/ai/CandidateScreening.jsx", "screening_score (0–100) + matching/missing qualifications per candidate"],
    ["Bulk Bench Scoring", "components/ai/BulkBenchScorer.jsx", "Batch bench_match_score for entire candidate cohort"],
    ["Advanced Scoring", "components/ai/AdvancedScoring.jsx", "Deep single-candidate scoring with dimension breakdown"],
    ["Resume Scorer", "components/resume/ResumeScorer.jsx", "JD vs Resume weighted fit scoring (Hard Skills 35%, Education 25%, Title 20%, Soft Skills 20%)"],
    ["Resume AI Builder", "components/resume/ResumeLLMBuilder.jsx", "AI-generated full resume from JD input"],
    ["Resume AI Assistant", "components/resume/ResumeAIAssistant.jsx", "Conversational resume improvement suggestions"],
    ["Candidate AI Summary", "components/ai/CandidateAISummary.jsx", "Auto-generated candidate profile summary + Q&A"],
    ["Candidate AI Enrichment", "components/ai/CandidateAIEnrichment.jsx", "Fills missing candidate fields from existing data"],
    ["Candidate Outreach", "components/ai/CandidateOutreach.jsx", "Personalized outreach email generation with tone selection"],
    ["Interview Assistant", "components/ai/InterviewAssistant.jsx", "Question library, per-question scoring, AI session summary"],
    ["Candidate Workflow Agent", "components/ai/CandidateWorkflowAgent.jsx", "Chained screen → score → outreach pipeline"],
    ["Talent Pipeline Analytics", "components/ai/TalentPipelineAnalytics.jsx", "Pipeline health, skill gaps, hiring forecast, conversion insights"],
    ["Email Inbox Parsing", "pages/EmailInbox.jsx", "AI detection + field extraction from inbound JD/resume emails"],
    ["Duplicate Manager", "pages/DuplicateManager.jsx", "AI similarity scoring + merge assistance for duplicate records"],
    ["Email Blast AI Content", "pages/EmailBlast.jsx", "AI campaign email body generation from subject line"],
    ["Playbook Smart Search", "components/playbooks/PlaybookSmartSearch.jsx", "Semantic search across playbooks"],
    ["Bulk JD Paste", "components/jobs/BulkJobPaste.jsx", "Multi-JD text → Job records via AI extraction"],
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Recruiter X — Business Requirements Document</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1E293B; background: #fff; line-height: 1.6; }
  .page { max-width: 1100px; margin: 0 auto; padding: 40px 32px; }
  h1 { font-size: 28px; font-weight: 800; }
  h2 { font-size: 18px; font-weight: 700; }
  h3 { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1E293B; }
  a { color: #2563EB; }
  .header { background: #0F172A; color: white; padding: 32px; border-radius: 12px; margin-bottom: 32px; }
  .header p { color: #94A3B8; font-size: 13px; margin-top: 6px; }
  .stats { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
  .stat { background: #1E293B; padding: 10px 20px; border-radius: 8px; text-align: center; min-width: 80px; }
  .stat .num { font-size: 22px; font-weight: 800; color: #60A5FA; }
  .stat .lbl { font-size: 11px; color: #94A3B8; }
  .section { margin-bottom: 40px; }
  .card { border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .card-blue { border-left: 4px solid #2563EB; background: #EFF6FF; }
  .card-purple { border-left: 4px solid #7C3AED; background: #F5F3FF; }
  .card-green { border-left: 4px solid #16A34A; background: #F0FDF4; }
  .card-orange { border-left: 4px solid #D97706; background: #FFFBEB; }
  .card-slate { border-left: 4px solid #475569; background: #F8FAFC; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  ul { padding-left: 18px; }
  li { font-size: 13px; color: #475569; margin-bottom: 4px; }
  code { font-family: 'Consolas', monospace; background: #F1F5F9; padding: 1px 5px; border-radius: 3px; font-size: 11px; }
  pre { background: #0F172A; color: #E2E8F0; padding: 16px; border-radius: 8px; font-size: 11px; font-family: 'Consolas', monospace; white-space: pre-wrap; margin: 8px 0; line-height: 1.6; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; vertical-align: top; }
  .toc a { display: block; font-size: 13px; color: #2563EB; padding: 3px 0; text-decoration: none; }
  .footer { text-align: center; padding: 24px; color: #94A3B8; font-size: 12px; border-top: 1px solid #E2E8F0; margin-top: 40px; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 20px; }
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="page">

<div class="header">
  <h1>Recruiter X — Business Requirements Document</h1>
  <p>Full system architecture · Data model · AI features · Security · API reference</p>
  <p>Generated: ${now}</p>
  <div class="stats">
    <div class="stat"><div class="num">${allEntities.length}</div><div class="lbl">Entities</div></div>
    <div class="stat"><div class="num">${allEntities.reduce((s, e) => s + e.fields.length, 0)}</div><div class="lbl">Fields</div></div>
    <div class="stat"><div class="num">${aiFeatures.length}</div><div class="lbl">AI Features</div></div>
    <div class="stat"><div class="num">40+</div><div class="lbl">Pages & Components</div></div>
    <div class="stat"><div class="num">1</div><div class="lbl">Backend Function</div></div>
  </div>
</div>

<!-- TABLE OF CONTENTS -->
<div class="section">
  <h2 style="margin-bottom:12px">Table of Contents</h2>
  <div class="card card-slate toc">
    <div class="grid2">
      <div>
        <a href="#s1">1. Scope & Platform Overview</a>
        <a href="#s2">2. Users & Roles</a>
        <a href="#s3">3. Functional Requirements</a>
        <a href="#s4">4. Non-Functional Requirements</a>
        <a href="#s5">5. Backend Workflows</a>
        <a href="#s6">6. Integrations</a>
      </div>
      <div>
        <a href="#s7">7. Data Model (All ${allEntities.length} Entities)</a>
        <a href="#s8">8. AI & LLM Feature Inventory (${aiFeatures.length} Features)</a>
        <a href="#s9">9. Security & Access Control</a>
        <a href="#s10">10. API Reference (SDK + Examples)</a>
        <a href="#s11">11. Architecture Layers</a>
        <a href="#s12">12. Glossary</a>
      </div>
    </div>
  </div>
</div>

<!-- SECTION 1 -->
<div class="section" id="s1">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">1. Scope & Platform Overview</h2>
  <p style="font-size:13px;color:#475569;margin-bottom:16px;line-height:1.7">
    <strong>Recruiter X</strong> is a full-stack recruitment operations platform built on React + Base44 BaaS. It covers the complete recruitment lifecycle — from candidate sourcing, resume parsing, and AI-assisted matching, through submission tracking, interview coordination, placement, and invoicing — for staffing agencies and internal recruiting teams.
  </p>
  <div class="grid3">
    <div class="card card-blue"><h3>Platform Stack</h3><ul>
      <li>React 18 + Vite + Tailwind CSS</li>
      <li>React Router v7 (Single Page App)</li>
      <li>Base44 BaaS (entities, auth, storage)</li>
      <li>Base44 serverless functions (Deno)</li>
      <li>@tanstack/react-query for data fetching</li>
      <li>framer-motion, recharts, shadcn/ui, @hello-pangea/dnd</li>
    </ul></div>
    <div class="card card-purple"><h3>Functional Domains</h3><ul>
      <li>Recruitment operations (candidates, jobs, submissions)</li>
      <li>Resume & talent intelligence (Studio, AI scoring)</li>
      <li>Communication (templates, blasts, inbox parsing)</li>
      <li>Workflow & process (tasks, playbooks, automation rules)</li>
      <li>Finance (invoices with line items, expenses)</li>
      <li>Admin & governance (RBAC, audit trail, settings)</li>
    </ul></div>
    <div class="card card-green"><h3>Key Design Decisions</h3><ul>
      <li>Frontend-heavy orchestration — most workflow logic in React</li>
      <li>BaaS-style backend — all data via Base44 SDK</li>
      <li>AI-first augmentation across all major flows (20 AI features)</li>
      <li>Mixed internal/public surfaces in one React Router SPA</li>
      <li>Permission-aware UI (PermissionGate) + server-side RLS</li>
      <li>Right-side preview panel for entity quick-view without navigation</li>
    </ul></div>
  </div>
</div>

<!-- SECTION 2 -->
<div class="section" id="s2">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">2. Users & Roles</h2>
  <div class="grid2">
    <div class="card card-blue"><h3>Admin</h3><ul>
      <li>Full access to all entities and all records (scope: all)</li>
      <li>Manage Roles, DashboardConfig, AppSettings</li>
      <li>Create/edit global dashboards and shared views</li>
      <li>Approve timesheets and leave requests</li>
      <li>Access audit logs, access control, AI Agents, Email Blast</li>
      <li>Invite users; lock/unlock accounts</li>
    </ul></div>
    <div class="card card-purple"><h3>Recruiter (User)</h3><ul>
      <li>View most records; create/update own records (scope: own)</li>
      <li>Full Candidate create + update (status, notes, AI scores)</li>
      <li>Submit timesheets; create/view own leave requests</li>
      <li>Access to Jobs, Companies, Submissions (own scope)</li>
      <li>Limited delete by scope; cannot access admin-only pages</li>
      <li>Bulk scoring, saved views per visibility (private/team)</li>
    </ul></div>
  </div>
  <div class="card card-slate" style="margin-top:12px"><h3>Permission System</h3>
    <ul>
      <li>Each entity in Role.permissions: <code>{ view, create, update, delete, scope: 'all'|'own' }</code></li>
      <li><strong>scope: 'own'</strong> — enforces created_by = user.email filter client-side; RLS mirrors server-side</li>
      <li><strong>scope: 'all'</strong> — user can see and act on all records of that entity</li>
      <li>PermissionsProvider exposes <code>can(entity, action)</code> and <code>listFilterFor(entity)</code></li>
      <li>Special scopes: Task → assigned_to | Submission → recruiter_id</li>
    </ul>
  </div>
</div>

<!-- SECTION 3 -->
<div class="section" id="s3">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">3. Functional Requirements</h2>
  <div class="grid2">
    ${[
      ["3.1 Dashboard", ["KPI metrics: active roles, pipeline count, monthly placements", "Pipeline funnel with conversion rates per stage", "Today's Tasks panel with inline complete", "AI Insights panel (live + on-demand LLM analysis)", "Tab views: Overview, Pipeline, Activity", "Admin: configurable global widget dashboard (KPI, Bar, Pie, Line, Stacked)"]],
      ["3.2 Candidates", ["Searchable talent pool with saved views (CandidateView) and column customization", "Bulk operations: status update, delete, bench scoring", "Paste-to-Add from resume text or LinkedIn bio (AI extraction)", "Bulk Resume Upload with PDF extraction and email deduplication", "AI Candidate Screening (fit score + analysis); AI Summary + Q&A; AI Enrichment", "Duplicate detection and merge assistance; right-side preview panel"]],
      ["3.3 Jobs", ["List with search, saved views, priority and status filters", "Careers sync: open jobs published via syncJobToCareers Deno function", "Email Blast to marketing recruiters or selected candidates", "AI Candidate Matching with MatchingProfile; auto-matching on creation", "Job Stack cloning for public job board; company email notifications"]],
      ["3.4 Submissions", ["Create submission with candidate + job + recruiter", "Kanban and list views with drag-and-drop status updates", "Follow-up date tracking with overdue indicators", "Auto-create follow-up Task on submission creation", "Automation rules fire on status transitions; client feedback tracking"]],
      ["3.5 Resume Studio", ["Build tab: inline form editor + live PDF-style preview with zoom/print", "AI Resume Builder: generate tailored JSON resume from JD", "Score tab: paste/upload JD and resume, get weighted fit score", "Version comparison: side-by-side diff; JD-Resume gap analysis; Bulk Ranker"]],
      ["3.6 AI Features", ["Floating AI assistant on every page (page-aware context, action execution)", "AI Quick Actions ⌘J: natural language shortcut layer", "Advanced Matching, Screening, Bulk Bench Scoring, Outreach, Interview Assistant", "Talent Pipeline Analytics: health, skill gaps, hiring forecast"]],
      ["3.7 Email Inbox", ["Paste or upload inbound email content → saved as InboundEmail", "AI parses job requirement emails → creates/updates Job", "AI parses resume emails → creates/updates Candidate + Application", "Processing status transitions with notes; linked to created records"]],
      ["3.8 My Work & Approvals", ["Quick time entry, weekly timesheet grid, leave requests", "Leave validation: blocks time entry on approved leave dates", "Admin Approvals: batch approve timesheets and leave requests", "AI Insights on workload, productivity, leave patterns"]],
      ["3.9 Playbooks", ["Categorized process documentation library with steps, FAQs, documents", "AI Smart Search (semantic); Contextual Suggestions; version history", "Access level control: public | recruiter | manager | admin"]],
      ["3.10 Automation Rules", ["Trigger: entity status change (Submission → submitted, etc.)", "Actions: send_email via template, create_task, send_notification", "Configurable delay in minutes (browser setTimeout)", "Active/inactive toggle; trigger count and last-triggered tracking"]],
      ["3.11 Finance", ["Invoices: line items, tax, totals, status lifecycle (draft → sent → paid)", "Email invoice to company contacts; expense tracking with categories"]],
      ["3.12 Access Control", ["User management: invite, role assignment, lock/unlock", "Role builder: toggle view/create/update/delete per entity with scope", "Audit log: login events with IP (ipify) and user agent", "Auto-logout 3h; forced logout on locked account"]],
    ].map(([title, items]) => `<div class="card card-slate">
      <h3>${title}</h3><ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>
    </div>`).join("")}
  </div>
</div>

<!-- SECTION 4 -->
<div class="section" id="s4">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">4. Non-Functional Requirements</h2>
  <div class="grid2">
    <div class="card card-blue"><h3>Performance</h3><ul>
      <li>Roles cached 15-min (rolesCache); quick stats cached 30s (dashGuard)</li>
      <li>Right-side preview loads entity data on demand (lazy)</li>
      <li>React Query for server state caching and deduplication</li>
      <li>AI calls use minimum context window needed per operation</li>
    </ul></div>
    <div class="card card-purple"><h3>Responsiveness</h3><ul>
      <li>Tailwind responsive layout for mobile and desktop</li>
      <li>Dedicated Mobile page with simplified task/candidate views</li>
      <li>MobileTabBar for bottom navigation on small screens</li>
      <li>Collapsible, pinnable sidebar (state persisted to localStorage)</li>
    </ul></div>
    <div class="card card-green"><h3>Reliability</h3><ul>
      <li>Errors bubble to surface — no silent catch blocks</li>
      <li>Automation delays: browser setTimeout (not durable for production)</li>
      <li>AI calls wrapped with loading state and error user feedback</li>
      <li>File uploads only via Base44 UploadFile integration</li>
    </ul></div>
    <div class="card card-orange"><h3>UX Conventions</h3><ul>
      <li>⌘K: command palette global search (cmdk library)</li>
      <li>⌘J: AI quick actions conversational panel</li>
      <li>?: keyboard shortcuts help overlay</li>
      <li>Click on detail links intercepts to open preview panel (not navigate)</li>
      <li>ESC closes all major modals</li>
    </ul></div>
  </div>
</div>

<!-- SECTION 5 -->
<div class="section" id="s5">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">5. Backend Workflows (Client-Orchestrated)</h2>
  ${[
    { n: "1", title: "Candidate Ingestion", steps: ["Resume file upload → Base44 UploadFile → file_url stored on Candidate", "PDF extraction via ExtractDataFromUploadedFile → structured JSON", "Email deduplication check (filter by email) before create", "create/update Candidate record with extracted fields + resume_url", "Optional: CandidateAIEnrichment fills missing fields via InvokeLLM"] },
    { n: "2", title: "Job Publishing & Careers Sync", steps: ["Job create/update with status='open' triggers careers sync", "Optional: clone to JobStack for public job board visibility", "Notify companies with job_stack_access=true via email (JobNotificationEmail)", "Invoke syncJobToCareers Deno function → POST to talentstack.org/api/jobs", "On status change to filled/cancelled: update or remove from public board"] },
    { n: "3", title: "Email Inbox Parsing", steps: ["User pastes or uploads inbound email content to Email Inbox page", "Saved as InboundEmail with processing_status='pending'", "InvokeLLM detects: 'job_requirement' or 'resume' email type", "Job path: extract title, skills, company, rate → create/update Job record", "Resume path: extract candidate fields → create/update Candidate → create Application"] },
    { n: "4", title: "Automation Rule Execution (executeAutomation.jsx)", steps: ["User action changes entity status (e.g. Submission → 'submitted')", "executeAutomation loads all active AutomationRule rows matching trigger_entity + trigger_status_to", "For each match: setTimeout delay per rule's delay_minutes setting", "send_email: render EmailTemplate, call SendEmail with recipient per email_recipient_type", "create_task: create Task record linked to the triggering entity via related_entity + related_id", "Update AutomationRule.trigger_count++ and last_triggered timestamp"] },
    { n: "5", title: "AI Candidate Matching", steps: ["Recruiter opens Job → Advanced Matching tab (AdvancedCandidateMatching.jsx)", "Fetch all active Candidates; user selects or uses default MatchingProfile", "For each candidate: InvokeLLM with job + candidate + profile criteria_weights", "Receive structured score: dimensions, strengths, concerns, recommendation", "Save MatchFeedback record on user action; user rates → profile learns (feedback_count, avg_feedback_score)"] },
    { n: "6", title: "Bulk Bench Scoring (BulkBenchScorer.jsx)", steps: ["Recruiter selects CandidateView (default: status=our_bench) and open/draft Job", "Iterate candidates — skip those without resume_url (marked 'Skipped')", "For each scored candidate: InvokeLLM with resume text + job requirements", "Persist bench_match_score (number) + bench_score_details (object) to Candidate entity", "Real-time progress bar with per-candidate status (Pending/Scoring/Done/Skipped/Error)"] },
  ].map(w => `
    <div class="card card-slate" style="margin-bottom:12px">
      <h3>${w.n}. ${w.title}</h3>
      <ol style="padding-left:20px">${w.steps.map(s => `<li style="font-size:12px;color:#475569;margin-bottom:4px">${s}</li>`).join("")}</ol>
    </div>`).join("")}
</div>

<!-- SECTION 6 -->
<div class="section" id="s6">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">6. Integrations</h2>
  <div class="grid2">
    ${[
      { name: "Core.InvokeLLM", c: "card-purple", desc: "Primary AI surface. Used for: candidate summaries, screening scores, bench scoring, resume scoring, JD comparison, outreach drafting, interview assistance, duplicate detection, email blast, playbook search, pipeline insights.", params: "prompt, response_json_schema, add_context_from_internet, file_urls, model (o1|claude-4.5|gpt-5|gpt-4o|auto)" },
      { name: "Core.UploadFile", c: "card-blue", desc: "Upload resumes, JDs, and documents to Base44 storage. Returns file_url stored on Candidate or Resume entities.", params: "file (binary blob)" },
      { name: "Core.ExtractDataFromUploadedFile", c: "card-green", desc: "OCR and text extraction from PDF/CSV/Excel/images. Used for resume parsing and bulk import flows.", params: "file_url, json_schema" },
      { name: "Core.SendEmail", c: "card-orange", desc: "Send transactional emails. Gated by AppSettings.provider_connected=true. Used for invoices, follow-ups, automation rule actions, and job blast.", params: "to, subject, body, from_name" },
      { name: "syncJobToCareers (Deno function)", c: "card-slate", desc: "Only serverless function. Validates auth, fetches Job + Company via asServiceRole, transforms to public payload, POSTs to https://talentstack.org/api/jobs.", params: "job_id (in request body)" },
      { name: "Core.GenerateImage", c: "card-slate", desc: "AI image generation. Registered in integrations.js but not prominently used in current flows.", params: "prompt, existing_image_urls" },
    ].map(i => `<div class="card ${i.c}"><h3><code>${i.name}</code></h3><p style="font-size:12px;color:#475569;margin:6px 0">${i.desc}</p><p style="font-size:11px;color:#94A3B8"><strong>Params:</strong> ${i.params}</p></div>`).join("")}
  </div>
</div>

<!-- SECTION 7 -->
<div class="section" id="s7">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">7. Data Model — All ${allEntities.length} Entities</h2>
  <p style="font-size:12px;color:#64748B;margin-bottom:16px">Every entity has built-in auto-generated fields: <code>id</code>, <code>created_date</code>, <code>updated_date</code>, <code>created_by</code> (not listed below).</p>
  ${entitySections}
</div>

<!-- SECTION 8 -->
<div class="section" id="s8">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">8. AI & LLM Feature Inventory (${aiFeatures.length} Features)</h2>
  <div class="card card-purple" style="margin-bottom:16px"><h3>LLM Access Pattern</h3>
    <p style="font-size:12px;color:#475569">All LLM calls go through Base44's <code>Core.InvokeLLM</code>. No vendor SDK called directly. Provider selection abstracted. Default model: gpt-4o-mini (auto). Premium: o1, claude-4.5, gpt-5, gpt-4o.</p>
  </div>
  <table>
    <thead><tr style="background:#1E293B;color:white">
      <th style="padding:8px 12px">#</th>
      <th style="padding:8px 12px">Feature</th>
      <th style="padding:8px 12px">Component / File</th>
      <th style="padding:8px 12px">Description</th>
    </tr></thead>
    <tbody>
      ${aiFeatures.map(([name, comp, desc], i) => `
        <tr style="background:${i%2===0?"#fff":"#F8FAFC"}">
          <td style="padding:6px 12px;border-bottom:1px solid #F1F5F9;color:#94A3B8;font-size:12px">${i+1}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #F1F5F9;font-weight:600;font-size:13px;color:#1E293B">${name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #F1F5F9;font-family:monospace;color:#7C3AED;font-size:11px">${comp}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #F1F5F9;color:#475569;font-size:12px">${desc}</td>
        </tr>`).join("")}
    </tbody>
  </table>
</div>

<!-- SECTION 9 -->
<div class="section" id="s9">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">9. Security & Access Control</h2>
  <div class="grid2">
    <div class="card card-blue"><h3>Authentication</h3><ul>
      <li>Base44-hosted JWT authentication — no custom auth backend</li>
      <li>Token accepted from URL param <code>access_token</code>, removed after capture</li>
      <li>App validates public app settings before user auth check</li>
      <li>Auto-logout: 3-hour inactivity timer (mouse/key events)</li>
      <li>Forced logout on next load if <code>is_locked=true</code> or <code>status ≠ active</code></li>
    </ul></div>
    <div class="card card-purple"><h3>Authorization (RBAC)</h3><ul>
      <li>Built-in <code>user.role</code> (admin | user) + custom Role entity</li>
      <li>PermissionsProvider: isAdmin, can(entity, action), listFilterFor(entity)</li>
      <li>Supported actions per entity: view, create, update, delete</li>
      <li>Scope: 'all' (full access) or 'own' (created_by filter)</li>
      <li>PermissionGate component prevents disallowed UI rendering</li>
      <li>AccessBlocker shown to locked/inactive users on any authenticated route</li>
    </ul></div>
    <div class="card card-green"><h3>Data Security</h3><ul>
      <li>Email sending requires <code>AppSettings.provider_connected=true</code></li>
      <li>File uploads only via Base44 UploadFile (not arbitrary storage writes)</li>
      <li>Only one custom backend function — validates auth before acting</li>
      <li>Audit log captures login events with IP and user_agent per session</li>
      <li>RLS on Base44 platform mirrors client-side permission rules server-side</li>
      <li>Sensitive entities (Role, AppSettings, AuditLog) locked to admin-only RLS</li>
    </ul></div>
    <div class="card card-orange"><h3>Known Risks & Limitations</h3><ul>
      <li>Frontend-heavy: most workflow logic executes in browser (session-sensitive)</li>
      <li>Automation delays use browser setTimeout — not durable for production</li>
      <li>AI Agents page is a product shell on mock data — not a real execution engine</li>
      <li>No server-side rate limiting beyond Base44 platform limits</li>
    </ul></div>
  </div>
  <div style="margin-top:16px"><h3 style="margin-bottom:8px">Permission Matrix (Typical Configuration)</h3>
  <table>
    <thead><tr style="background:#1E293B;color:white">
      <th style="padding:8px 12px">Entity</th>
      <th style="padding:8px 12px;text-align:center">Admin View</th>
      <th style="padding:8px 12px;text-align:center">Admin Write</th>
      <th style="padding:8px 12px;text-align:center">Recruiter View</th>
      <th style="padding:8px 12px;text-align:center">Recruiter Write</th>
      <th style="padding:8px 12px;text-align:center">Scope</th>
    </tr></thead>
    <tbody>
      ${[
        ["Candidate", "✓", "✓", "✓", "✓ (update)", "all / own"],
        ["Job", "✓", "✓", "✓", "✓", "all"],
        ["Company", "✓", "✓", "✓", "✓", "all"],
        ["Application", "✓", "✓", "✓ (own)", "✓ (own)", "own"],
        ["Submission", "✓", "✓", "✓ (own)", "✓ (own)", "own (recruiter_id)"],
        ["Task", "✓", "✓", "✓ (own)", "✓ (own)", "own (assigned_to)"],
        ["Invoice / Expense", "✓", "✓", "✓ (if granted)", "—", "own"],
        ["Role / AuditLog", "✓", "✓", "—", "—", "admin only"],
        ["AppSettings / DashboardConfig", "✓", "✓", "✓ (read)", "—", "admin write"],
      ].map(([e, ...c], i) => `<tr style="background:${i%2===0?"#fff":"#F8FAFC"}">
        <td style="padding:7px 12px;border-bottom:1px solid #F1F5F9;font-weight:600;font-size:13px">${e}</td>
        ${c.map(v => `<td style="padding:7px 12px;border-bottom:1px solid #F1F5F9;text-align:center;font-size:13px;color:${v==="✓"?"#16A34A":v==="—"?"#94A3B8":"#475569"}">${v}</td>`).join("")}
      </tr>`).join("")}
    </tbody>
  </table></div>
</div>

<!-- SECTION 10 -->
<div class="section" id="s10">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">10. API Reference</h2>
  <div class="grid2" style="margin-bottom:16px">
    <div class="card card-blue"><h3>Connection Details</h3><ul>
      <li><strong>Base URL:</strong> https://api.base44.com</li>
      <li><strong>Auth:</strong> Bearer JWT token in Authorization header</li>
      <li><strong>Content-Type:</strong> application/json</li>
      <li><strong>Secrets configured:</strong> XAI_API_KEY</li>
    </ul></div>
    <div class="card card-green"><h3>SDK Import</h3>
      <pre>import { base44 } from '@/api/base44Client';</pre>
    </div>
  </div>
  <h3 style="margin-bottom:8px">Entity SDK Operations</h3>
  <pre>// LIST — sorted, limited
const candidates = await base44.entities.Candidate.list('-created_date', 50);

// FILTER — field conditions + sort + limit
const active = await base44.entities.Candidate.filter(
  { status: 'active' }, '-updated_date', 100
);

// GET single record
const c = await base44.entities.Candidate.get(candidateId);

// CREATE — returns new record with auto id, created_date, etc.
const newC = await base44.entities.Candidate.create({
  first_name: 'John', last_name: 'Doe', email: 'john@example.com',
  skills: ['React', 'Node.js'], status: 'active'
});

// UPDATE — partial fields only
await base44.entities.Candidate.update(candidateId, {
  status: 'screening', screening_score: 87
});

// DELETE
await base44.entities.Candidate.delete(candidateId);

// BULK CREATE
await base44.entities.Candidate.bulkCreate([{ ... }, { ... }]);

// SCHEMA — returns JSON schema without built-in fields
const schema = await base44.entities.Candidate.schema();

// REAL-TIME SUBSCRIBE
const unsub = base44.entities.Candidate.subscribe((event) => {
  // event.type: 'create' | 'update' | 'delete'
  // event.id: record ID | event.data: current record
});
unsub(); // cleanup on unmount</pre>

  <h3 style="margin-bottom:8px;margin-top:20px">Auth Operations</h3>
  <pre>const user = await base44.auth.me();
// Returns: { id, email, full_name, role, role_id, status, is_locked, ... }

const authed = await base44.auth.isAuthenticated(); // boolean
await base44.auth.updateMe({ role_id: 'some-role-id' });
base44.auth.logout(redirectUrl?);
base44.auth.redirectToLogin(nextUrl?);
await base44.users.inviteUser('user@example.com', 'user'); // 'user' | 'admin'</pre>

  <h3 style="margin-bottom:8px;margin-top:20px">InvokeLLM — Structured JSON Output</h3>
  <pre>const result = await base44.integrations.Core.InvokeLLM({
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
});</pre>

  <h3 style="margin-bottom:8px;margin-top:20px">Backend Function: syncJobToCareers</h3>
  <pre>// Frontend invocation (Platform V2 — direct import)
import { syncJobToCareers } from "@/functions/syncJobToCareers";
const response = await syncJobToCareers({ job_id: "some-uuid" });
// Returns: { success: true } or { error: "..." }

// Deno implementation summary:
// 1. createClientFromRequest(req) + base44.auth.me() — reject if not authenticated
// 2. Validate job_id in request body — return 400 if missing
// 3. Fetch Job + Company using base44.asServiceRole (bypass RLS)
// 4. Transform to public payload; POST to https://talentstack.org/api/jobs
// 5. Return { success: res.ok }</pre>
</div>

<!-- SECTION 11 -->
<div class="section" id="s11">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">11. Architecture Layers</h2>
  <div class="grid2">
    <div class="card card-blue"><h3>1. Presentation Tier</h3><ul>
      <li>Internal recruiter/admin SPA (React Router v7)</li>
      <li>Public marketing pages (Landing, Blog, Careers, Contact, Products, Services)</li>
      <li>Command palette (⌘K), AI quick actions (⌘J), keyboard shortcuts (?)</li>
      <li>Right-side preview panel (Candidate, Job, Company, Application, Task, Playbook)</li>
      <li>Dashboard with tabs, KPI cards, kanban boards, AI insights panel</li>
      <li>Resume Studio (build, score, compare, AI builder)</li>
    </ul></div>
    <div class="card card-purple"><h3>2. Client Application Tier</h3><ul>
      <li>App.jsx: AuthProvider → QueryClientProvider → BrowserRouter → Routes</li>
      <li>pages.config.js: page registry and routing source of truth</li>
      <li>Layout.jsx: sidebar nav, quick stats, preview orchestration, AI assistant</li>
      <li>PermissionsContext: role/permission matrix, list filters, can() checks</li>
      <li>AuthContext: public app settings, token validation, me() resolution</li>
      <li>rolesCache: 15-min in-memory cache for Role entities</li>
    </ul></div>
    <div class="card card-green"><h3>3. Platform / Backend Tier (Base44)</h3><ul>
      <li>Entity store: list, filter, get, create, update, delete, bulkCreate per entity</li>
      <li>Auth: JWT token-based, me(), logout(), redirectToLogin()</li>
      <li>Integrations: InvokeLLM, SendEmail, UploadFile, ExtractDataFromUploadedFile, GenerateImage</li>
      <li>Serverless functions (Deno): syncJobToCareers</li>
      <li>File storage: UploadFile returns permanent public URL</li>
      <li>RLS enforcement mirrors client-side permission rules server-side</li>
    </ul></div>
    <div class="card card-orange"><h3>4. External Services</h3><ul>
      <li>talentstack.org/api/jobs: public careers job sync endpoint</li>
      <li>ipify.org: IP address resolution for audit logs</li>
      <li>LLM inference: via Base44 Core.InvokeLLM (provider abstracted)</li>
      <li>Email delivery: via Base44 Core.SendEmail (Gmail/Outlook-gated by AppSettings)</li>
      <li>Google Fonts CDN: Bricolage Grotesque, IBM Plex Sans, JetBrains Mono</li>
    </ul></div>
  </div>
</div>

<!-- SECTION 12 -->
<div class="section" id="s12">
  <h2 style="color:#2563EB;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:16px">12. Glossary</h2>
  <table>
    <tbody>
      ${[
        ["Match Score", "Weighted AI-calculated alignment (0–100) between a candidate and a job via AdvancedCandidateMatching"],
        ["Bench Score", "AI score for candidates on the bench against open jobs — stored as bench_match_score on Candidate"],
        ["Screening Score", "AI fit score from CandidateScreening — stored as screening_score on Candidate (0–100)"],
        ["Scope (All/Own)", "Permission scope — 'own' limits records to created_by user; 'all' grants full entity access"],
        ["RLS", "Row-Level Security — server-side Base44 enforcement mirroring client-side permission rules"],
        ["Pipeline Health", "AI-assessed recruitment pipeline state: healthy | at_risk | critical (from TalentPipelineAnalytics)"],
        ["AI Quick Actions", "Conversational AI panel (⌘J) for executing app actions via natural language"],
        ["Paste to Add", "Quick candidate creation from unstructured resume text or LinkedIn bio (PasteToAddCandidate)"],
        ["MatchingProfile", "Configurable AI matching config with 7 weighted criteria dimensions and model selection"],
        ["MatchFeedback", "User rating/action on an AI match result — drives continuous learning loop for MatchingProfile"],
        ["Job Stack", "Public job board — open jobs cloned from internal Job records and published (JobStack entity)"],
        ["AutomationRule", "Event-driven rule: status change trigger → send_email | create_task action"],
        ["Bench", "Candidates available for placement — 'on_bench' (vendor bench) or 'our_bench' (internal bench)"],
        ["InvokeLLM", "Base44 Core integration for calling LLMs — the universal AI execution surface in this app"],
        ["DashboardConfig", "Saved global widget layout for the Dashboard — admin-controlled, shared with all users"],
        ["Preview Panel", "Right-side sliding panel (RightPreviewPanel.jsx) for quick entity viewing without navigating"],
        ["dashGuard", "30-second debounce guard pattern on Dashboard to prevent duplicate concurrent data fetches"],
        ["executeAutomation", "Client-side automation executor (executeAutomation.jsx) — triggered on entity status changes"],
        ["refreshBus", "Lightweight pub/sub event bus for triggering cross-component entity list refreshes"],
        ["PermissionsContext", "React context providing RBAC resolution: can(entity, action), listFilterFor(entity)"],
      ].map(([t, d], i) => `<tr style="background:${i%2===0?"#fff":"#F8FAFC"}">
        <td style="padding:7px 12px;border-bottom:1px solid #F1F5F9;font-weight:600;color:#1E293B;font-size:13px;min-width:180px;white-space:nowrap">${t}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #F1F5F9;color:#475569;font-size:13px">${d}</td>
      </tr>`).join("")}
    </tbody>
  </table>
</div>

<div class="footer">
  Recruiter X Business Requirements Document · Generated ${now} · Confidential & Proprietary
</div>

</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `RecruiterX_BRD_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}