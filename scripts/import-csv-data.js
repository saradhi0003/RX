#!/usr/bin/env node
/**
 * Base44 → Supabase data importer  (UPSERT mode — re-runnable, no data loss)
 *
 * For every row it preserves:
 *   - legacy_id  → original Base44 ObjectId (used as the conflict key)
 *   - raw_data   → full original CSV row as JSONB (zero field loss)
 *   - mapped     → fields mapped to native Supabase columns
 *
 * Foreign-key remapping:
 *   - Builds an old_id → new_uuid map per entity.
 *   - For re-runs it back-fills the map from rows already in Supabase by
 *     selecting (id, legacy_id) after each upsert.
 *
 * SAFETY:
 *   - No DELETE statements. Re-running this script is idempotent: rows are
 *     updated where legacy_id matches, inserted otherwise.
 *   - Set DRY_RUN=true to print what would happen without writing.
 *
 * Run:
 *   1. Apply schema:  paste supabase/migrations/006_import_upsert_ready.sql
 *                     into Supabase Dashboard → SQL Editor → Run
 *   2. Drop CSVs into ./data-import/
 *   3. npm install   (papaparse, dotenv, @supabase/supabase-js already in pkg)
 *   4. npm run import:data       (or  DRY_RUN=true npm run import:data )
 */

import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local") });

const DRY_RUN  = process.env.DRY_RUN === "true";
const DATA_DIR = path.join(PROJECT_ROOT, "data-import");

const SUPABASE_URL              = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── helpers ─────────────────────────────────────────────────────────────────

function readCSV(filename) {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️  ${filename} not found, skipping`);
    return [];
  }
  const text = fs.readFileSync(filepath, "utf8");
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (result.errors.length) {
    console.warn(`⚠️  ${filename}: ${result.errors.length} parse warnings`);
  }
  return result.data;
}

function parseJSONField(val) {
  if (val == null || val === "" || val === "null" || val === "NULL") return null;
  if (typeof val !== "string") return val;
  try { return JSON.parse(val); } catch { return null; }
}

function parseArray(val) {
  const j = parseJSONField(val);
  if (Array.isArray(j)) return j;
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}

function parseNum(val) {
  if (val == null || val === "" || val === "null" || val === "NULL") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// For columns with INTEGER type — CSV may carry "4.5" etc.; round to nearest.
function parseInt0(val) {
  const n = parseNum(val);
  return n == null ? null : Math.round(n);
}

function parseDate(val) {
  if (!val || val === "null" || val === "NULL") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseTimestamp(val) {
  if (!val || val === "null" || val === "NULL") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function clean(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" || t === "null" || t === "NULL" ? null : t;
}

// Pick val if it's in the allowed list, else fallback. Original value is
// preserved in raw_data, so coercion never loses information.
function pickEnum(val, allowed, fallback) {
  const v = clean(val);
  return v && allowed.includes(v) ? v : fallback;
}

// ── preflight ───────────────────────────────────────────────────────────────
// Verify that migration 006 has been applied. We probe each table for the
// `legacy_id` column. PostgREST returns code 42703 if a column is missing.
async function preflight() {
  console.log("🔎 Preflight: checking that migration 006 is applied…");
  const tables = [
    "companies", "candidates", "jobs", "consultants",
    "submissions", "tasks", "timesheets",
  ];
  const missing = [];
  for (const t of tables) {
    const { error } = await supabase.from(t).select("legacy_id").limit(1);
    if (error) {
      if (error.code === "42703" || /legacy_id/i.test(error.message)) {
        missing.push(t);
      } else {
        console.warn(`  ⚠️  ${t}: ${error.message}`);
      }
    }
  }
  if (missing.length) {
    console.error("\n❌ Schema not ready — `legacy_id` missing on:");
    missing.forEach(t => console.error(`     • ${t}`));
    console.error("\n👉 Paste supabase/migrations/006_import_upsert_ready.sql into the");
    console.error("   Supabase Dashboard → SQL Editor → Run, then re-run this script.\n");
    process.exit(2);
  }
  console.log("  ✓ all 7 tables have legacy_id\n");
}

// ── upsert ──────────────────────────────────────────────────────────────────
// Upsert in batches, return id↔legacy_id pairs (for FK remapping). Rows whose
// legacy_id is null are inserted without a conflict target (PostgREST treats
// the upsert as plain insert in that case).
async function upsertBatch(table, rows) {
  if (rows.length === 0) return [];
  if (DRY_RUN) {
    console.log(`  [DRY] would UPSERT ${rows.length} rows into ${table}`);
    console.log(`  [DRY] sample row:`, JSON.stringify(rows[0], null, 2).slice(0, 500));
    return rows.map((r, i) => ({ id: `dry-${i}`, legacy_id: r.legacy_id }));
  }
  const all = [];
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: "legacy_id", ignoreDuplicates: false })
      .select("id, legacy_id");
    if (error) {
      console.error(`  ❌ ${table} batch ${i}: ${error.message}`);
      console.error(`     sample row:`, JSON.stringify(batch[0]).slice(0, 500));
      throw error;
    }
    all.push(...data);
    process.stdout.write(`\r  ↻ ${table}: ${all.length}/${rows.length}`);
  }
  console.log(`\r  ✓ upserted ${all.length} rows into ${table}                   `);
  return all;
}

// Pull every (id, legacy_id) for a table — used to back-fill the FK map for
// rows that already existed in Supabase before this run.
async function loadIdMap(table) {
  const map = {};
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id, legacy_id")
      .not("legacy_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) map[r.legacy_id] = r.id;
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

// ── transformers ────────────────────────────────────────────────────────────

function transformCompany(row) {
  const contacts = parseJSONField(row.contacts) || [];
  return {
    name: clean(row.company_name) || clean(row.name) || "Unknown Company",
    industry: clean(row.industry),
    website: clean(row.website),
    description: clean(row.description),
    location: clean(row.location),
    contact_name: clean(row.primary_contact_last_name),
    contact_phone: clean(row.primary_phone) || clean(row.secondary_phone),
    contact_email: contacts[0]?.email || null,
    status: pickEnum(row.status, ["active","inactive","prospect","client"], "prospect"),
    notes: clean(row.description),
    contacts,
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformCandidate(row) {
  const skills = parseArray(row.skills);
  const first  = clean(row.first_name);
  const last   = clean(row.last_name);
  return {
    full_name: [first, last].filter(Boolean).join(" ") || "Unknown",
    first_name: first,
    last_name: last,
    email: clean(row.email),
    phone: clean(row.phone),
    location: clean(row.location),
    title: clean(row.current_title),
    current_position: clean(row.current_title),
    current_company: clean(row.current_company),
    summary: clean(row.notes),
    skills,
    experience_years: parseInt0(row.experience_years),
    work_authorization: clean(row.work_authorization),
    visa_status: clean(row.work_authorization),
    linkedin_url: clean(row.linkedin_url),
    resume_url: clean(row.resume_url),
    source: pickEnum(row.source, ["manual","linkedin","referral","job_board","channel","email","imported"], "imported"),
    status: pickEnum(row.status, ["active","passive","inactive","placed","blacklisted"], "active"),
    bench_match_score: parseNum(row.bench_match_score),
    screening_score: parseNum(row.screening_score),
    screening_details: parseJSONField(row.screening_details),
    bench_score_details: parseJSONField(row.bench_score_details),
    tags: parseArray(row.tags),
    notes: clean(row.notes),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformJob(row, companyIdMap) {
  return {
    title: clean(row.title) || "Untitled",
    company_id: companyIdMap[row.company_id] || null,
    legacy_company_id: clean(row.company_id),
    location: clean(row.location),
    job_type: pickEnum(row.employment_type || row.contract_type, ["full_time","part_time","contract","c2c","remote","hybrid"], null),
    salary_range: clean(row.salary_text) || clean(row.rate),
    description: clean(row.description),
    requirements: clean(row.requirements),
    skills_required: parseArray(row.required_skills),
    preferred_skills: parseArray(row.preferred_skills),
    experience_min: parseInt0(row.experience_required),
    status: pickEnum(row.status, ["open","closed","on_hold","filled","cancelled"], "open"),
    priority: pickEnum(row.priority, ["low","medium","high","urgent"], "medium"),
    openings: parseInt0(row.positions_available) || 1,
    closing_date: parseDate(row.due_date),
    visa_restrictions: clean(row.visa_restrictions),
    hiring_manager: clean(row.hiring_manager),
    contract_type: clean(row.contract_type),
    rate: clean(row.rate),
    requester_email: clean(row.requester_email),
    requester_name: clean(row.requester_name),
    location_preference: clean(row.location_preference),
    remote_type: clean(row.remote_type),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformConsultant(row) {
  const first = clean(row.first_name);
  const last  = clean(row.last_name);
  return {
    full_name: [first, last].filter(Boolean).join(" ") || "Unknown",
    first_name: first,
    last_name: last,
    email: clean(row.email),
    phone: clean(row.phone),
    company: clean(row.company),
    specialization: parseArray(row.specialization),
    skills: parseArray(row.specialization),
    rate_min: parseNum(row.rate_min),
    rate_max: parseNum(row.rate_max),
    rate_type: clean(row.rate_type),
    availability: clean(row.availability),
    location: clean(row.location),
    linkedin_url: clean(row.linkedin_url),
    portfolio_url: clean(row.portfolio_url),
    rating: parseNum(row.rating),
    notes: clean(row.notes),
    status: pickEnum(row.status, ["available","on_project","unavailable"], "available"),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformSubmission(row, candidateIdMap, jobIdMap) {
  return {
    candidate_id: candidateIdMap[row.candidate_id] || null,
    job_id: jobIdMap[row.job_id] || null,
    legacy_candidate_id: clean(row.candidate_id),
    legacy_job_id: clean(row.job_id),
    legacy_company_id: null,
    status: pickEnum(row.status, ["submitted","interviewing","offered","hired","rejected","withdrawn"], "submitted"),
    submission_notes: clean(row.notes),
    submitted_at: parseTimestamp(row.submittedDate),
    submitted_date_text: clean(row.submittedDate),
    submitted_by: clean(row.created_by),
    follow_up_date: parseDate(row.follow_up_date),
    interview_dates: parseJSONField(row.interview_dates),
    comments: clean(row.comments),
    client_feedback: clean(row.client_feedback),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformTask(row, submissionIdMap) {
  const relatedId = row.related_entity === "submission"
    ? (submissionIdMap[row.related_id] || null)
    : null;
  return {
    title: clean(row.title) || "Untitled",
    description: clean(row.description),
    status: pickEnum(row.status, ["todo","in_progress","done","cancelled"], "todo"),
    priority: pickEnum(row.priority, ["low","medium","high","urgent"], "medium"),
    due_date: parseDate(row.due_date),
    assigned_to: clean(row.assigned_to),
    related_entity: clean(row.related_entity),
    related_id: relatedId,
    legacy_related_id: clean(row.related_id),
    completion_notes: clean(row.completion_notes),
    tags: parseArray(row.tags),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

function transformTimesheet(row, _jobIdMap) {
  const work = parseDate(row.date);
  return {
    user_email: clean(row.user_id),
    work_date: work,
    week_start: work,
    week_end: work,
    legacy_job_id: clean(row.job_id),
    hours_worked: parseNum(row.hours) ?? 0,
    notes: clean(row.notes),
    status: pickEnum(row.status, ["draft","submitted","approved","rejected","invoiced"], "draft"),
    legacy_id: clean(row.id),
    raw_data: row,
  };
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 Base44 → Supabase importer  (upsert mode)");
  console.log(`   Mode:     ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE"}`);
  console.log(`   Data dir: ${DATA_DIR}`);
  console.log(`   Target:   ${SUPABASE_URL}\n`);

  if (!DRY_RUN) await preflight();

  // 1. Companies
  console.log("📥 companies");
  const companies = readCSV("Company_export.csv").map(transformCompany);
  const compIns   = await upsertBatch("companies", companies);
  const companyIdMap = DRY_RUN
    ? Object.fromEntries(compIns.map(r => [r.legacy_id, r.id]))
    : await loadIdMap("companies");

  // 2. Candidates
  console.log("\n📥 candidates");
  const candidates = readCSV("Candidate_export.csv").map(transformCandidate);
  const candIns    = await upsertBatch("candidates", candidates);
  const candidateIdMap = DRY_RUN
    ? Object.fromEntries(candIns.map(r => [r.legacy_id, r.id]))
    : await loadIdMap("candidates");

  // 3. Jobs
  console.log("\n📥 jobs");
  const jobs   = readCSV("Job_export.csv").map(r => transformJob(r, companyIdMap));
  const jobIns = await upsertBatch("jobs", jobs);
  const jobIdMap = DRY_RUN
    ? Object.fromEntries(jobIns.map(r => [r.legacy_id, r.id]))
    : await loadIdMap("jobs");

  // 4. Consultants
  console.log("\n📥 consultants");
  const consultants = readCSV("Consultant_export.csv").map(transformConsultant);
  await upsertBatch("consultants", consultants);

  // 5. Submissions
  console.log("\n📥 submissions");
  const submissions = readCSV("Submission_export.csv").map(r => transformSubmission(r, candidateIdMap, jobIdMap));
  const subIns = await upsertBatch("submissions", submissions);
  const submissionIdMap = DRY_RUN
    ? Object.fromEntries(subIns.map(r => [r.legacy_id, r.id]))
    : await loadIdMap("submissions");

  // 6. Tasks
  console.log("\n📥 tasks");
  const tasks = readCSV("Task_export.csv").map(r => transformTask(r, submissionIdMap));
  await upsertBatch("tasks", tasks);

  // 7. Timesheets
  console.log("\n📥 timesheets");
  const timesheets = readCSV("Timesheet_export.csv").map(r => transformTimesheet(r, jobIdMap));
  await upsertBatch("timesheets", timesheets);

  // 8. Roles → app_settings (JSONB blob, single row)
  console.log("\n📥 roles → app_settings");
  const roles = readCSV("Role_export.csv").map(r => ({
    name: r.name,
    description: r.description,
    permissions: parseJSONField(r.permissions),
    legacy_id: r.id,
  }));
  if (!DRY_RUN && roles.length) {
    const { error } = await supabase.from("app_settings").upsert({
      key: "roles_definitions",
      value: roles,
      description: "Role permission definitions imported from Base44",
      is_public: false,
    }, { onConflict: "key" });
    if (error) console.error(`  ❌ roles: ${error.message}`);
    else console.log(`  ✓ stored ${roles.length} roles in app_settings`);
  } else if (DRY_RUN) {
    console.log(`  [DRY] would upsert ${roles.length} roles into app_settings`);
  }

  // 9. Post-import verification — count what's actually in Supabase now.
  if (!DRY_RUN) {
    console.log("\n🔢 Verifying row counts in Supabase…");
    for (const t of ["companies","candidates","jobs","consultants","submissions","tasks","timesheets"]) {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) console.warn(`  ⚠️  ${t}: ${error.message}`);
      else console.log(`  • ${t.padEnd(13)} ${count}`);
    }
  }

  console.log("\n✅ Import complete\n");
  console.log("   CSV rows read:");
  console.log("     Companies:    ", companies.length);
  console.log("     Candidates:   ", candidates.length);
  console.log("     Jobs:         ", jobs.length);
  console.log("     Consultants:  ", consultants.length);
  console.log("     Submissions:  ", submissions.length);
  console.log("     Tasks:        ", tasks.length);
  console.log("     Timesheets:   ", timesheets.length);
  console.log("     Roles:        ", roles.length);
  console.log("\n   Re-runnable: every row is matched on legacy_id, so running this");
  console.log("   script again will refresh data without duplicating or deleting rows.\n");
}

main().catch(err => {
  console.error("\n💥 Import failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
