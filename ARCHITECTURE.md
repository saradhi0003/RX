# Recruiter X — Complete Application Architecture

> Updated: 2026-05-13  
> Version: 2.3 — Video + Bookings Edition  
> Stack: Supabase · React 18 · Vite 6 · Tailwind CSS · shadcn/ui · OpenAI · Anthropic Claude · Ollama · LiveKit · React Big Calendar  
> Brand: TalentStack (talentstack.org) — purple `#9333EA` primary, blue `#2563EB` secondary  
> Status: Base44 fully disconnected · LLM keys server-side via `llmProxy` Edge Function · Video calls (LiveKit) + post-call Whisper transcripts + GPT-4o-mini summaries shipping · Scheduling (React Big Calendar) ships · Vercel deployment planned · MV3 browser extension planned

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Infrastructure Layer](#2-infrastructure-layer)
3. [Application Layer](#3-application-layer)
4. [Orchestration Layer](#4-orchestration-layer)
5. [Backend — Supabase Edge Functions](#5-backend--supabase-edge-functions)
6. [LLM Layer](#6-llm-layer)
7. [Authentication & Security](#7-authentication--security)
8. [Data Model — All 36+ Tables](#8-data-model--all-36-tables)
9. [Frontend — Application Design](#9-frontend--application-design)
10. [Frontend — All Pages (51)](#10-frontend--all-pages-49)
11. [Frontend — All Components (145+)](#11-frontend--all-components-145)
12. [Frontend — Lib & API Layer](#12-frontend--lib--api-layer)
13. [Integrations](#13-integrations)
14. [Bot Services — Chatbots](#14-bot-services--chatbots)
15. [Email Pipeline](#15-email-pipeline)
16. [Follow-Up Scheduler](#16-follow-up-scheduler)
17. [AI Agent Architecture & LangGraph Roadmap](#17-ai-agent-architecture--langgraph-roadmap)
18. [Navigation & Routing](#18-navigation--routing)
19. [Environment Variables](#19-environment-variables)
20. [Database Migrations](#20-database-migrations)
21. [Enterprise Features (v2.1)](#21-enterprise-features-v21)
22. [Production Deployment Checklist](#22-production-deployment-checklist)
23. [Base44 → Supabase Migration Status](#23-base44--supabase-migration-status)
24. [Vercel Deployment (LIVE)](#24-vercel-deployment-live)
25. [Browser Extension (Planned)](#25-browser-extension-planned)
26. [Brand System (TalentStack)](#26-brand-system-talentstack)
27. [Video Calls — LiveKit + Recording + Whisper](#27-video-calls--livekit--recording--whisper)
28. [Bookings — Scheduling + Auto-Generated Rooms](#28-bookings--scheduling--auto-generated-rooms)
29. [Phase 1 Cleanup (2026-05-13)](#29-phase-1-cleanup-2026-05-13)
30. [Configuration & Core Files Reference](#30-configuration--core-files-reference)

---

## 1. System Overview

Recruiter X is **TalentStack's** AI-powered recruiting workspace. It automates the recruiter's daily workflow:

- Ingests job posts and resumes from **Email, Telegram, Slack, WhatsApp** channels
- **AI matches** candidates to jobs with LLM-powered scoring and explanations
- **Generates email drafts** (submissions, outreach, follow-ups, clarifications) for human approval
- **Sends via Postmark** with RFC822 threading and reply detection
- **Auto-follows-up** on sent submissions on a configurable cadence
- **(Planned)** A companion MV3 browser extension reads Gmail/Outlook emails and one-clicks them into the workspace as Candidates/Jobs/Companies

The frontend is a Vite + React SPA themed with the TalentStack brand. The backend is fully on Supabase (Postgres + Auth + RLS + Edge Functions + Storage). A legacy Base44 dependency is being progressively removed — see §23.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  INBOUND CHANNELS                                                            │
│  [Email/Postmark]  [Telegram Bot]  [Slack Bot]  [WhatsApp/Twilio]          │
└───────────┬──────────────────┬───────────────────────────────────────────────┘
            │ Webhooks         │ Bot relay (Railway)
            ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  SUPABASE BACKEND                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  Edge Functions  │  │  PostgreSQL DB   │  │  Supabase Auth           │  │
│  │  (Deno runtime)  │  │  RLS + triggers  │  │  + user_profiles table   │  │
│  └────────┬─────────┘  └──────────────────┘  └──────────────────────────┘  │
│           │                                                                  │
│  ┌────────▼──────────────────────────────────────────────────────────────┐  │
│  │  AI ORCHESTRATION                                                      │  │
│  │  parseJob → matchCandidates → draftEmail → approve → sendEmail       │  │
│  │  scheduledFollowupRun (cron) → draft → approve → send → thread       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  REACT FRONTEND  (Vite · React 18 · shadcn/ui · Tailwind)                  │
│  49 pages · 145+ components · lazy-loaded · URL-driven state               │
└──────────────────────────────────────────────────────────────────────────────┘

LLM PROVIDERS (tri-provider + fallback chain):
  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────────┐
  │  OpenAI     │   │  Anthropic Claude │   │  Ollama (local)        │
  │  GPT-4o/mini│   │  claude-haiku/    │   │  llama3.2 / any model  │
  │             │   │  sonnet/opus      │   │                        │
  └─────────────┘   └──────────────────┘   └────────────────────────┘
  Primary fails → auto-fallback to next → then third → error if all fail
```

---

## 2. Infrastructure Layer

| Component | Technology | Host / Location |
|-----------|-----------|----------------|
| Database | PostgreSQL (Supabase managed) | Supabase cloud |
| Edge Functions | Deno runtime (Supabase Edge Functions) | Supabase cloud |
| File storage | Supabase Storage (S3-compatible) | Supabase cloud |
| Auth | Supabase Auth (JWT + RLS) | Supabase cloud |
| Frontend build | Vite 6 + React 18 | Vercel / Netlify / localhost |
| Email inbound | Postmark Inbound (MX records) | Postmark |
| Email outbound | Postmark Transactional API | Postmark |
| Telegram bot | Express + node-telegram-bot-api | Railway |
| Slack bot | Slack Bolt (HTTP mode) | Railway |
| WhatsApp bot | Express + Twilio API | Railway |
| Scheduled jobs | Vercel Cron or Upstash QStash | External cron |
| Local LLM | Ollama HTTP server | `localhost:11434` |

---

## 3. Application Layer

The application is organized into **five distinct layers** that communicate top-to-bottom:

```
┌────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                            │
│  React 18 · Vite 6 · shadcn/ui · Tailwind CSS                │
│  49 pages, lazy-loaded · 145+ components · URL-driven state   │
└──────────────────────────┬─────────────────────────────────────┘
                           │ @supabase/supabase-js
┌──────────────────────────▼─────────────────────────────────────┐
│  ENTITY / API COMPATIBILITY LAYER                              │
│  src/entities/   — 39 entity files                            │
│  src/entities/all.js — barrel re-export                       │
│  src/lib/entityFactory.js — Base44-compatible CRUD adapter     │
│  src/lib/supabase.js      — Supabase client singleton          │
│  src/integrations/Core.js — InvokeFunction, SendEmail, etc.   │
│  src/api/base44Client.js  — Backwards-compat shim             │
└──────────────────────────┬─────────────────────────────────────┘
                           │ HTTP / Supabase SDK
┌──────────────────────────▼─────────────────────────────────────┐
│  ORCHESTRATION LAYER                                           │
│  Supabase Edge Functions (Deno) — event-driven pipelines      │
│  Inbound webhook → classify → parse → match → draft           │
│  Cron → followup drafts → approve → send → thread             │
└──────────────────────────┬─────────────────────────────────────┘
                           │ Supabase SDK (server) / PostgreSQL
┌──────────────────────────▼─────────────────────────────────────┐
│  PERSISTENCE LAYER                                             │
│  PostgreSQL (Supabase) — 36 tables                            │
│  Row-Level Security on every table                             │
│  Audit triggers on 6 core tables                               │
│  FTS GIN indexes on candidates, jobs, companies                │
│  Supabase Storage — resume files, uploads                      │
└──────────────────────────┬─────────────────────────────────────┘
                           │ REST / HTTP
┌──────────────────────────▼─────────────────────────────────────┐
│  EXTERNAL INTEGRATIONS LAYER                                   │
│  OpenAI API · Anthropic API · Ollama · Postmark · Twilio      │
│  Telegram Bot API · Slack API · Supabase Auth                 │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 Entity Factory Pattern

All frontend entity access goes through `src/lib/entityFactory.js`, which produces a Base44-compatible API backed by Supabase:

```js
// Any entity file — one line:
export const Candidate = createEntity("candidates");

// Usage in pages (unchanged from Base44):
const candidates = await Candidate.list("-created_at", 200);
const filtered   = await Candidate.filter({ status: "active" }, "-created_at");
const one        = await Candidate.get(id);
const created    = await Candidate.create({ full_name, email, skills });
const updated    = await Candidate.update(id, { status: "placed" });
await Candidate.delete(id);
```

The factory handles:
- `-field` → `ORDER BY field DESC` translation
- `created_date` alias → maps `created_at` column transparently
- Filter operators: `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$like`, `$or`

---

## 4. Orchestration Layer

The orchestration layer is the AI pipeline — a chain of serverless functions that fire on events and call each other via HTTP.

### 4.1 Main Pipeline — Inbound Job/Resume

```
INBOUND EVENT (email, telegram, slack, whatsapp)
    │
    ▼
[inboundEmailWebhook | channelMessageWebhook]
    │ 1. verify signature
    │ 2. store InboundChannelMessage (status: pending)
    │ 3. check In-Reply-To → stop followup if reply detected
    │ 4. LLM classify: job / resume / reply / spam / unknown
    │
    ├── if job + confidence > threshold
    │       ▼
    │   [aiRecruiterParseJob]
    │       │ LLM extract: title, skills, location, rate, type, etc.
    │       │ create Job entity + AIRecruiterRun (status: parsed)
    │       ├── fire-and-forget: [autoMatchOnInsert]
    │       │       │ deterministic pre-score (skill overlap)
    │       │       │ take top N candidates
    │       │       ▼
    │       │   [aiRecruiterMatchCandidates]
    │       │       │ LLM score each candidate (0-100)
    │       │       │ create CandidateMatchResult records
    │       │       │ AIRecruiterRun.status = matched
    │       │       └── if auto_draft_on_match + score > 80:
    │       │               ▼
    │       │           [aiRecruiterDraftEmail]
    │       │
    │       └── if missing_fields + auto_draft_clarification:
    │               ▼
    │           [aiRecruiterDraftEmail(type: recruiter_clarification)]
    │
    └── if resume
            ▼
        [parseResumeFile]
            │ download file → extract text
            │ LLM parse: name, email, skills, experience, etc.
            └── create/update Candidate entity
```

### 4.2 Approval → Send Pipeline

```
Recruiter opens ApprovalQueue page
    │ sees EmailDraft (status: draft)
    ├── clicks Approve
    │       ▼
    │   [aiRecruiterApproveDraft]
    │       │ EmailDraft.status = approved
    │       │ if send_immediately_on_approval:
    │       ▼
    │   [sendApprovedDraft]
    │       │ generate RFC822 Message-ID
    │       │ set In-Reply-To if thread exists
    │       │ POST Postmark /email
    │       │ create SentEmail record
    │       │ if draft_type == client_submission:
    │       │   create FollowupSchedule
    │       └── if draft_type == followup:
    │               update FollowupSchedule (count++, advance date)
    │
    └── clicks Edit → modifies → clicks Save & Approve
            └── same flow as above
```

### 4.3 Followup Cron Pipeline

```
Cron fires daily (e.g. 09:00 workspace timezone)
    ▼
[scheduledFollowupRun]
    │ load FollowupSchedule WHERE status=scheduled AND next_followup_date <= today
    │ for each:
    │   check followup_count < max_followups
    │   check last_inbound_reply_at is null or before last_outbound_at
    │       ▼
    │   [aiRecruiterDraftEmail(type: followup)]
    │       │ load prior thread for context
    │       │ LLM draft (escalating tone if count >= 2)
    │       │ FollowupSchedule.status = drafted
    │       └── draft appears in ApprovalQueue
    │
    └── return { processed, drafted, skipped, stopped, failed }
```

---

## 5. Backend — Supabase Edge Functions

All functions live at `supabase/functions/<name>/index.ts` (Deno runtime).

### 5.1 Function Catalog

| Function | HTTP | Auth Method | Purpose |
|----------|------|------------|---------|
| `inboundEmailWebhook` | POST | Postmark signature header | Receive Postmark inbound emails |
| `channelMessageWebhook` | POST | `Bearer CHANNEL_BOT_SECRET` | Receive Telegram / Slack / WhatsApp messages |
| `aiRecruiterParseJob` | POST | Supabase JWT | Parse raw job text → Job entity |
| `parseResumeFile` | POST | JWT or `INTERNAL_FUNCTION_TOKEN` | Download + parse resume → Candidate |
| `autoMatchOnInsert` | POST | Supabase JWT | Trigger matching after new job/candidate |
| `aiRecruiterMatchCandidates` | POST | Supabase JWT | LLM score candidates against job |
| `aiRecruiterDraftEmail` | POST | Supabase JWT | Generate email draft (all 5 types) |
| `aiRecruiterApproveDraft` | POST | Supabase JWT | Approve or reject a draft |
| `sendApprovedDraft` | POST | Supabase JWT | Send via Postmark + create FollowupSchedule |
| `stopFollowup` | POST | Supabase JWT | Manually stop FollowupSchedule |
| `scheduledFollowupRun` | POST | `Bearer CRON_SECRET` | Cron: draft all due follow-ups |
| `reprocessChannelMessage` | POST | Supabase JWT | Retry a failed InboundChannelMessage |
| `healthCheck` | POST | Supabase JWT | Check OpenAI / Anthropic / Postmark health |
| `aiRecruiterCreateSubmission` | POST | Supabase JWT | AI creates Submission record |
| `aiRecruiterCreateTask` | POST | Supabase JWT | AI creates Task record |
| `createWhatsappRegistrationCode` | POST | Supabase JWT | Generate 8-char WA registration code |
| `validateWhatsappRegistrationCode` | POST | `Bearer CHANNEL_BOT_SECRET` | Validate code + create ChannelConnection |
| `sendEmail` | POST | Supabase JWT | Generic email send via Postmark |
| `extractDataFromFile` | POST | Supabase JWT | LLM extract structured data from file |
| `generateImage` | POST | Supabase JWT | DALL·E image generation |
| `llmHelper` | POST | Supabase JWT | Generic LLM wrapper |

---

## 6. LLM Layer

### 6.1 Tri-Provider Architecture

Recruiter X supports three LLM backends, switchable via `VITE_LLM_PROVIDER`:

```
VITE_LLM_PROVIDER=openai     → OpenAI API (GPT-4o, GPT-4o-mini, etc.)
VITE_LLM_PROVIDER=anthropic  → Anthropic API (claude-haiku, claude-sonnet, claude-opus)
VITE_LLM_PROVIDER=ollama     → Ollama HTTP (localhost:11434, any local model)
```

### 6.2 src/lib/llm.js — Client-Side LLM Abstraction

Three public exports:

```js
import { invokeLLM, invokeLLMJson, invokeLLMStream } from "@/lib/llm";

// 1. Text response — with automatic fallback chain + cost logging:
const text = await invokeLLM({
  prompt: "Summarize this candidate...",
  system: "You are an expert recruiter...",
  model: "gpt-4o-mini",      // optional override
  temperature: 0.3,
  max_tokens: 2000,
  task: "candidate_summary", // logged to llm_usage table
});

// 2. JSON response — strips markdown fences, parses:
const data = await invokeLLMJson({
  prompt: "Extract job fields from: " + rawText,
  system: "Return valid JSON only.",
});

// 3. Streaming — token-by-token output (no fallback):
const full = await invokeLLMStream(
  { prompt, system },
  (delta, accumulated) => setOutput(accumulated)
);
```

### 6.3 Fallback Chain

`invokeLLM` automatically tries providers in order on failure. `invokeLLMStream` does NOT fall back (SSE state cannot be transferred mid-stream).

| Primary | Fallback order |
|---------|---------------|
| `openai` | openai → anthropic → ollama |
| `anthropic` | anthropic → openai → ollama |
| `ollama` | ollama → openai → anthropic |

### 6.4 Streaming Support

| Provider | Streaming API |
|----------|--------------|
| OpenAI | `client.chat.completions.create({ stream: true })` — async iterator |
| Anthropic | `client.messages.stream()` — `content_block_delta` events |
| Ollama | `POST /api/chat` with `stream: true` — NDJSON lines |

### 6.5 Cost Tracking

Every `invokeLLM` call logs a row to `llm_usage`:

```sql
provider, model, prompt_tokens, completion_tokens,
cost_usd (estimated from hardcoded rate tables), latency_ms, task, created_at
```

Rate tables in `llm.js`:
- OpenAI: GPT-4o ($0.005/$0.015 per 1K), GPT-4o-mini ($0.00015/$0.0006 per 1K)
- Anthropic: claude-haiku ($0.00025/$0.00125), claude-sonnet ($0.003/$0.015), claude-opus ($0.015/$0.075)
- Ollama: $0 (local inference)

`llm_usage_summary` view aggregates by day/provider/model for cost dashboards.

### 6.6 Backend LLM Pattern (Edge Functions)

```typescript
const LLM_PROVIDER = Deno.env.get("LLM_PROVIDER") || "openai";

async function callLLM(system: string, user: string) {
  const primary  = LLM_PROVIDER === "anthropic" ? callAnthropic : callOpenAI;
  const fallback = LLM_PROVIDER === "anthropic" ? callOpenAI   : callAnthropic;
  try   { return await primary(system, user); }
  catch { return await fallback(system, user); }
}
```

### 6.7 Model Assignments

| Task | Default Model | Reasoning |
|------|-------------|-----------|
| Inbound message classification | `gpt-4o-mini` | High volume, fast + cheap |
| Job field extraction | `gpt-4o-mini` | Structured extraction |
| Candidate matching + scoring | `gpt-4o-mini` | Cost-optimized, runs per candidate |
| Email drafting — all types | `gpt-4o` | Quality critical |
| Resume parsing | `gpt-4o-mini` | Structured extraction |
| ATS scoring / Skills Lab | `gpt-4o-mini` | Resume Studio inline calls |
| Resume AI Writer | `gpt-4o-mini` | Section-level generation |
| Ollama local | `llama3.2` | Fully offline, zero cost |

### 6.8 Cost Optimization

- **Keyword pre-filter** (bot services): regex/keyword check before any LLM call
- **Deterministic pre-scoring** in `autoMatchOnInsert`: skill overlap count → only top N candidates get LLM calls
- **Confidence threshold**: email `0.7`, chat `0.6` — low-confidence → `ignored`
- **Context windowing**: match batches of 10 candidates per LLM call
- **Ollama mode**: zero API cost for local development

---

## 7. Authentication & Security

### 7.1 Supabase Auth Flow

```
User visits app
    ▼
AuthProvider (src/lib/AuthContext.jsx)
    │ supabase.auth.getSession()
    │
    ├── session exists:
    │   ▼
    │   load user_profiles row by auth.users.id
    │   setUser({ ...authUser, ...profile })
    │   setIsAuthenticated(true)
    │
    └── no session:
        setIsAuthenticated(false)
        → ProtectedRoute redirects to /Login
```

### 7.2 Auth Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Login.jsx` | `/Login` | Email/password sign-in via Supabase Auth |
| `Register.jsx` | `/Register` | New account creation |
| `Onboarding.jsx` | `/Onboarding` | Post-registration workspace setup |

### 7.3 JWT Flow

```
Browser → POST supabase/auth/v1/token
        ← JWT (access_token, refresh_token)

All Supabase DB queries carry JWT in Authorization header:
    supabase.from("candidates")  → auto-attaches Bearer JWT

Edge Functions receive JWT in:
    Authorization: Bearer {jwt}
    → verified by Supabase runtime
    → auth.uid() and auth.role() available in RLS
```

### 7.4 Row-Level Security (RLS)

Every table has RLS enabled. Policies defined in `002_rls_policies.sql`.

| Category | Tables | Policy |
|----------|--------|--------|
| Authenticated read/write | candidates, companies, jobs, applications, submissions, resumes, tasks, consultants, playbooks, automation_rules, email_templates, invoices, expenses, timesheets, leave_requests, inbound_emails, inbound_channel_messages, ai_recruiter_runs, candidate_match_results, email_drafts, sent_emails, followup_schedules, recruiter_activities | `auth.uid() IS NOT NULL` |
| Admin-only write | channel_connections, whatsapp_registrations, ai_recruiter_settings, app_settings | `auth_is_admin()` |
| Public read + auth write | blog_posts | `status = 'published'` |
| Public insert | form_submissions | `WITH CHECK (TRUE)` |
| Admin read | audit_logs | `auth_is_admin()` |
| Insert any / read admin | llm_usage | insert: authenticated; select: admin |
| Own record only | user_profiles | `id = auth.uid() OR auth_is_admin()` |

### 7.5 auth_is_admin() Helper

```sql
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
```

### 7.6 Webhook / Bot Authentication

| Endpoint | Auth Mechanism |
|----------|---------------|
| `inboundEmailWebhook` | `X-Postmark-Signature` HMAC |
| `channelMessageWebhook` | `Authorization: Bearer CHANNEL_BOT_SECRET` |
| `scheduledFollowupRun` | `Authorization: Bearer CRON_SECRET` |
| `validateWhatsappRegistrationCode` | `Authorization: Bearer CHANNEL_BOT_SECRET` |
| Internal function calls | `Authorization: Bearer INTERNAL_FUNCTION_TOKEN` |

### 7.7 Frontend Permission System

```jsx
const { can, isAdmin } = usePermissions();  // src/components/common/PermissionsContext.jsx

can("Candidate", "update")   // checks role.permissions.Candidate.update
isAdmin                       // role === "admin"

<PermissionGate entity="Invoice" action="create">
  <Button>New Invoice</Button>
</PermissionGate>
```

### 7.8 Auto-Logout

`Layout.jsx` implements a 3-hour inactivity timer (`mousemove`, `keydown` reset it). On expiry: `supabase.auth.signOut()`.

---

## 8. Data Model — All 36 Tables

All tables share:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ` (auto-set by trigger) on mutable tables
- `created_by TEXT` on most tables
- `created_date` alias added by `entityFactory.normalize()` for frontend compatibility

### 8.1 CRM Core

#### candidates
| Column | Type | Notes |
|--------|------|-------|
| `full_name` | TEXT | Required |
| `email` | TEXT | Dedup key |
| `phone` | TEXT | |
| `location` | TEXT | |
| `title` | TEXT | Current job title |
| `summary` | TEXT | Bio / notes |
| `skills` | TEXT[] | GIN indexed (`idx_candidates_skills`) |
| `experience_years` | INTEGER | |
| `current_company` | TEXT | |
| `current_position` | TEXT | Current role (renamed from `current_role` — reserved keyword) |
| `desired_salary` | TEXT | |
| `notice_period` | TEXT | |
| `availability` | TEXT | |
| `visa_status` | TEXT | |
| `linkedin_url` | TEXT | |
| `resume_url` | TEXT | |
| `source` | TEXT | manual/linkedin/referral/job_board/channel/email/imported |
| `status` | TEXT | active/passive/inactive/placed/blacklisted |
| `rating` | NUMERIC(3,1) | 0.0–5.0 |
| `tags` | TEXT[] | |
| `notes` | TEXT | |
| `fts` | TSVECTOR | Generated, GIN indexed — name/email/title/skills/location weighted A–D |

#### companies
| Column | Type | Notes |
|--------|------|-------|
| `name` | TEXT | Required |
| `industry` | TEXT | |
| `size` | TEXT | |
| `website` | TEXT | |
| `location` | TEXT | |
| `description` | TEXT | |
| `logo_url` | TEXT | |
| `linkedin_url` | TEXT | |
| `contact_name/email/phone` | TEXT | |
| `status` | TEXT | active/inactive/prospect/client |
| `notes`, `tags` | TEXT/TEXT[] | |
| `fts` | TSVECTOR | Generated, GIN indexed — name/industry/location/description weighted A–D |

#### jobs
| Column | Type | Notes |
|--------|------|-------|
| `title` | TEXT | Required |
| `company_id` | UUID | FK → companies |
| `company_name` | TEXT | Denormalized |
| `location` | TEXT | |
| `job_type` | TEXT | full_time/part_time/contract/c2c/remote/hybrid |
| `salary_range` | TEXT | |
| `description` | TEXT | Full JD text |
| `requirements` | TEXT | |
| `skills_required` | TEXT[] | GIN indexed (`idx_jobs_skills`) |
| `experience_min/max` | INTEGER | |
| `status` | TEXT | open/closed/on_hold/filled/cancelled |
| `priority` | TEXT | low/medium/high/urgent |
| `source` | TEXT | |
| `openings` | INTEGER | |
| `tags`, `notes`, `raw_text` | | |
| `fts` | TSVECTOR | Generated, GIN indexed — title/company/skills/description weighted A–D |

#### recruiters
user_id (FK → auth.users), full_name, email, phone, title, bio, specialties TEXT[], avatar_url, status.

#### applications
job_id, candidate_id, status (applied/screening/interview/offer/hired/rejected/withdrawn), stage, applied_date, interview_date, offer_date/amount, rejection_reason, notes, score, recruiter_id, source.

#### submissions
job_id, candidate_id, company_id, recruiter_id, status (submitted/interviewing/offered/hired/rejected/withdrawn), submitted_at/by, contact_email/name, submission_notes, client_feedback, bill_rate/pay_rate/placement_fee, start_date/end_date.

#### resumes
candidate_id, file_url/name/size/mime_type (Supabase Storage), raw_text, parsed_data JSONB, parsing_status (pending/processing/done/failed), parsed_at, is_primary.

#### tasks
title, description, status (todo/in_progress/done/cancelled), priority (low/medium/high/urgent), due_date, assigned_to, related_entity_type/id, tags.

### 8.2 People & Finance

#### consultants
skills, rate, availability, current_project, project_end_date.

#### invoices
invoice_number, company_id, submission_id, amount, tax, total, currency, status (draft/sent/paid/overdue/cancelled), issue/due/paid dates, line_items JSONB.

#### expenses
title, amount, currency, category (travel/software/marketing/office/other), date, receipt_url, status (pending/approved/rejected/reimbursed), submitted_by, approved_by.

#### timesheets
consultant_id, submission_id, week_start/end, hours_worked, rate_per_hour, total_amount, status (draft/submitted/approved/rejected/invoiced).

#### leave_requests
user_id, recruiter_id, leave_type (vacation/sick/personal/unpaid/other), start/end dates, days_requested, reason, status (pending/approved/rejected/cancelled).

### 8.3 Content

#### blog_posts
title, slug (unique), content, excerpt, cover_image_url, status (draft/published/archived), author, tags, published_at.

#### form_submissions
form_type (contact/career/demo/general), name, email, phone, message, resume_url, job_id, metadata JSONB, status (new/reviewed/converted/spam).

#### email_templates
name, subject, body, category, variables TEXT[], is_active.

#### playbooks
name, description, category, steps JSONB, is_active.

#### automation_rules
name, description, trigger_event, conditions JSONB, actions JSONB, is_active, run_count, last_run_at.

#### app_settings
key (unique), value JSONB, description, is_public.

### 8.4 AI Recruiter

#### ai_recruiter_settings *(singleton)*
All LLM model assignments, match thresholds, approval gates, followup cadence. One row per workspace.

#### ai_recruiter_runs
job_id, source, source_id, status (started→parsed→matched→draft_created→approved→completed/failed), selected_candidate_ids UUID[], match_count, draft_count, summary, error_message, model_used, started_at, completed_at.

#### candidate_match_results
run_id, job_id, candidate_id, score (0–100), recommendation (strong_submit/maybe/not_recommended), matched_skills, missing_skills, risk_flags, strengths, weaknesses, ai_summary, explanation, model_used, recruiter_feedback, recruiter_action.

#### email_drafts
run_id, job_id, candidate_ids UUID[], company_id, draft_type, channel, to_email, cc, subject, body, status (draft/approved/rejected/sent/send_failed), created_by_ai, approved_by, model_used, followup_schedule_id.

#### recruiter_activities
run_id, entity_type, entity_id, activity_type, title, description, metadata JSONB.

### 8.5 Channel Ingestion

#### channel_connections
workspace_id, channel_type (telegram/slack/email_inbound/whatsapp), channel_name, external_id, credentials JSONB, is_active, filter_keywords TEXT[], default_classification. **UNIQUE(channel_type, external_id)**.

#### inbound_channel_messages
channel_connection_id, channel_type, external_message_id, sender, sender_name, subject, body, attachments JSONB, raw_payload JSONB, received_at, classification, classification_confidence, processing_status (pending/processed/failed/ignored), processed_at, resulting_entity_type/id, ai_recruiter_run_id, error_message.

#### inbound_emails
from_email/name, to_email, subject, body_text/html, message_id (unique), in_reply_to, thread_id, attachments JSONB, raw_payload JSONB, received_at, processing_status, processed_at, resulting_entity_type/id, error_message.

### 8.6 Email Send & Follow-Up

#### sent_emails
draft_id, to_email, cc TEXT[], subject, body, **message_id** (RFC822, unique), in_reply_to, thread_id, provider, provider_message_id, status (sent/delivered/opened/replied/bounced/failed), sent_at, related_entity_type/id, followup_schedule_id.

#### followup_schedules
submission_id, recipient_email, thread_message_id, next_followup_date, followup_count, last_inbound_reply_at, last_outbound_at, status (scheduled/drafted/sent/completed/stopped), cadence_days, max_followups, draft_id, stop_reason.

### 8.7 Security

#### audit_logs
user_id, user_email, action (create/update/delete), entity_type, entity_id, old_data JSONB, new_data JSONB, ip_address, created_at.

PostgreSQL triggers auto-write to `audit_logs` on INSERT/UPDATE/DELETE for: `candidates`, `jobs`, `companies`, `submissions`, `applications`, `tasks`. Trigger function: `audit_entity_change()` (SECURITY DEFINER).

#### user_profiles
id (FK → auth.users), email, full_name, avatar_url, role (admin/member/viewer), workspace_id, phone, title, preferences JSONB.

#### whatsapp_registrations
code (8-char unique), workspace_id, expires_at (+24h), used_at, registered_phone, channel_connection_id.

### 8.8 LLM Cost Tracking

#### llm_usage
provider (openai/anthropic/ollama), model, prompt_tokens INTEGER, completion_tokens INTEGER, cost_usd NUMERIC(10,6), latency_ms INTEGER, task TEXT, user_email, session_id, created_at.

**View:** `llm_usage_summary` — aggregates by day/provider/model with call_count, total_tokens, total_cost_usd, avg_latency_ms. Used for cost dashboard.

**RLS:** any authenticated user can INSERT; only admins can SELECT.

### 8.9 Additional Entities (Stubs / Extended)

| Entity | Table | Purpose |
|--------|-------|---------|
| `DashboardConfig` | `app_settings` (key=dashboard_config) | Per-user widget layout |
| `MatchFeedback` | `candidate_match_results` | Recruiter feedback on AI matches |
| `MatchingProfile` | `ai_recruiter_settings` | AI recruiter configuration |
| `SubmissionView` | `submissions` | View alias for submissions |
| `TaskView` | `tasks` | View alias for tasks |
| `CandidateView` | `candidate_views` | Saved filter views |
| `JobView` | `job_view` | DB view: jobs + company join |
| `CompanyView` | `company_view` | DB view: companies + stats |
| `JobStack` | `jobs` | Bulk job management overlay |
| `InterviewSession` | `interview_sessions` | Interview notes + scoring |
| `OutreachMessage` | `outreach_messages` | Outreach campaign messages |

### 8.10 Database Views

| View | Query | Purpose |
|------|-------|---------|
| `job_view` | jobs JOIN companies | Adds `company_name_resolved`, `company_logo_url` |
| `company_view` | companies + COUNT(open_jobs, submissions) | Enriched company record |
| `llm_usage_summary` | GROUP BY day/provider/model | Cost dashboard aggregation |

### 8.11 Full-Text Search Indexes

| Table | Column | Weights | Index |
|-------|--------|---------|-------|
| candidates | `fts` (generated) | name/email A, title/skills B, location C, summary D | `idx_candidates_fts` GIN |
| candidates | `skills` array | — | `idx_candidates_skills` GIN |
| jobs | `fts` (generated) | title A, company B, location C, description/skills D | `idx_jobs_fts` GIN |
| jobs | `skills_required` array | — | `idx_jobs_skills` GIN |
| companies | `fts` (generated) | name A, industry B, location C, description D | `idx_companies_fts` GIN |

**RPC helpers:** `search_candidates(query TEXT)` and `search_jobs(query TEXT)` use `websearch_to_tsquery` with `ts_rank` ordering.

---

## 9. Frontend — Application Design

### 9.1 Design System — TalentStack Brand

The visual identity matches the parent company website (talentstack.org). Apple-style blues/greys were swapped for the TalentStack purple→blue brand on 2026-05-12.

| Token | Value | CSS variable | Tailwind |
|-------|-------|--------------|----------|
| Primary (purple) | `#9333EA` | `--primary` | `primary` / `purple-600` |
| Secondary (blue) | `#2563EB` | `--secondary` | `secondary` / `blue-600` |
| Foreground | `#0F172A` | `--foreground` | `foreground` / `slate-900` |
| Muted text | `#64748B` | `--muted-foreground` | `muted-foreground` / `slate-500` |
| Background | `#FFFFFF` | `--background` | `background` |
| Light surface | `#F8FAFC` / `#F9FAFB` | `--muted` / `--accent` | `slate-50` / `gray-50` |
| Border | `#E2E8F0` | `--border` | `border` / `slate-200` |
| Destructive | `#EF4444` | `--destructive` | `destructive` / `red-500` |
| Brand gradient | `linear-gradient(135deg, #9333EA, #2563EB)` | `--brand-gradient` | `.gradient-bg` / `.gradient-text` |
| Font (UI) | IBM Plex Sans | `--font-ui` | `font-ui` |
| Font (display) | Bricolage Grotesque | `--font-display` | `font-display` |
| Font (mono) | JetBrains Mono | `--font-mono` | `font-mono` |
| Radius | `rounded-lg` (8px default) | `--radius` | — |
| Brand shadow | `0 6px 22px -8px rgba(147,51,234,.35)` | — | `.brand-shadow` |

**Brand utilities** (in `src/index.css`):
- `.gradient-bg` — solid purple→blue brand gradient
- `.gradient-text` — text clipped to the gradient
- `.gradient-border` — gradient outline on a white background
- `.brand-shadow` — soft purple glow for primary surfaces

**Service accent gradients** (used on landing/marketing surfaces):
- IT Staffing → `from-purple-500 to-indigo-500`
- Medical Consulting → `from-blue-500 to-cyan-500`
- Education Partners → `from-emerald-500 to-teal-500`
- AI Products → `from-fuchsia-500 to-pink-500`

### 9.2 Layout Architecture (`src/Layout.jsx`) — HubSpot-style Rail + Flyout

Refactored 2026-05-12 from a 240px sidebar to a HubSpot-pattern 56px icon rail + 240px hover flyout. Maximizes workspace; group nav is exposed only when needed.

```
<Layout>
  ├── <SidebarRail>  (56px, fixed)
  │     ├── RX logo (gradient tile)
  │     ├── 7 RailButton icons (group entry points)
  │     │     ├── 🏠 Home          (Dashboard, My Work)
  │     │     ├── 👥 Recruiting    (Candidates, Jobs, Connections, Applications, Tasks, Duplicates)
  │     │     ├── ✨ AI            (AI Recruiter, AI Agents, Resume Studio, Automation, Approval Queue)
  │     │     ├── ⚡ Operations    (Playbooks)  *also Skills/Routines once shipped*
  │     │     ├── 📥 Communication (Email Inbox, Channel Inbox, WhatsApp, Email Settings)
  │     │     ├── 💰 Accounts      (Invoices, Expenses)         — permission-gated
  │     │     └── ⚙️ Admin         (Access Control, Approvals, Job Stack, Email Blast, BRD, System Health)
  │     └── Active group: 3px gradient pill on left + purple tint
  │
  ├── <FlyoutPanel>  (240px, fixed at left:56px, shown on rail hover)
  │     ├── header: eyebrow (group name) + title
  │     ├── 80ms open delay / 180ms close delay
  │     └── FlyoutItem rows — sub-nav with badges + active state
  │
  ├── <TopBar>  (52px white, slate-200 border)
  │     ├── Breadcrumb: <group> / <page>
  │     ├── CommandPalette trigger (⌘K) — slate-100 pill search
  │     ├── AI Actions button (gradient pill, opens AIQuickActions)
  │     ├── Notification bell (red dot if unread)
  │     └── Account chip (avatar + name + role → dropdown)
  │
  ├── <main>  (page area, slate-50 bg)
  │     └── <Suspense>
  │           └── <Page /> (lazy-loaded, code-split per route)
  │
  └── <RightPreviewPanel>  (~440px slide-in detail panel)
        ├── 3px purple→blue accent strip across the top
        ├── header: sparkle icon + "RECORD" eyebrow + record title + close
        └── body: AI summary card, linked records, recent activity
```

Hover state lives in Layout component state via `useState(hoveredGroup)`; debounced timers (`openTimer`, `closeTimer`) prevent flicker when sliding diagonally between rail icons and flyout. Hooks are declared **before** the early-return loading guard so hook order stays stable across loading → loaded transitions.

### 9.3 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Open CommandPalette |
| `⌘J` | Open AIQuickActions |
| `?` | Show KeyboardShortcuts help modal |
| `Esc` | Close modals / preview panel |

### 9.4 State Management

| Mechanism | Use |
|-----------|-----|
| React `useState` / `useEffect` | Page-local state |
| `useSearchParams` (react-router-dom) | URL-driven state (search, sort, filters, pagination) |
| TanStack Query | Server state, 60s stale time |
| `src/lib/appCache.js` | Module-level in-memory TTL cache |
| `src/lib/dashboardCache.js` | Dashboard-specific cache, 2 min TTL |
| `refreshBus.jsx` | Cross-component event bus for cache invalidation |
| Supabase Auth store | Auth session, persisted in localStorage |

### 9.5 URL-Driven State (Enterprise)

Key list pages (`Candidates.jsx`, `Jobs.jsx`) use `useSearchParams` to persist UI state in the URL:

| Param | Maps To | Default |
|-------|---------|---------|
| `q` | `searchTerm` | `""` |
| `sort` | `sortBy` | `"created_date"` |
| `order` | `sortOrder` | `"desc"` |
| `stage` | `stageFilter` | `"all"` |
| `page` | `currentPage` | `1` |
| `per_page` | `rowsPerPage` | `25` |
| `view` | `viewType` | `"list"` |

State initialized from URL on mount; updated with `{ replace: true }` on every change. Enables: shareable filtered URLs, browser back/forward navigation.

### 9.6 Data Fetching Pattern

```jsx
const [data, setData]       = useState([]);
const [loading, setLoading] = useState(true);

const load = async () => {
  setLoading(true);
  try {
    const results = await Entity.filter({ status: "active" }, "-created_at", 200);
    setData(results || []);
  } catch { /* addNotification error */ }
  setLoading(false);
};

useEffect(() => { load(); }, []);
```

ChannelInbox and similar live pages set up `setInterval(load, 30000)` for 30-second polling.

### 9.7 Code Splitting

Every page is a `lazy(() => import('./pages/PageName'))` in `src/pages.config.js`. The initial bundle contains only the shell; each page loads on demand.

---

## 10. Frontend — All Pages (49)

### 10.1 Auth Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Login.jsx` | `/Login` | Email/password sign-in |
| `Register.jsx` | `/Register` | New account sign-up |
| `Onboarding.jsx` | `/Onboarding` | Post-registration workspace setup |

### 10.2 Core CRM Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `Dashboard.jsx` | `/Dashboard` | Live stats widgets, pipeline overview, custom widget builder |
| `Candidates.jsx` | `/Candidates` | List + grid, filters, bulk update, AI scoring, CSV import/export, URL-driven state |
| `CandidateDetails.jsx` | `/CandidateDetails` | Full profile, timeline, resume viewer, match history, AI summary |
| `Jobs.jsx` | `/Jobs` | Job list + kanban, bulk paste, CSV export, URL-driven state |
| `JobDetails.jsx` | `/JobDetails` | JD display, matched candidates, submissions, AI run history |
| `Companies.jsx` | `/Companies` | Company grid, email blast, connection count |
| `CompanyDetails.jsx` | `/CompanyDetails` | Company profile, contacts, active jobs, submissions history |
| `Submissions.jsx` | `/Submissions` | Application list + KanbanBoard, follow-up, status pipeline |
| `Tasks.jsx` | `/Tasks` | Task list + kanban, priority/assigned filter, bulk complete |
| `TaskDetails.jsx` | `/TaskDetails` | Task detail, related entity link |
| `MyWork.jsx` | `/MyWork` | Own tasks, timesheets, leave balance, activity feed |
| `Playbooks.jsx` | `/Playbooks` | Playbook list, category filter, smart search |
| `PlaybookDetails.jsx` | `/PlaybookDetails` | Step-by-step playbook, progress tracker |
| `Recruiters.jsx` | `/Recruiters` | Recruiter directory, performance stats |
| `Consultants.jsx` | `/Consultants` | Consultant bench, availability |
| `SkillMatrix.jsx` | `/SkillMatrix` | Candidate skill heatmap |
| `DuplicateManager.jsx` | `/DuplicateManager` | Fuzzy-match duplicates; merge flow |

### 10.3 AI & Intelligence Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `AIRecruiter.jsx` | `/AIRecruiter` | Main AI cockpit: job intake, match queue, draft review, activity timeline |
| `AIAgents.jsx` | `/AIAgents` | Configure automated AI agent behaviors |
| `AutomationRules.jsx` | `/AutomationRules` | Event-triggered automation rule builder |
| `ResumeStudio.jsx` | `/ResumeStudio` | Resume builder + AI Writer (streaming) + ATS scorer (gauge) + Skills Lab |
| `ResumeAnalysis.jsx` | `/ResumeAnalysis` | Standalone resume analysis and scoring |
| `ResumeBuilder.jsx` | `/ResumeBuilder` | Guided resume creation wizard with AI assistance |
| `PipelineAnalytics.jsx` | `/PipelineAnalytics` | Pipeline funnel metrics, conversion rates, Recharts |

### 10.4 Omnichannel Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `ChannelInbox.jsx` | `/ChannelInbox` | Three-pane layout: filters/list/detail; 30s polling; classification badges |
| `ApprovalQueue.jsx` | `/ApprovalQueue` | Tabbed drafts; approve/edit/reject; bulk approve; draft editor modal |
| `WhatsappSetup.jsx` | `/WhatsappSetup` | Registration code; REGISTER flow; connected numbers; pause/resume |
| `SystemHealth.jsx` | `/SystemHealth` | Admin: service health, message/draft status, error log |

### 10.5 Email Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `EmailInbox.jsx` | `/EmailInbox` | Inbound email list, thread view, reply detection |
| `EmailSettings.jsx` | `/EmailSettings` | Postmark config, from address, signature |
| `EmailBlast.jsx` | `/EmailBlast` | Bulk email campaign builder |
| `EmailTemplateBuilder.jsx` | `/EmailTemplateBuilder` | WYSIWYG template builder with variable support |

### 10.6 Admin Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `AccessControl.jsx` | `/AccessControl` | Role management, user invites, permission matrix |
| `Approvals.jsx` | `/Approvals` | Legacy approval workflows |
| `JobStack.jsx` | `/JobStack` | Bulk job management |
| `BRD.jsx` | `/BRD` | Living Business Requirements Document |

### 10.7 Accounts Pages

| Page | Route | Key Features |
|------|-------|-------------|
| `Invoices.jsx` | `/Invoices` | Invoice list, PDF preview, status tracking |
| `Expenses.jsx` | `/Expenses` | Expense tracking, receipt upload, approval flow |

### 10.8 Public Pages

| Page | Route | Notes |
|------|-------|-------|
| `Landing.jsx` | `/Landing` | Marketing landing |
| `Careers.jsx` | `/Careers` | Public job board |
| `Blog.jsx` | `/Blog` | Company blog |
| `Contact.jsx` | `/Contact` | Contact form |
| `Products.jsx` | `/Products` | Product listing |
| `Services.jsx` | `/Services` | Services page |
| `Home.jsx` | `/Home` | App home |
| `Mobile.jsx` | `/Mobile` | Mobile-optimized entry |

---

## 11. Frontend — All Components (145+)

### 11.1 Layout & Shell

| Component | Path | Purpose |
|-----------|------|---------|
| `Layout.jsx` | `src/Layout.jsx` | App shell: sidebar (5 groups), topbar, preview panel, inactivity timer |
| `NavItem` | `src/Layout.jsx` (inline) | Single nav link with active state, badge, icon |
| `AccountsNav` | `src/Layout.jsx` (inline) | Permission-gated Invoices/Expenses section |
| `ProtectedRoute.jsx` | `src/components/` | Redirect to /Login if not authenticated |
| `UserNotRegisteredError.jsx` | `src/components/` | Error page for unregistered users |

### 11.2 Common / Shared

| Component | Purpose |
|-----------|---------|
| `PageHeader.jsx` | Page title + subtitle + right slot |
| `AccessBlocker.jsx` | Full-page block for locked/inactive users |
| `CommandPalette.jsx` | ⌘K global search across entities |
| `KeyboardShortcuts.jsx` | `?` key shortcut reference modal |
| `QuickActions.jsx` | Quick entity creation |
| `AIQuickActions.jsx` | ⌘J AI action palette |
| `RightPreviewPanel.jsx` | Slide-in detail panel |
| `PermissionGate.jsx` | Render children only if `can(entity, action)` |
| `PermissionsContext.jsx` | Context: `can()`, `isAdmin` |
| `DeleteConfirmModal.jsx` | Generic delete confirmation |
| `ImportModal.jsx` | CSV import with field mapping |
| `InviteUserModal.jsx` | Send user email invitation |
| `EmailModal.jsx` | Quick email compose dialog |
| `DataListModal.jsx` | Generic list picker |
| `ListViewSettingsModal.jsx` | Column visibility configuration |
| `SkeletonLoader.jsx` | Loading placeholder (table + card variants) |
| `StatusPath.jsx` | Visual pipeline stage tracker |
| `Breadcrumbs.jsx` | Navigation breadcrumbs |
| `NotificationToast.jsx` | `addNotification({type, title, message})` |
| `refreshBus.jsx` | `emit()` / `listen()` cross-component refresh |
| `useDebouncedValue.jsx` | Debounce hook |

### 11.3 AI Recruiter Components (`components/ai-recruiter/`)

`AIRecruiterDashboard`, `AIRecruiterSettings`, `CandidateMatchQueue`, `EmailDraftReview`, `JobIntakePanel`, `MatchExplanationCard`, `RecruiterActivityTimeline`

### 11.4 Channel Inbox Components (`components/channel-inbox/`)

`ChannelFilter`, `MessageList`, `MessageDetail`, `ChannelConnectionsModal`

### 11.5 Approval Queue Components (`components/approval-queue/`)

`DraftListItem`, `DraftEditor`

### 11.6 AI General Components (`components/ai/`)

`Assistant`, `AdvancedCandidateMatching`, `AdvancedScoring`, `BulkBenchScorer`, `BulkScoring`, `CandidateOutreach`, `CandidateScreening`, `CandidateWorkflowAgent`, `InterviewAssistant`, `MatchingProfileEditor`, `RecommendedCandidates`, `ResumeComparison`, `ResumeVersionComparison`, `ScoreDisplay`, `TalentPipelineAnalytics`

### 11.7 Candidate Components (`components/candidates/`)

`CandidateForm`, `CandidateDetails`, `CandidatePreview`, `CandidatePreviewWithLoader`, `CandidateAISummary`, `CandidateAIEnrichment`, `CandidatesBulkUpdateModal`, `BulkResumeUpload`, `PasteToAddCandidate`

### 11.8 Job Components (`components/jobs/`)

`JobForm`, `EmailBlastModal`, `JobNotificationEmail`, `JobsBulkUpdateModal`, `BulkJobPaste`

### 11.9 Company Components (`components/companies/`)

`CompanyForm`, `CompanyDetailsModal`, `CompanyEmailBlastModal`, `BulkUpdateModal`

### 11.10 Submission Components (`components/submissions/`)

`SubmissionForm`, `SubmissionDetails`, `KanbanBoard`, `SubmissionKanbanCard`, `FollowUpForm`, `ViewSettingsModal`

### 11.11 Resume Components (`components/resume/`)

| Component | Purpose |
|-----------|---------|
| `ResumeFormLeft.jsx` | Resume input form sections |
| `ResumePreview.jsx` | Live A4-layout preview |
| `ResumeLLMBuilder.jsx` | LLM-assisted section writer (streaming) |
| `ResumeAIAssistant.jsx` | Inline AI suggestions per section |
| `ResumeScorer.jsx` | Score resume against a JD |
| `JDResumeCompare.jsx` | JD vs resume skill gap analysis |
| `BulkRanker.jsx` | Rank multiple resumes against JD |
| `VersionsCompare.jsx` | Diff two resume versions |

### 11.12 Dashboard Components (`components/dashboard/`)

`BuilderModal` (drag-and-drop widget builder), `WidgetRenderer` (stat/chart/table/list)

### 11.13 Task Components (`components/tasks/`)

`TaskForm`, `TaskDetails`, `KanbanBoard`, `TaskKanbanCard`, `TaskPreview`

### 11.14 Recruiter Components (`components/recruiters/`)

`RecruiterForm`, `RecruiterDetails`, `TimesheetForm`, `WeeklyTimesheet`, `RangeTimesheet`, `LeaveForm`, `TransferOwnershipModal`

### 11.15 Accounts Components (`components/accounts/`)

`InvoiceForm`, `InvoicePreview`, `ExpenseForm`, `EmailComposerModal`

### 11.16 Email Components (`components/emails/`)

`EmailTemplateBuilder`, `renderToHtml`

### 11.17 Automation & Playbook Components

`AutomationRuleForm`, `executeAutomation`, `PlaybookForm`, `PlaybookDetails`, `PlaybookSmartSearch`, `ContextualSuggestions`, `PlaybookPreview`

### 11.18 Preview Panel Components (`components/previews/`)

`CandidatePreview`, `CandidatePreviewLoader`, `JobPreview`, `JobPreviewLoader`, `CompanyPreview`, `CompanyPreviewLoader`, `ApplicationPreview`, `TaskPreview`, `PlaybookPreview`

### 11.19 Mobile Components (`components/mobile/`)

`MobileTabBar`, `MobileTaskItem`, `QuickAddCandidate`

### 11.20 Agents Component (`components/agents/`)

`AIAgentBuilder` — Configure and preview AI agent trigger conditions and behaviors.

### 11.21 Site / Public Components (`components/site/`)

`PublicNav`, `PublicFooter`

### 11.22 Notifications (`components/notifications/`)

`NotificationToast` — `addNotification({ type, title, message })` global toast system.

### 11.23 UI Primitives (`components/ui/`) — 47 shadcn/ui components

`accordion` · `alert` · `alert-dialog` · `aspect-ratio` · `avatar` · `badge` · `breadcrumb` · `button` · `calendar` · `card` · `carousel` · `chart` · `checkbox` · `collapsible` · `command` · `context-menu` · `dialog` · `drawer` · `dropdown-menu` · `form` · `hover-card` · `input` · `input-otp` · `label` · `menubar` · `navigation-menu` · `pagination` · `popover` · `progress` · `radio-group` · `resizable` · `scroll-area` · `select` · `separator` · `sheet` · `sidebar` · `skeleton` · `slider` · `sonner` · `switch` · `table` · `tabs` · `textarea` · `toast` · `toaster` · `toggle` · `toggle-group` · `tooltip`

---

## 12. Frontend — Lib & API Layer

### 12.1 src/lib/

| File | Exports | Purpose |
|------|---------|---------|
| `supabase.js` | `supabase` | `createClient()` singleton with anon key + persistent session |
| `entityFactory.js` | `createEntity(table)` | Factory → `{list, filter, get, create, update, delete}` backed by Supabase |
| `llm.js` | `invokeLLM`, `invokeLLMJson`, `invokeLLMStream` | Unified tri-provider LLM with fallback chain + cost tracking |
| `AuthContext.jsx` | `AuthProvider`, `useAuth` | Supabase auth state: user, isAuthenticated, isLoadingAuth |
| `appCache.js` | `getUserCached` | Module-level TTL cache for user/profile |
| `dashboardCache.js` | Dashboard cache | 2 min TTL for dashboard data |
| `userCache.js` | User cache | TTL cache for user lookups |
| `query-client.js` | `queryClientInstance` | TanStack Query client (60s stale time) |
| `utils.js` | `cn()` | `clsx` + `tailwind-merge` |
| `NavigationTracker.jsx` | — | Page navigation analytics (passive, no-op if no backend) |
| `PageNotFound.jsx` | — | 404 component |
| `VisualEditAgent.jsx` | — | In-browser visual editing assistant |
| `app-params.js` | — | App-level URL parameter helpers |

### 12.2 src/entities/ — 39 Entity Files

Each file: `export const EntityName = createEntity("table_name");`

| Entity | Table | Notes |
|--------|-------|-------|
| `Candidate` | `candidates` | |
| `Company` | `companies` | |
| `Job` | `jobs` | |
| `Recruiter` | `recruiters` | |
| `Application` | `applications` | |
| `Submission` | `submissions` | |
| `Resume` | `resumes` | |
| `Task` | `tasks` | |
| `Consultant` | `consultants` | |
| `Playbook` | `playbooks` | |
| `AutomationRule` | `automation_rules` | |
| `EmailTemplate` | `email_templates` | |
| `Invoice` | `invoices` | |
| `Expense` | `expenses` | |
| `Timesheet` | `timesheets` | |
| `LeaveRequest` | `leave_requests` | |
| `BlogPost` | `blog_posts` | |
| `FormSubmission` | `form_submissions` | |
| `AppSettings` | `app_settings` | |
| `AuditLog` | `audit_logs` | |
| `InboundEmail` | `inbound_emails` | |
| `ChannelConnection` | `channel_connections` | |
| `InboundChannelMessage` | `inbound_channel_messages` | |
| `AIRecruiterSettings` | `ai_recruiter_settings` | |
| `AIRecruiterRun` | `ai_recruiter_runs` | |
| `CandidateMatchResult` | `candidate_match_results` | |
| `EmailDraft` | `email_drafts` | |
| `SentEmail` | `sent_emails` | |
| `FollowupSchedule` | `followup_schedules` | |
| `RecruiterActivity` | `recruiter_activities` | |
| `WhatsAppRegistration` | `whatsapp_registrations` | |
| `JobView` | `job_view` | DB view |
| `CompanyView` | `company_view` | DB view |
| `Role` | `user_profiles` | Queries role column |
| `User` | `auth.users` + `user_profiles` | Wraps Supabase Auth |
| `CandidateView` | `candidate_views` | Saved filter views |
| `JobStack` | `jobs` | Bulk job management overlay |
| `InterviewSession` | `interview_sessions` | Interview notes + scoring |
| `OutreachMessage` | `outreach_messages` | Outreach campaign messages |

`src/entities/all.js` — barrel re-exports all 39 entities.

### 12.3 src/integrations/Core.js

| Export | Purpose |
|--------|---------|
| `InvokeLLM` | Re-export of `invokeLLM` from `@/lib/llm` |
| `InvokeFunction` | Calls Supabase Edge Function by name |
| `SendEmail` | Calls `sendEmail` Edge Function |
| `UploadFile` | Supabase Storage upload → returns public URL |
| `ExtractDataFromUploadedFile` | Calls `extractDataFromFile` Edge Function |
| `GenerateImage` | Calls `generateImage` Edge Function |
| `SendSMS` | Calls `sendSMS` Edge Function |
| `Core` | Namespace object with all of the above |

### 12.4 src/api/ — Backwards-Compat Shims

| File | Purpose |
|------|---------|
| `base44Client.js` | Exports `base44 = { entities: {...all 35+ entities}, integrations: { Core } }` — pages using `base44.entities.*` work unchanged |
| `entities.js` | Re-exports all from `@/entities/all` |
| `integrations.js` | Re-exports from `@/integrations/Core` |

### 12.5 CSV Export Utilities

Built directly into list pages (no shared library needed):

| Page | Function | Columns |
|------|---------|---------|
| `Candidates.jsx` | `exportCandidatesToCSV(rows)` | 14 columns: name, email, phone, title, company, location, experience, status, skills, score, visa, notice, source, added date |
| `Jobs.jsx` | `exportJobsToCSV(rows)` | 13 columns: title, company, location, type, status, priority, skills, experience, salary, openings, source, posted date |

Both functions generate RFC-4180 compliant CSV with proper quoting and array flattening (`;`-joined).

---

## 13. Integrations

### 13.1 Supabase

| Feature | Usage |
|---------|-------|
| PostgreSQL | Primary database, 36 tables |
| Row-Level Security | Per-table access policies |
| Auth (JWT) | User sign-in/sign-up, session management |
| Edge Functions | All backend serverless handlers (Deno) |
| Storage | Resume files, uploaded documents (`uploads` bucket) |
| Realtime | (Planned) live updates for ChannelInbox |
| RPC functions | `search_candidates()`, `search_jobs()` |

### 13.2 OpenAI

| API | Used For |
|-----|---------|
| `POST /v1/chat/completions` | All text generation (GPT-4o, GPT-4o-mini) |
| `stream: true` | Streaming token output |
| `response_format: { type: "json_object" }` | Structured JSON extraction |
| `POST /v1/images/generations` | DALL·E image generation |

SDK: `openai` npm v4.x.

### 13.3 Anthropic Claude

| API | Used For |
|-----|---------|
| `POST /v1/messages` | Text generation when `LLM_PROVIDER=anthropic` |
| `messages.stream()` | Streaming token output |
| Models | `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-7` |

SDK: `@anthropic-ai/sdk` npm.

### 13.4 Ollama (Local LLMs)

| Config | Value |
|--------|-------|
| Base URL | `http://localhost:11434` (via `VITE_OLLAMA_BASE_URL`) |
| Model | `llama3.2` (via `VITE_OLLAMA_MODEL`) |
| API | `POST /api/chat` with `stream: true/false` |
| Use case | Offline development, zero API cost |

### 13.5–13.8 Postmark · Twilio · Telegram · Slack

_(Unchanged from prior documentation — see §4 Orchestration for pipeline details)_

---

## 14. Bot Services — Chatbots

_(Architecture unchanged — Telegram Bot, Slack Bot, WhatsApp Bot all on Railway, relaying to `channelMessageWebhook`)_

### 14.1 Shared Pattern

```
Channel message
    → Bot Express server (Railway)
    → classifier.ts pre-filter (keyword/length check)
    → POST /channelMessageWebhook (Bearer CHANNEL_BOT_SECRET)
    → Supabase processes and routes
```

---

## 15. Email Pipeline

### 15.1 Inbound Flow

```
External email → Postmark MX → POST /inboundEmailWebhook
    1. Verify X-Postmark-Signature
    2. Store InboundChannelMessage
    3. Check In-Reply-To → stop FollowupSchedule if reply
    4. LLM classify: job/resume/reply/spam/unknown
    5a. job → aiRecruiterParseJob
    5b. resume + attachment → upload → parseResumeFile
    6. Return HTTP 200 always
```

### 15.2 Outbound Flow

```
Recruiter approves draft → sendApprovedDraft
    → generate Message-ID: <{uuid}@recruiterx.io>
    → set In-Reply-To from thread
    → POST Postmark /email
    → create SentEmail
    → if client_submission: create FollowupSchedule
```

### 15.3 RFC822 Threading

Every outbound email: `Message-ID: <{uuid}@recruiterx.io>`  
Follow-ups add: `In-Reply-To: <original-id>` + `References: <id1> <id2>`

---

## 16. Follow-Up Scheduler

```
sendApprovedDraft → FollowupSchedule { status: scheduled, next_followup_date: +cadence_days }
    ↓ (daily cron)
scheduledFollowupRun → for due schedules:
    → aiRecruiterDraftEmail(type: followup)
    → FollowupSchedule.status = drafted
    ↓ (recruiter approves)
sendApprovedDraft → followup_count++, advance next_followup_date
    ↓ (loop until max_followups or reply or manual stop)
```

Auto-stop conditions: candidate replied (In-Reply-To match), max count reached, manual `stopFollowup`, channel deactivated.

Tone escalation: count 0 = polite; count 1 = friendly; count ≥ 2 = direct + opt-out.

---

## 17. AI Agent Architecture & LangGraph Roadmap

### 17.1 Current Design

Multi-step function chains tracked via `AIRecruiterRun.status` state machine:

```
started → parsed → matched → draft_created → approved → completed / failed
```

### 17.2 LangGraph Integration (Roadmap)

```python
graph = StateGraph(RecruiterState)
graph.add_node("parse_job",          parse_job_node)
graph.add_node("search_candidates",  search_candidates_node)
graph.add_node("match_candidates",   match_candidates_node)
graph.add_node("draft_email",        draft_email_node)
graph.add_node("wait_for_approval",  human_approval_node)  # interrupt
graph.add_node("send_email",         send_email_node)
graph.add_node("schedule_followup",  schedule_followup_node)

compiled = graph.compile(checkpointer=SupabaseCheckpointer())
```

Benefits: human-in-the-loop interrupt, persistent state in `ai_recruiter_runs`, replay from last good node, fan-out matching, SSE streaming to UI.

---

## 18. Navigation & Routing

### 18.1 Route Structure

All routes use react-router-dom v7, configured in `src/App.jsx`.

```
/Login            → Login.jsx
/Register         → Register.jsx
/Onboarding       → Onboarding.jsx
/Dashboard        → Dashboard.jsx      (default after login)
/Candidates       → Candidates.jsx     (?q=&sort=&order=&stage=&page=&per_page=)
/CandidateDetails → CandidateDetails.jsx?id=...
/Jobs             → Jobs.jsx           (?q=&sort=&order=&page=)
/JobDetails       → JobDetails.jsx?id=...
/Companies        → Companies.jsx
/CompanyDetails   → CompanyDetails.jsx?id=...
/Submissions      → Submissions.jsx
/Tasks            → Tasks.jsx
/TaskDetails      → TaskDetails.jsx?id=...
/MyWork           → MyWork.jsx
/Playbooks        → Playbooks.jsx
/PlaybookDetails  → PlaybookDetails.jsx?id=...
/Recruiters       → Recruiters.jsx
/Consultants      → Consultants.jsx
/DuplicateManager → DuplicateManager.jsx
/SkillMatrix      → SkillMatrix.jsx
/AIRecruiter      → AIRecruiter.jsx
/AIAgents         → AIAgents.jsx
/AutomationRules  → AutomationRules.jsx
/ResumeStudio     → ResumeStudio.jsx
/ResumeAnalysis   → ResumeAnalysis.jsx
/ResumeBuilder    → ResumeBuilder.jsx
/PipelineAnalytics → PipelineAnalytics.jsx
/ChannelInbox     → ChannelInbox.jsx
/ApprovalQueue    → ApprovalQueue.jsx
/WhatsappSetup    → WhatsappSetup.jsx
/SystemHealth     → SystemHealth.jsx
/EmailInbox       → EmailInbox.jsx
/EmailSettings    → EmailSettings.jsx
/EmailBlast       → EmailBlast.jsx
/EmailTemplateBuilder → EmailTemplateBuilder.jsx
/AccessControl    → AccessControl.jsx
/Approvals        → Approvals.jsx
/JobStack         → JobStack.jsx
/BRD              → BRD.jsx
/Invoices         → Invoices.jsx
/Expenses         → Expenses.jsx
/Landing          → Landing.jsx  (public)
/Careers          → Careers.jsx  (public)
/Blog             → Blog.jsx     (public)
/Contact          → Contact.jsx  (public)
*                 → PageNotFound
```

### 18.2 Rail + Flyout Navigation Structure

Seven groups, each surfaced as a 40×40 icon on the 56px rail. Hovering a rail icon reveals a 240px flyout panel with that group's sub-nav. Permission gates apply per-item, so admin-only items and Invoice/Expense items vanish for users without `view` permission.

```
🏠 Home
  ├── Dashboard          (Live badge)
  └── My Work

👥 Recruiting
  ├── Candidates
  ├── Jobs
  ├── Connections        (Companies)
  ├── Applications       (Submissions)
  ├── Tasks
  └── Duplicates

✨ AI & Intelligence
  ├── AI Recruiter       (Beta badge)
  ├── AI Agents          (3 badge)
  ├── Resume Studio
  ├── Automation
  └── Approval Queue

⚡ Operations
  └── Playbooks
  ── (planned) Skills    *taxonomy of candidate skills + proficiency levels*
  ── (planned) Routines  *recurring scheduled tasks / workflows*

📥 Communication
  ├── Email Inbox
  ├── Channel Inbox
  ├── WhatsApp Setup
  └── Email Settings

💰 Accounts             *(permission gated — Invoice or Expense view permission)*
  ├── Invoices
  └── Expenses

⚙️ Admin                *(isAdmin only)*
  ├── Access Control
  ├── Approvals
  ├── Job Stack
  ├── Email Blast
  ├── BRD
  └── System Health
```

The `navGroups` array in `src/Layout.jsx` is the single source of truth. Helpers:
- `activeGroupId(pathname)` → which group "owns" the current path (drives rail active state)
- `visibleItems(group, { isAdmin, can })` → filters items by permission gate
- `getBreadcrumb(pathname)` → returns `{ group, page }` for the topbar breadcrumb

### 18.3 Page Registration (`src/pages.config.js`)

All 49 pages are `lazy()` imports. Sample:

```js
export const PAGES = {
  "Login":      lazy(() => import('./pages/Login')),
  "Register":   lazy(() => import('./pages/Register')),
  "Onboarding": lazy(() => import('./pages/Onboarding')),
  "Dashboard":  lazy(() => import('./pages/Dashboard')),
  // ... all 49 pages
};
```

---

## 19. Environment Variables

### 19.1 Frontend (`.env.local` — `VITE_*` prefix required)

| Variable | Used By | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Supabase public anon key |
| `VITE_LLM_PROVIDER` | `src/lib/llm.js` | `openai` / `anthropic` / `ollama` |
| `VITE_OPENAI_API_KEY` | `src/lib/llm.js` | OpenAI API key (browser-safe via dangerouslyAllowBrowser) |
| `VITE_ANTHROPIC_API_KEY` | `src/lib/llm.js` | Anthropic API key |
| `VITE_OLLAMA_BASE_URL` | `src/lib/llm.js` | `http://localhost:11434` |
| `VITE_OLLAMA_MODEL` | `src/lib/llm.js` | `llama3.2` |
| `VITE_WHATSAPP_NUMBER` | `WhatsappSetup.jsx` | Display the intake number |
| `VITE_APP_NAME` | various | `Recruiter X` |
| `VITE_APP_URL` | various | App base URL |

> **Note:** Variables without `VITE_` prefix are not exposed to browser code by Vite.

### 19.2 Backend (Supabase Edge Function secrets)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS for server-side operations |
| `OPENAI_API_KEY` | OpenAI API (server-side) |
| `ANTHROPIC_API_KEY` | Anthropic API (server-side) |
| `LLM_PROVIDER` | `openai` / `anthropic` (server default) |
| `POSTMARK_SERVER_TOKEN` | Postmark outbound API |
| `POSTMARK_FROM_EMAIL` | Sender address |
| `POSTMARK_WEBHOOK_SECRET` | Inbound HMAC validation |
| `CHANNEL_BOT_SECRET` | Bot → function auth |
| `CRON_SECRET` | Cron job auth |
| `INTERNAL_FUNCTION_TOKEN` | Function-to-function auth |

### 19.3 Bot Services

| Variable | Bot | Purpose |
|----------|-----|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram | Bot API auth |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram | Signature validation |
| `SLACK_BOT_TOKEN` | Slack | xoxb-... OAuth token |
| `SLACK_SIGNING_SECRET` | Slack | Payload validation |
| `SLACK_APP_TOKEN` | Slack | xapp-... socket mode |
| `TWILIO_ACCOUNT_SID` | WhatsApp | Twilio auth |
| `TWILIO_AUTH_TOKEN` | WhatsApp | Twilio auth |
| `SUPABASE_CHANNEL_WEBHOOK_URL` | All bots | `{supabase-url}/functions/v1/channelMessageWebhook` |
| `CHANNEL_BOT_SECRET` | All bots | Must match backend |

---

## 20. Database Migrations

| File | Lines | Description | Status |
|------|-------|-------------|--------|
| `001_schema.sql` | 882 | All 34+ tables, indexes, updated_at triggers | ✅ Applied |
| `002_rls_policies.sql` | 182 | RLS policies for all tables, `auth_is_admin()` helper | ✅ Applied |
| `003_demo_users.sql` | 40 | Demo user profiles insert (after creating auth users manually) | ✅ Applied |
| `004_enterprise.sql` | 220 | `llm_usage` table + FTS GIN indexes + audit triggers + RPC helpers | ✅ Applied |
| `005_import_prep.sql` | 89 | Adds `legacy_id` + `raw_data JSONB` to importable tables (zero-loss CSV import) | ⚠️  Run before CSV import |

**Pending migrations** (to be authored):
- `006_skills.sql` — `skills` table (id, name, category, proficiency_levels jsonb), `candidate_skills` join table with proficiency
- `007_routines.sql` — `routines` table (id, name, schedule cron, action_kind, payload jsonb, last_run_at, next_run_at, owner_id)

> Run each migration in order in the Supabase SQL Editor (Dashboard → SQL Editor → New query). Migration `005` is required before running `npm run import:data` to preserve every original Base44 column in `raw_data` JSONB.

---

## 21. Enterprise Features (v2.1)

Eight enterprise-grade capabilities added in v2.1:

### 21.1 Streaming LLM Responses

`invokeLLMStream(opts, onChunk)` in `src/lib/llm.js` — streams tokens from all three providers:
- OpenAI: `chat.completions.create({ stream: true })` async iterator
- Anthropic: `messages.stream()` `content_block_delta` events  
- Ollama: `stream: true` NDJSON reader

UI usage: `onChunk(delta, accumulated)` — update React state from `accumulated` for live display. Used in `ResumeStudio.jsx` AI Writer panel.

### 21.2 URL-Driven State

`Candidates.jsx` uses `useSearchParams` (react-router-dom) to initialize and persist: search term, sort column/direction, stage filter, page number, rows per page, view type. State updates fire `setSearchParams({ replace: true })` to avoid history bloat. Enables shareable filtered URLs and browser back/forward.

### 21.3 Full-Text Search Indexes

`004_enterprise.sql` adds:
- Generated `fts` tsvector columns on `candidates`, `jobs`, `companies` (STORED, auto-updated)
- GIN indexes on all three `fts` columns
- GIN indexes on `candidates.skills[]` and `jobs.skills_required[]` arrays
- RPCs: `search_candidates(query)` and `search_jobs(query)` — `websearch_to_tsquery` with `ts_rank` ordering, limit 50

### 21.4 Sidebar Grouping

`src/Layout.jsx` sidebar reorganized into 5 semantic sections with dividers: **Recruiting**, **AI & Intelligence**, **Operations**, **Communication**, **Admin** (gated), **Accounts** (gated).

### 21.5 Bulk Actions + CSV Export

**Candidates** (`More` dropdown):
- "Export Selected (N) as CSV" — exports only checked rows across all pages
- "Export All (N) as CSV" — exports full filtered result set

**Jobs** (`More` dropdown):
- Same pattern with job-specific columns

Both use RFC-4180 compliant generation with proper quoting, `Array.join("; ")` for array fields, timestamped filename.

### 21.6 Audit Log Triggers

`audit_entity_change()` TRIGGER FUNCTION (SECURITY DEFINER) auto-logs to `audit_logs`:
- Tables: `candidates`, `jobs`, `companies`, `submissions`, `applications`, `tasks`
- Events: INSERT (action=create), UPDATE (action=update), DELETE (action=delete)
- Captures: `old_data JSONB`, `new_data JSONB`, calling user's email from `user_profiles`

### 21.7 Fallback LLM Chain

`PROVIDER_CHAIN` constant in `llm.js` — ordered by configured primary provider. `invokeLLM` iterates the chain, catching errors per provider and logging warnings. Throws a combined error message only when all three fail. `invokeLLMStream` does not chain (SSE cannot be rewound mid-stream).

### 21.8 Cost Tracking Table

`llm_usage` table + `llm_usage_summary` view in `004_enterprise.sql`. Every `invokeLLM` (non-streaming) call fires `logUsage()` — non-blocking fire-and-forget that never throws. Rate tables cover OpenAI and Anthropic; Ollama logs $0 cost.

---

## 22. Production Deployment Checklist

### Phase 1 — Core Infrastructure

```
[ ] Create Supabase project
[ ] Copy VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
[ ] Run migrations in order:
      001_schema.sql
      002_rls_policies.sql
      003_demo_users.sql    (after creating auth users)
      004_enterprise.sql
[ ] Set Supabase Edge Function secrets (§19.2)
[ ] Deploy Edge Functions: supabase functions deploy --all
[ ] Create Supabase Storage bucket "uploads" (public read)
[ ] Create first admin user via Supabase Auth dashboard
      → INSERT INTO user_profiles (id, email, role) VALUES (auth_uid, email, 'admin')
```

### Phase 2 — Email

```
[ ] Sign up at postmarkapp.com, create Inbound Server
[ ] Set MX record: MX 10 inbound.postmarkapp.com
[ ] Set Postmark Inbound webhook: {supabase-url}/functions/v1/inboundEmailWebhook
[ ] Set POSTMARK_WEBHOOK_SECRET in Supabase secrets
[ ] Create sender signature for POSTMARK_FROM_EMAIL
[ ] Test: send email → verify in ChannelInbox
```

### Phase 3 — Bot Services

```
[ ] Telegram: create bot @BotFather → railway up → set env vars
[ ] Slack: create app → configure Events API + slash commands → railway up
[ ] WhatsApp: Twilio sandbox → join sandbox → railway up → test REGISTER code flow
```

### Phase 4 — Cron / Follow-up

```
[ ] Set daily cron → POST {supabase-url}/functions/v1/scheduledFollowupRun
    Options: Vercel Cron, Upstash QStash, GitHub Actions (cron '0 9 * * *')
[ ] Set CRON_SECRET in both provider and Supabase secrets
[ ] Test: manually POST → verify draft in ApprovalQueue
```

### Phase 5 — LLM

```
[ ] Set VITE_OPENAI_API_KEY and VITE_ANTHROPIC_API_KEY in .env.local
[ ] Set OPENAI_API_KEY and ANTHROPIC_API_KEY in Supabase secrets
[ ] Set VITE_LLM_PROVIDER=openai (or anthropic)
[ ] For Ollama local: brew install ollama && ollama pull llama3.2 && ollama serve
[ ] Test: paste job in AIRecruiter → verify run completes
[ ] Verify llm_usage rows appearing after AI calls
```

### Phase 6 — Frontend Deployment

```
[ ] npm run build
[ ] Deploy dist/ to Vercel / Netlify
[ ] Set all VITE_* env vars in deployment platform
[ ] Configure custom domain + HTTPS
[ ] Verify auth redirect flow with production URL
[ ] Verify Disable email confirmation in Supabase → Auth → Sign In / Providers
```

### Phase 7 — Production WhatsApp (Meta Business)

```
[ ] Complete Meta Business Verification (~2–4 weeks)
[ ] Purchase dedicated WhatsApp number via Twilio
[ ] Update TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, VITE_WHATSAPP_NUMBER
```

---

## 23. Base44 → Supabase Migration Status

The app was originally built on Base44 (a low-code backend). The migration to Supabase began with `entityFactory.js` exposing a Base44-compatible API over Supabase tables. As of 2026-05-12 the migration is **~90% complete**.

### What's done

- ✅ 45 entity files in `src/entities/` route through `createEntity("table")` → Supabase
- ✅ 5 SQL migrations applied (`001_schema.sql` through `005_import_prep.sql`)
- ✅ Most Edge Functions (AI Recruiter pipeline, channel webhooks, scheduled followups) live on Supabase
- ✅ Auth fully on Supabase Auth with RLS

### What's pending

- ⚠️  **49 files in `src/` still import `base44`** — mostly AI helper calls (`base44.integrations.Core.InvokeLLM`) and a handful of direct entity calls. Each needs to swap to:
  - LLM calls → `src/lib/llm.js` `invokeLLM(...)` (tri-provider with fallback)
  - Entity calls → already-existing `src/entities/X.js`
- ⚠️  `base44/` folder still contains 10 `.jsonc` entity schemas and several legacy functions; these become reference docs once dependencies are removed
- ⚠️  `src/api/base44Client.js` is the import target; deletable after sweep

### Data migration plan

CSV-export-and-import path (chosen over direct API pull):

```
Base44 export → ~/Downloads/*_export.csv  
    ↓ copy
data-import/{Company,Candidate,Job,Consultant,Submission,Task,Timesheet,Role}_export.csv
    ↓ npm run import:data:dry  (verify)
    ↓ npm run import:data       (write)
Supabase tables {companies, candidates, jobs, consultants, submissions, tasks, timesheets, app_settings.roles_definitions}
```

The importer (`scripts/import-csv-data.js`) preserves every original column:
- **Mapped columns** → native Supabase schema (so existing UI works)
- **`raw_data` JSONB** → entire original row, untouched
- **`legacy_id` TEXT** → original Base44 ObjectId, indexed (for cross-reference)

It also remaps foreign keys: `companies.id (old) → uuid (new)`, then resolves `jobs.company_id`, `submissions.candidate_id`, `submissions.job_id`, `tasks.related_id`.

### Production CSV inventory (as of 2026-05-12)

| Entity | Row count |
|--------|-----------|
| Companies | 1,186 |
| Candidates | 2,889 |
| Jobs | 2,709 |
| Submissions | 70 |
| Tasks | 32 |
| Timesheets | 30 |
| Consultants | 1 |
| Roles | 3 |
| **Total** | **6,920** |

### Disconnect sequence (planned)

1. Audit the 49 call sites; categorize: entity vs LLM-integration calls
2. Replace each in batches (entity sweep first, LLM sweep second)
3. Run full build to verify
4. Delete `base44/` directory + `src/api/base44Client.js`
5. Remove any `@base44/*` from `package.json` (none present — local shim only)
6. Final build + smoke test

---

## 24. Vercel Deployment (LIVE)

> **Status (2026-06-21): deployed and live at `https://rx-self.vercel.app`.**
> Repo `github.com/saradhi0003/RX` → Vercel project `rx` (account `saradhi0003`,
> Hobby plan). Production environment tracks the `main` branch; every push to
> `main` auto-triggers a build. The sections below reflect the *actual* shipped
> configuration, followed by the troubleshooting log from first launch.

### Stack split

- **Frontend (Vite SPA)** → Vercel static deploy
- **Backend (Edge Functions + DB + Auth)** → stays on Supabase (already deployed)
- **Bot services** (Telegram, Slack, WhatsApp) → stays on Railway
- **Scheduled cron** → Vercel Cron triggers `scheduledFollowupRun` Edge Function

### `vercel.json` (shipped)

The actual deployed config — note it differs from the original plan: **no `crons`
block** (the daily follow-up still runs as a Supabase-side cron, not Vercel), a
**tightened SPA rewrite** that excludes real asset paths, and a **security-headers
block** that the plan didn't have.

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    // SPA fallback, but DON'T rewrite /api/*, /assets/*, favicon, or any path
    // containing a file extension (.js/.css/.png…) — those must serve the real file.
    { "source": "/((?!api/|assets/|favicon|.*\\..*).*)", "destination": "/index.html" }
  ],
  "headers": [
    // Immutable 1-year cache for content-hashed build assets.
    { "source": "/assets/(.*)", "headers": [
      { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" } ] },
    // Baseline security headers on every response.
    { "source": "/(.*)", "headers": [
      { "key": "X-Frame-Options",        "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy",        "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy",     "value": "camera=(self), microphone=(self), display-capture=(self), geolocation=()" } ] }
  ]
}
```

The SPA rewrite regex `/((?!api/|assets/|favicon|.*\..*).*)` is required because
react-router uses `BrowserRouter`; any deep link (`/candidates?q=foo`) must serve
`index.html`, while real files must not be swallowed by the fallback.

> ✅ **P0-2 (2026-06-21):** `Permissions-Policy` now grants `camera=(self)`,
> `microphone=(self)`, and `display-capture=(self)` so the **VideoCall** page
> (and its screen-recording toolbar) work on the live domain. `geolocation=()`
> stays disabled.

### Environment variables actually set in Vercel (Production)

Only the two Supabase vars are required for the app to connect; the rest are
optional / for features wired later.

| Variable | Value / Source | Required? |
|----------|----------------|-----------|
| `VITE_SUPABASE_URL` | `https://bwjfglerixssibenkjse.supabase.co` | ✅ yes |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_…` (new-format key, **not** a legacy `eyJ…` JWT) | ✅ yes |
| `VITE_LIVEKIT_URL` | `wss://<project>.livekit.cloud` | for video |
| `VITE_LLM_PROVIDER` | `openai` or `anthropic` | optional |
| `VITE_APP_URL` | `https://rx-self.vercel.app` | optional |

> **Key-format gotcha:** this Supabase project issues the **new publishable key
> format** (`sb_publishable_…`, ~46 chars), not the legacy `eyJ…` JWT. The in-app
> "Supabase not connected" hint text says `eyJ…` — that is generic placeholder
> copy, ignore it. Paste the `sb_publishable_…` value verbatim (no quotes/spaces).
> Vite **inlines** these at *build* time, so changing an env var requires a
> **redeploy** (Deployments → ⋯ → Redeploy) — it does not hot-apply.

### How the deploy actually went (2026-06-21)

1. **Pushed local work to GitHub.** ~110 uncommitted files (video, bookings,
   migrations 010/011, livekit functions, Phase-1 cleanup) were committed and
   pushed to `main` — the repo had been stuck on the May 13 commit.
2. **First Vercel build failed:** `Rollup failed to resolve import
   "@livekit/components-styles" from src/pages/VideoCall.jsx`. Cause: the LiveKit
   packages were declared only in the **root** `RX2/package.json`; Vercel builds
   from the `recruiter-x1` repo alone (no parent `node_modules` to hoist from).
   **Fix:** added `@livekit/components-react`, `@livekit/components-styles`, and
   `livekit-client` to `recruiter-x1/package.json` + lockfile, verified
   `npm run build` locally, pushed. Build went green.
3. **Supabase env vars** added in Vercel → Settings → Environments → Production.
   Verified by `curl`-ing the live bundle and grepping the baked-in values —
   `https://bwjfglerixssibenkjse.supabase.co` and the `sb_publishable_…` key were
   present, confirming the build picked them up.

### Troubleshooting log — "empty rows" on `/candidates`

Symptom: data shows on localhost, but `/candidates` is empty in production even
though the build is correct. Root-caused via the data path:

- The entity layer ([src/lib/entityFactory.js](src/lib/entityFactory.js)) does a
  plain `supabase.from("candidates").select("*")` — **no app-level org/user
  filter.** Visibility is 100% governed by RLS.
- The candidates RLS policy is `authenticated_all` =
  `USING (auth.uid() IS NOT NULL)` ([002_rls_policies.sql](supabase/migrations/002_rls_policies.sql)).
  A logged-**out** request therefore returns **HTTP 200 with `[]`** — empty, *not*
  an error. Confirmed by `curl`-ing the REST endpoint with the anon key (no user
  JWT): `GET /rest/v1/candidates → 200 []`.
- **Conclusion:** sessions are stored per-origin in the browser. The valid session
  exists for `localhost:5173`; `rx-self.vercel.app` is a different origin with no
  session → treated as logged-out → empty list. **Fix: actually log in on the
  production domain** (same email/password, or a demo account — the policy isn't
  org-scoped, so any authenticated user sees all rows).
- **Secondary risk:** free-tier Supabase projects **auto-pause after ~7 days idle**.
  A paused DB makes every page empty/erroring regardless of auth. Restore via
  Supabase Dashboard → project → "Restore project" (data is preserved; no redeploy
  needed). _As of 2026-06-21 a restore request was open with Supabase support._

### Custom domain (planned)

Point `app.talentstack.org` at Vercel via CNAME. Update `VITE_APP_URL` and
**Supabase Auth → URL Configuration → Site URL + Redirect URLs** to include the
live origin (otherwise magic-link / OAuth session redirects break on the domain).

---

## 25. Browser Extension (Planned)

A standalone Manifest V3 extension that reads emails from Gmail and Outlook web, classifies them with AI, and pushes the result to Recruiter X as a new Candidate, Job, or Company.

### Goals

- **Zero copy-paste**: open an email → click extension → record created with linked thread
- **Works on Gmail and Outlook web** (different DOMs, separate parsers)
- **AI classification**: Candidate (resume / intro) vs Job (requirement / JD) vs Company (vendor / new account)
- **Authenticates as the recruiter** using a session token from the Recruiter X app

### Architecture

```
[Gmail tab / Outlook tab]
      │
      ▼  content script extracts: subject, from, body, attachments, threadId
[content_script.js]
      │  postMessage → ↓
[background service worker]
      │  POST {supabase-url}/functions/v1/extensionClassifyEmail
      │  headers: Authorization: Bearer <user_jwt>
      ▼
[Supabase Edge Function: extensionClassifyEmail]
      │  1. verify JWT (user_id, recruiter scope)
      │  2. LLM classify → { kind: "candidate"|"job"|"company", confidence, fields }
      │  3. insert into proper table with raw_data preserved
      │  4. return { id, kind, preview }
      ▼
[extension popup]
      └── shows result + "Open in Recruiter X" deep link
```

### Files (to be created)

```
extension/
├── manifest.json                     (MV3, host_permissions for both mail hosts)
├── background/
│   └── service-worker.js             (auth, API calls, message routing)
├── content/
│   ├── gmail-parser.js               (DOM selectors for mail.google.com)
│   └── outlook-parser.js             (DOM selectors for outlook.office.com)
├── popup/
│   ├── popup.html                    (small UI: classify button, result preview)
│   ├── popup.js
│   └── popup.css                     (matches brand: purple primary)
├── options/
│   ├── options.html                  (paste Recruiter X session token or login)
│   └── options.js
└── assets/
    └── icon-{16,32,48,128}.png       (RX gradient logo)
```

### Email parsing details

**Gmail** (`mail.google.com`):
- Subject: `h2.hP`
- From: `span.gD` `[email]` attribute
- Body: `div.a3s.aiL` innerText
- Thread ID: URL fragment after `/thread/`

**Outlook** (`outlook.office.com` / `outlook.live.com`):
- Subject: `div[role="region"] h1` or `[data-app-section="ReadingPaneSubject"]`
- From: `[data-app-section="ReadingPaneSender"]` `span[title]`
- Body: `[role="document"]` innerText
- Thread ID: from `ItemId` in network response (intercept) or URL query

Both targets are fragile — Gmail/Outlook DOM changes break selectors. Parsers will live in standalone files with feature-detection fallbacks and a "report broken parser" path.

### Authentication

The extension stores a short-lived Supabase session token in `chrome.storage.local`. Two paths:

1. **OAuth via Recruiter X app**: extension opens `/extension-auth` page in the main app, user signs in, app posts the token back via `chrome.runtime.sendMessage`.
2. **Manual paste**: options page where user pastes a personal access token (developer / fallback).

### LLM classification prompt sketch

```
System: You classify recruiting emails into one of:
  candidate | job | company | reply | spam
Return JSON: { kind, confidence (0-1), summary, fields }

For kind=candidate, fields: { name, email, phone, current_title, skills[], experience_years, location }
For kind=job:        fields: { title, company, location, skills_required[], rate, type, description }
For kind=company:    fields: { company_name, contact_name, contact_email, industry, website }

User: From: ... \n Subject: ... \n Body: ...
```

### Distribution

- Chrome Web Store (paid developer account)
- Firefox add-on listing (separate manifest tweaks)
- Internal-only "unpacked" install during beta

### Security notes

- `host_permissions` limited to mail hosts only — no `<all_urls>`
- No remote code execution (MV3 forbids it; helpful here)
- Body text is sent to the LLM; surface this in extension UI + privacy policy
- Tokens stored only in `chrome.storage.local`, never `localStorage` or sync storage

---

## 26. Brand System (TalentStack)

The app's visual identity matches the parent company website (talentstack.org). Applied 2026-05-12.

### Core palette

| Role | Hex | Tailwind | Where used |
|------|-----|----------|------------|
| Primary (Purple) | `#9333EA` | `primary` / `purple-600` | All CTAs, accent text, active nav, "RX" in logo |
| Secondary (Blue) | `#2563EB` | `secondary` / `blue-600` | Gradient endpoint, secondary accents |
| Foreground | `#0F172A` | `foreground` / `slate-900` | Headlines, body text |
| Muted text | `#64748B` | `muted-foreground` / `slate-500` | Subheads, captions |
| Background | `#FFFFFF` | `background` | Page surfaces |
| Light surface | `#F8FAFC` / `#F9FAFB` | `slate-50` / `gray-50` | Alternating sections |
| Border | `#E2E8F0` | `border` / `slate-200` | Card borders, dividers |
| Destructive (Red) | `#EF4444` | `destructive` / `red-500` | Form errors, danger actions |

### Signature gradient

```css
background: linear-gradient(135deg, #9333EA 0%, #2563EB 100%);
```

Used on: rail logo tile, AI Actions button, user avatar, RightPreviewPanel top strip, hero CTAs. Available as `--brand-gradient` and `.gradient-bg` / `.gradient-text` utilities in `src/index.css`.

### Logo / icon stack (talentstack.org marketing)

| Hex | Tailwind | Role |
|-----|----------|------|
| `#22D3EE` | `cyan-400` | Left logo panel (shortest) |
| `#1D4ED8` | `blue-700` | Middle logo panel |
| `#7C3AED` | `violet-600` | Right logo panel (tallest) |

### Service section accent gradients

Used on marketing-page service cards (not in the app shell):

| Service | Gradient |
|---------|----------|
| IT Staffing | `from-purple-500 to-indigo-500` |
| Medical Consulting | `from-blue-500 to-cyan-500` |
| Education Partners | `from-emerald-500 to-teal-500` |
| AI Products | `from-fuchsia-500 to-pink-500` |

### Migration notes (2026-05-12)

The previous design used an Apple-inspired blue (`#0071E3`) + green (`#30A14E`) palette with `#1D1D1F`/`#86868B` greys. All references were swept across 23 page files + Layout chrome:

- `#0071E3` → `#9333EA`
- `#0077ED` → `#A855F7` (purple-500 hover variant)
- `#30A14E` → `#10B981` (emerald-500)
- `#1D1D1F` → `#0F172A` (slate-900)
- `#86868B` / `#AEAEB2` → `#94A3B8` (slate-400)
- `#E5E5EA` / `#D1D1D6` → `#E2E8F0` (slate-200)
- `#F5F5F7` → `#F8FAFC` (slate-50)
- `#6E6E73` → `#64748B` (slate-500)
- `#FF3B30` → `#EF4444` (red-500)

Plus CSS variables in `src/index.css` (`--primary`, `--secondary`, `--ring`, `--chart-*`, etc.) were updated to the TalentStack HSL values, so any tailwind utility class like `bg-primary` inherits the new palette automatically.

---

## 27. Video Calls — LiveKit + Recording + Whisper

Added 2026-05-13. Provides a full meeting room inside Recruiter X for screens,
interviews, and team huddles. Replaces the previous Zoom/Meet link copy-paste
workflow with an in-app room that captures audio + screen + transcript.

### 27.1 Components

| Layer | Where | Purpose |
|---|---|---|
| Lobby | [src/pages/VideoCall.jsx](src/pages/VideoCall.jsx) | Room name + display name input. `?room=<name>` deep-links from invites. |
| PreJoin | LiveKit `<PreJoin>` | Camera/mic device test + permission grant before joining the room. **Defaults video OFF** — opt-in via the toggle. `persistUserChoices=false` to avoid stale device-id cache. |
| In-call | LiveKit `<LiveKitRoom>` + `<VideoConference>` | Multi-participant grid + controls (mute, camera, screenshare, chat). |
| Toolbar overlay | [src/components/video/MeetingToolbar.jsx](src/components/video/MeetingToolbar.jsx) | Floating top-right buttons: Screenshot · Record · Stop. |
| Token mint | [supabase/functions/livekitToken/index.ts](supabase/functions/livekitToken/index.ts) | Server-side JWT signing (livekit-server-sdk on Deno). Verify-JWT OFF. |
| Whisper transcription | [supabase/functions/transcribeRecording/index.ts](supabase/functions/transcribeRecording/index.ts) | Downloads `.webm` from Storage → OpenAI Whisper → writes `transcript_text` + `transcript_json` + (if linked) booking summary + action items. |

### 27.2 Recording flow (client-side)

`MeetingToolbar` uses `navigator.mediaDevices.getDisplayMedia()` so the user
picks what's captured (tab / window / screen) plus the mic. MediaRecorder
emits chunked WebM, blobs accumulate in a ref, and on Stop:

1. Concatenate blobs into one `video/webm` File.
2. Upload to Storage bucket `meeting-recordings/<room>/<ISO timestamp>.webm`.
3. INSERT into `video_call_recordings` with `status='uploaded'`.
4. Fire-and-forget `supabase.functions.invoke("transcribeRecording", { body: { recording_id } })`.
5. Edge Function flips status `transcribing` → `done` (or `failed` with `error`).

Trade-offs:
- **Captures only what you screen-share**, not the LiveKit composite. Multi-participant composite recording requires LiveKit Egress (server-side, planned).
- **Whisper 25 MB hard limit.** ~10 min at our 2.5 Mbps bitrate. Function returns `failed` with a clear error past that. Fix: chunked transcription via Egress + multi-part Whisper.
- **All authenticated users** can read every recording (RLS = `auth.uid() IS NOT NULL`). Tighten with a per-row owner policy when commercializing.

### 27.3 Post-call AI summary

After Whisper success and IF the recording row has a `booking_id`, the function
makes a second OpenAI call (`gpt-4o-mini`, JSON response format) that returns
`{ summary, action_items: [{ task, owner, due_date_hint }] }` and writes them
onto the linked `bookings` row. The Bookings detail panel renders them under
"Post-call notes". Failure is non-fatal — transcript is still saved.

### 27.4 Schema (migration 010)

```
storage.buckets:  meeting-recordings (private)
video_call_recordings:
  id, room, owner_email, file_path, duration_seconds,
  size_bytes, mime_type, status,
  transcript_text, transcript_json, error,
  booking_id (added by 011), created_at, updated_at
```

### 27.5 Required Supabase setup

| What | Where |
|---|---|
| Migration 010 | SQL Editor |
| Migration 011 | SQL Editor (must run after 010) |
| Secret `LIVEKIT_URL` | Edge Function Secrets |
| Secret `LIVEKIT_API_KEY` | Edge Function Secrets |
| Secret `LIVEKIT_API_SECRET` | Edge Function Secrets |
| Secret `OPENAI_API_KEY` | Edge Function Secrets (for Whisper + GPT-4o-mini) |
| Function `livekitToken` | Deploy via Editor, **Verify JWT OFF** |
| Function `transcribeRecording` | Deploy via Editor, Verify JWT ON |

Client-side `.env.local` only needs `VITE_LIVEKIT_URL` so the browser knows
which WSS to dial after it has the token.

---

## 28. Bookings — Scheduling + Auto-Generated Rooms

Added 2026-05-13. Replaces external Calendly/Cal.com for the recruiter-led
flow. Public self-serve booking is intentionally out of scope for v1.

### 28.1 Architecture

```
User opens /Bookings
  └─ React Big Calendar shows month/week/day grid of bookings rows
       Click empty slot → BookingForm (create) with start/end pre-filled
       Click event       → detail panel + Edit button
  └─ On INSERT, Postgres trigger generates room_name = "meet-<id6>-<unix>"
       Booking.create returns the row with room_name set
  └─ Detail panel "Join call" → /VideoCall?room=<room_name>
       (uses existing LiveKit token + recording + transcript flow)
  └─ After call, transcribeRecording writes summary + action_items
       onto the booking row → detail panel renders them
```

### 28.2 Components

| File | Role |
|---|---|
| [src/pages/Bookings.jsx](src/pages/Bookings.jsx) | Calendar grid + detail right-panel. RBC localizer via date-fns. |
| [src/components/bookings/BookingForm.jsx](src/components/bookings/BookingForm.jsx) | Create/edit modal. Linked candidate auto-fills guest name+email. Shows meeting link in edit mode. |
| [src/entities/Booking.js](src/entities/Booking.js) | Wrapper around `bookings` table via `createEntity` factory. |

### 28.3 Schema (migration 011)

```
bookings:
  id, title, description,
  host_email, host_name, guest_email, guest_name,
  start_at, end_at (CHECK end > start), timezone,
  status (scheduled | confirmed | in_progress | completed | cancelled | no_show),
  room_name (UNIQUE, auto-generated by trigger),
  candidate_id → candidates(id),
  job_id       → jobs(id),
  recording_id → video_call_recordings(id),    [reverse link of vcr.booking_id]
  summary, action_items (jsonb),
  notes, created_by, created_at, updated_at

triggers:
  bookings_default_room      BEFORE INSERT — sets room_name if NULL
  bookings_updated_at        BEFORE UPDATE
```

The `meet-<id6>-<unix>` room name is opaque (not guessable) and stable for
the booking's lifetime. Sharing the booking's deep-link `/VideoCall?room=...`
is equivalent to sharing the meeting.

### 28.4 Post-call link-back

`video_call_recordings.booking_id` is the FK that lets the transcribe Edge
Function find the right booking to update. The Booking detail panel, when
it renders, fetches the linked recording row to show duration, file size,
status, and an expandable full transcript.

---

## 29. Phase 1 Cleanup (2026-05-13)

Code-quality sweep alongside the Phase 1 features:

- **Removed unused `React` default import from 86 .jsx files** via
  [scripts/drop-unused-react-imports.js](scripts/drop-unused-react-imports.js).
  Safe rewrite — only files where `React` had zero non-import references were
  touched (React 18 JSX transform makes the default unnecessary unless you
  call `React.foo` directly).
- **Companies.jsx** had local `console.log` placeholder stubs for
  `addNotification` and `emitEntityChanged`; replaced with the real imports
  from `@/components/notifications/NotificationToast` and
  `@/components/common/refreshBus`.
- **InviteUserModal.jsx** rewrote the entire "invite via Base44" 8-step
  walkthrough to the actual Supabase Auth invite flow. Removed the
  external link to base44.app/dashboard and the unused `ExternalLink`
  import. Now reflects the real architecture.
- **executeAutomation.jsx** converted dead `console.log("not yet
  implemented")` to `console.warn` with the rule id (semantically correct,
  shows up cleanly in production logs).
- **Edge Function files** got `// @ts-nocheck` headers — Deno globals and
  esm.sh URL imports aren't visible to node-tsc, so the IDE was crying
  about non-issues. Standard pattern across `livekitToken`, `llmProxy`,
  `transcribeRecording`.
- **Tests:** Auth smoke now asserts the "Supabase not connected" banner
  has zero occurrences when env is set. Bookings + VideoCall added to the
  page-walk smoke; full suite is **24 tests passing**.

---

## 30. Configuration & Core Files Reference

A file-by-file explanation of every `.json` and the load-bearing `.js`/`.jsx`
files outside of the page/component trees. (UI primitives under
`src/components/ui/` are vendored shadcn and not listed individually.)

### 30.1 Root `.json` files

| File | What it does |
|---|---|
| **`package.json`** | npm manifest. `"type": "module"` (ESM). Scripts: `dev` (vite), `build` (`vite build`), `lint`, `typecheck` (`tsc -p ./jsconfig.json`), `preview`, `import:data[:dry]` (CSV importer), `audit:features`, `test:smoke[:headed]` (Playwright). Deps include React 18, react-router 7, @supabase/supabase-js, @tanstack/react-query, Radix UI set, framer-motion, recharts, react-big-calendar, the **@livekit/** trio (added 2026-06-21 so Vercel resolves the video imports), `@anthropic-ai/sdk` + `openai` (dev/direct LLM mode). |
| **`package-lock.json`** | npm lockfile — exact resolved dependency tree. Committed so Vercel/CI install reproducibly. Regenerated by `npm install`. |
| **`vercel.json`** | Vercel build + routing + headers. See §24 for the full annotated copy: Vite framework, `dist` output, SPA rewrite that excludes asset paths, immutable cache for `/assets/*`, and baseline security headers. |
| **`jsconfig.json`** | JS/TS language-service + `tsc` typecheck config. `baseUrl: "."` with path alias `@/* → ./src/*`. `checkJs: true` enables type-checking of plain JS via JSDoc. `include` is narrow (components/pages/Layout); `exclude` skips `ui`, `api`, `lib` to keep the typecheck signal clean. |
| **`components.json`** | shadcn/ui generator config. `style: "new-york"`, `tsx: false` (this project is JSX-not-TSX), Tailwind config + `src/index.css`, `baseColor: neutral`, CSS-variable theming on, lucide icon library, and the `@/` import aliases the CLI uses when it scaffolds a component. |

> `.env.local` (gitignored) holds the real secrets; `.env.example` is the
> committed template. See §24 for the production env-var table.

### 30.2 Root `.js` config files (build/tooling)

| File | What it does |
|---|---|
| **`vite.config.js`** | Vite config. Registers `@vitejs/plugin-react` (Fast Refresh + JSX transform) and the single resolve alias `@ → ./src`. Deliberately minimal — no custom `build.rollupOptions`, so dependency resolution must come from `package.json` (this is why the missing LiveKit dep broke the build; see §24). |
| **`tailwind.config.js`** | Tailwind v3 config (CommonJS `module.exports`). `darkMode: ["class"]`, content globs over `index.html` + `src/**`. Theme extends fonts (`display`/`ui`/`mono` CSS vars), radii, and the full **HSL-variable color system** (background, primary, secondary, muted, accent, destructive, chart-1..5, sidebar-*) wired to CSS custom properties — this is the mechanism behind the TalentStack brand theming (§9.1, §26). Accordion keyframes + `tailwindcss-animate` plugin. |
| **`postcss.config.js`** | PostCSS pipeline: `tailwindcss` then `autoprefixer`. Standard, no custom plugins. |
| **`eslint.config.js`** | ESLint flat config. Lints only `src/components`, `src/pages`, `src/Layout.jsx` (browser globals). Extends JS + React recommended, React-Hooks rules. Notably **`no-unused-vars: off`** and **`react/prop-types: off`** (intentional for this codebase), `react/react-in-jsx-scope: off` (React 18 transform), and a `no-unknown-property` allowlist for `cmdk`/`toast` custom attrs. |
| **`playwright.config.js`** | Smoke-test runner. `testDir: ./tests/smoke`, `globalSetup` does auth, **serial** (`fullyParallel:false`, 1 worker — dev server is single-tenant), 60 s timeout (pages make AI calls), baseURL `RX_TEST_URL` or `http://localhost:5175`, chromium only, `webServer: undefined` (assumes a dev server is already running). |

### 30.3 App entry & routing (`src/`)

| File | What it does |
|---|---|
| **`src/main.jsx`** | ReactDOM entry. Mounts `<App/>` into `#root`, imports `index.css`. StrictMode is commented out. Includes a Vite HMR bridge that `postMessage`s `sandbox:before/afterUpdate` to a parent frame (preview/sandbox host integration). |
| **`src/App.jsx`** | Root component. Wraps the tree in `AuthProvider → QueryClientProvider → BrowserRouter`. Defines `PrivateRoute` (redirect to `/Login` if unauthenticated) and `PublicRoute` (redirect authed users to `/Dashboard`). Auth pages (`/Login`, `/Register`, `/Onboarding`) render outside the Layout; all other pages from `pages.config` render lazily inside `<Layout>` under a `<Suspense>` loader. Also mounts `NavigationTracker`, `Toaster`, `VisualEditAgent`. |
| **`src/Layout.jsx`** | The app shell — HubSpot-style icon rail + flyout nav, top bar, command palette, keyboard shortcuts. Full treatment in §9.2. |
| **`src/pages.config.js`** | The page registry. `PAGES` maps route name → `lazy(() => import('./pages/X'))` for **every** page (code-splitting; see §9.7, §10). Consumed by `App.jsx` to generate routes and by the nav to know what exists. Adding a page = add one line here. |

### 30.4 Data & integration layer (`src/lib/`, `src/api/`, `src/entities/`)

| File | What it does |
|---|---|
| **`src/lib/supabase.js`** | Creates and exports the singleton Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Exports `isSupabaseConfigured` (the flag behind the "not connected" banner) and a placeholder fallback so the app still mounts without env. `persistSession + autoRefreshToken + detectSessionInUrl` all on. |
| **`src/lib/entityFactory.js`** | `createEntity(tableName)` → `{ list, filter, get, create, update, delete }`. A Base44-SDK-compatible shim over Supabase: translates Base44 `-field` sort + `{$gt,$in,$like,$or}` filter objects into Supabase query calls, and aliases `created_at → created_date` so legacy JSX keeps working. **No org/user filtering — visibility is pure RLS** (see §24 troubleshooting). Every entity is one line on top of this. |
| **`src/lib/llm.js`** | Provider-agnostic LLM abstraction (`invokeLLM`, `invokeLLMJson`, `invokeLLMStream`). Defaults to routing through the Supabase `llmProxy` Edge Function so keys stay server-side; `VITE_LLM_DIRECT=true` enables dev-only direct browser calls. Adds fallback chain, streaming, and `llm_usage` cost logging. Full detail in §6. |
| **`src/lib/query-client.js`** | The shared `@tanstack/react-query` `QueryClient` singleton. Tuned defaults: `refetchOnWindowFocus: false`, `retry: 1`. |
| **`src/lib/appCache.js`** | Module-level singleton in-memory cache — the single source of truth for current user, roles, quick stats, dashboard data. Survives React navigation (not a hook/context). |
| **`src/lib/userCache.js`** | Thin backwards-compat re-export of the user helpers (`getUserCached`, `invalidateUserCache`, `getCachedUser`) from `appCache.js`. |
| **`src/lib/dashboardCache.js`** | Thin backwards-compat re-export of the dashboard helpers from `appCache.js`. |
| **`src/lib/app-params.js`** | localStorage-backed app parameter/preference store with snake_case key normalization; Node-safe (falls back to a Map when `window` is undefined, e.g. during scripts/tests). |
| **`src/lib/utils.js`** | The ubiquitous `cn(...)` helper — `clsx` + `tailwind-merge` for conditional/merged class names. Imported by virtually every component. |
| **`src/api/entities.js`** | Backwards-compat barrel: `export * from "@/entities/all"` plus `User`. Lets older imports (`@/api/entities`) keep resolving after the entity refactor. |
| **`src/api/integrations.js`** | Backwards-compat barrel re-exporting the Base44-style integration surface (`Core, InvokeLLM, SendEmail, SendSMS, UploadFile, GenerateImage, ExtractDataFromUploadedFile`) from `@/integrations/Core`. |
| **`src/entities/*.js`** | One-liners: `export const X = createEntity("table")`. New this phase: **`Booking.js`** → `bookings` table (§28). `src/entities/all.js` re-exports them; `User.js` is special-cased (auth-bound). |

### 30.5 Build/maintenance scripts (`scripts/`)

All are Node ESM, run ad-hoc (not part of the build).

| File | What it does |
|---|---|
| **`scripts/import-csv-data.js`** | The production data importer (`npm run import:data`, `:dry` for a no-write dry run). Reads CSVs from `data-import/` and upserts into Supabase. Backs the 6,920-record migration (§23). |
| **`scripts/feature-audit.js`** | `npm run audit:features` — static inventory/sanity sweep of pages/entities/features for the readiness docs. |
| **`scripts/drop-unused-react-imports.js`** | One-off codemod (Phase-1 cleanup, §29) that stripped the now-unnecessary `React` default import from 86 `.jsx` files. Only rewrites files with zero `React.`/bare-`React` references. |
| **`scripts/dedupe-entity-imports.js`** | Codemod that de-duplicated entity import statements during the entity refactor. |
| **`scripts/disconnect-base44.js`** | Migration helper for the planned Base44 → Supabase cutover (§23) — finds/cleans remaining Base44 SDK references. |
| **`scripts/deploy-livekit.sh`** | Convenience shell script to deploy the LiveKit Edge Functions + set the required Supabase secrets (§27.5). |

---

*Architecture document — Recruiter X v2.3 (Video + Bookings Edition) — Supabase backend · Tri-provider LLM with fallback + streaming + cost tracking · LLM keys server-side via llmProxy Edge Function · LiveKit video calls + screen recording + Whisper transcripts + GPT-4o-mini post-call summaries · React Big Calendar scheduling with auto-generated rooms · HubSpot-style rail + flyout nav · TalentStack brand · 52 pages · 46 entities · 6,920 records migrated · **LIVE on Vercel at rx-self.vercel.app** · MV3 browser extension planned · last updated 2026-06-21*
