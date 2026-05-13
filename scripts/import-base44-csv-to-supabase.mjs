import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DOWNLOADS = "/Users/raghuramaraju/Downloads";
const BATCH_SIZE = 100;

function readEnv(key) {
  const text = fs.readFileSync(".env.local", "utf8");
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  if (!line) throw new Error(`Missing ${key} in .env.local`);
  return line.slice(key.length + 1).replace(/\s+#.*$/, "").trim();
}

const supabase = createClient(
  readEnv("VITE_SUPABASE_URL"),
  readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim() !== ""))
    .map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""])));
}

function loadExport(name) {
  const filePath = path.join(DOWNLOADS, `${name}_export.csv`);
  return parseCsv(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function clean(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.toLowerCase() === "null" || normalized === "#ERROR!") return null;
  return normalized;
}

function number(value) {
  const normalized = clean(value);
  if (!normalized) return null;
  const parsed = Number(String(normalized).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
}

function rating(value) {
  const parsed = number(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(5, parsed));
}

function date(value) {
  const normalized = clean(value);
  if (!normalized) return null;
  const candidate = normalized.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function timestamp(value) {
  const normalized = clean(value);
  if (!normalized) return null;
  return normalized.endsWith("Z") ? normalized : `${normalized.replace(" ", "T")}Z`;
}

function array(value) {
  const normalized = clean(value);
  if (!normalized) return [];
  try {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return normalized.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function json(value, fallback = null) {
  const normalized = clean(value);
  if (!normalized) return fallback;
  try {
    return JSON.parse(normalized);
  } catch {
    return fallback;
  }
}

function compact(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

function legacyNotes(row, baseNotes = "") {
  const notes = clean(baseNotes);
  const legacy = JSON.stringify(row);
  return [notes, `Legacy Base44 export: ${legacy}`].filter(Boolean).join("\n\n");
}

function candidateStatus(row) {
  if (String(row.archive).toLowerCase() === "true") return "inactive";
  const status = clean(row.status);
  return ["active", "passive", "inactive", "placed", "blacklisted"].includes(status) ? status : "active";
}

function jobStatus(row) {
  const status = clean(row.status);
  return ["open", "closed", "on_hold", "filled", "cancelled"].includes(status) ? status : "open";
}

function priority(row) {
  const value = clean(row.priority);
  return ["low", "medium", "high", "urgent"].includes(value) ? value : "medium";
}

function submissionStatus(row) {
  const status = clean(row.status) || clean(row.submissionStatus);
  return ["submitted", "interviewing", "offered", "hired", "rejected", "withdrawn"].includes(status) ? status : "submitted";
}

function taskStatus(row) {
  const status = clean(row.status);
  if (status === "completed") return "done";
  return ["todo", "in_progress", "done", "cancelled"].includes(status) ? status : "todo";
}

function companyStatus(row) {
  const status = clean(row.status);
  if (["active", "inactive", "prospect", "client"].includes(status)) return status;
  return clean(row.type) === "client" ? "client" : "prospect";
}

function jobType(row) {
  const employment = clean(row.employment_type);
  const contract = clean(row.contract_type);
  if (employment === "part_time") return "part_time";
  if (employment === "full_time") return "full_time";
  if (employment === "contract_to_hire") return "contract";
  if (["c2c", "w2", "1099"].includes(contract)) return "contract";
  return "contract";
}

function weekEndFrom(dateValue) {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 6);
  return parsed.toISOString().slice(0, 10);
}

async function insertRows(table, rows) {
  const inserted = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from(table).insert(batch).select("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted.push(...(data || []));
  }
  return inserted;
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

async function selectAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const to = from + 999;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function legacyIdFromText(text) {
  if (!text) return null;
  const marker = "Legacy Base44 export: ";
  const index = text.indexOf(marker);
  if (index === -1) return null;
  try {
    return JSON.parse(text.slice(index + marker.length)).id || null;
  } catch {
    return null;
  }
}

async function seedMapFromExisting(table, textColumn, rows, targetMap) {
  const existingCount = await countRows(table);
  if (!existingCount) return { existingCount: 0, complete: false };

  const existing = await selectAll(table, `id, ${textColumn}`);
  for (const record of existing) {
    const oldId = legacyIdFromText(record[textColumn]);
    if (oldId) targetMap.set(oldId, record.id);
  }

  const expectedIds = new Set(rows.map((row) => row.id).filter(Boolean));
  const importedCount = [...expectedIds].filter((id) => targetMap.has(id)).length;
  if (importedCount === expectedIds.size) {
    console.log(`${table}: ${existingCount} already present, reused mapping`);
    return { existingCount, complete: true };
  }

  console.log(`${table}: ${importedCount}/${expectedIds.size} already present, inserting remaining rows`);
  return { existingCount, complete: false };
}

async function main() {
  const oldToNew = {
    companies: new Map(),
    candidates: new Map(),
    jobs: new Map(),
    consultants: new Map(),
  };

  const companyRows = loadExport("Company");
  const companiesState = await seedMapFromExisting("companies", "notes", companyRows, oldToNew.companies);
  const missingCompanyRows = companyRows.filter((row) => !oldToNew.companies.has(row.id));
  const companies = missingCompanyRows.map((row) => {
    const contacts = json(row.contacts, []);
    const primary = Array.isArray(contacts) ? contacts.find((contact) => contact?.is_primary) || contacts[0] : null;
    const companyName = clean(row.company_name) || clean(row.industry) || clean(row.name) || "Imported Company";
    return compact({
      name: companyName,
      industry: clean(row.industry),
      website: clean(row.website),
      location: clean(row.location),
      description: clean(row.description),
      contact_name: primary?.name || (companyName !== clean(row.name) ? clean(row.name) : null),
      contact_email: primary?.email || null,
      contact_phone: clean(row.primary_phone) || primary?.phone || null,
      status: companyStatus(row),
      notes: legacyNotes(row),
      tags: [],
      created_by: clean(row.created_by),
      created_at: timestamp(row.created_date),
      updated_at: timestamp(row.updated_date),
    });
  });
  if (!companiesState.complete) {
    const insertedCompanies = await insertRows("companies", companies);
    missingCompanyRows.forEach((row, index) => oldToNew.companies.set(row.id, insertedCompanies[index].id));
    console.log(`companies: ${insertedCompanies.length}`);
  }

  const candidateRows = loadExport("Candidate");
  const candidatesState = await seedMapFromExisting("candidates", "notes", candidateRows, oldToNew.candidates);
  const missingCandidateRows = candidateRows.filter((row) => !oldToNew.candidates.has(row.id));
  const candidates = missingCandidateRows.map((row) => {
    const fullName = [clean(row.first_name), clean(row.last_name)].filter(Boolean).join(" ") || clean(row.consultantName) || "Imported Candidate";
    return compact({
      full_name: fullName,
      email: clean(row.email),
      phone: clean(row.phone) || clean(row.contactDetails) || clean(row.marketingNumber) || clean(row.whatsappNumber),
      location: clean(row.location) || clean(row.currentLocationDetail),
      title: clean(row.current_title),
      summary: clean(row.screening_details),
      skills: array(row.skills),
      experience_years: integer(row.experience_years) ?? integer(row.addedExperience),
      current_company: clean(row.current_company),
      current_position: clean(row.current_title),
      desired_salary: clean(row.salary_expectation),
      availability: clean(row.availability),
      visa_status: clean(row.consultantVisaStatus) || clean(row.work_authorization),
      linkedin_url: clean(row.linkedin_url),
      resume_url: clean(row.resume_url) || clean(row.resumeUrlFromGoogleDrive),
      source: "imported",
      status: candidateStatus(row),
      rating: rating(row.rankTheCandidate),
      tags: array(row.tags),
      notes: legacyNotes(row, row.notes),
      created_by: clean(row.created_by),
      created_at: timestamp(row.created_date),
      updated_at: timestamp(row.updated_date),
    });
  });
  if (!candidatesState.complete) {
    const insertedCandidates = await insertRows("candidates", candidates);
    missingCandidateRows.forEach((row, index) => oldToNew.candidates.set(row.id, insertedCandidates[index].id));
    console.log(`candidates: ${insertedCandidates.length}`);
  }

  const jobRows = loadExport("Job");
  const jobsState = await seedMapFromExisting("jobs", "notes", jobRows, oldToNew.jobs);
  const missingJobRows = jobRows.filter((row) => !oldToNew.jobs.has(row.id));
  const jobs = missingJobRows.map((row) => compact({
    title: clean(row.title) || "Imported Job",
    company_id: oldToNew.companies.get(row.company_id) || null,
    location: clean(row.location),
    job_type: jobType(row),
    salary_range: clean(row.salary_text) || clean(row.rate),
    description: clean(row.description),
    requirements: clean(row.requirements),
    skills_required: array(row.required_skills),
    experience_min: integer(row.experience_required),
    status: jobStatus(row),
    priority: priority(row),
    source: "manual",
    closing_date: date(row.due_date),
    openings: number(row.positions_available) || 1,
    tags: array(row.preferred_skills),
    notes: legacyNotes(row, [clean(row.visa_restrictions), clean(row.location_preference)].filter(Boolean).join("\n")),
    raw_text: clean(row.description),
    created_by: clean(row.created_by),
    created_at: timestamp(row.created_date),
    updated_at: timestamp(row.updated_date),
  }));
  if (!jobsState.complete) {
    const insertedJobs = await insertRows("jobs", jobs);
    missingJobRows.forEach((row, index) => oldToNew.jobs.set(row.id, insertedJobs[index].id));
    console.log(`jobs: ${insertedJobs.length}`);
  }

  const consultantRows = loadExport("Consultant");
  const consultantsState = await seedMapFromExisting("consultants", "notes", consultantRows, oldToNew.consultants);
  const missingConsultantRows = consultantRows.filter((row) => !oldToNew.consultants.has(row.id));
  const consultants = missingConsultantRows.map((row) => compact({
    full_name: [clean(row.first_name), clean(row.last_name)].filter(Boolean).join(" ") || "Imported Consultant",
    email: clean(row.email),
    phone: clean(row.phone),
    skills: array(row.specialization),
    title: clean(row.company),
    location: clean(row.location),
    rate_per_hour: number(row.rate_min) ?? number(row.rate_max),
    availability: clean(row.availability),
    status: clean(row.availability) === "available" ? "available" : "on_project",
    linkedin_url: clean(row.linkedin_url),
    notes: legacyNotes(row, row.notes),
    created_by: clean(row.created_by),
    created_at: timestamp(row.created_date),
    updated_at: timestamp(row.updated_date),
  }));
  if (!consultantsState.complete) {
    const insertedConsultants = await insertRows("consultants", consultants);
    missingConsultantRows.forEach((row, index) => oldToNew.consultants.set(row.id, insertedConsultants[index].id));
    console.log(`consultants: ${insertedConsultants.length}`);
  }

  const submissionRows = loadExport("Submission");
  const submissionOldToNew = new Map();
  const submissionsState = await seedMapFromExisting("submissions", "submission_notes", submissionRows, submissionOldToNew);
  const missingSubmissionRows = submissionRows.filter((row) => !submissionOldToNew.has(row.id));
  const submissions = missingSubmissionRows.map((row) => compact({
    job_id: oldToNew.jobs.get(row.job_id) || oldToNew.jobs.get(row.relatedRequirementId) || null,
    candidate_id: oldToNew.candidates.get(row.candidate_id) || oldToNew.consultants.get(row.consultantId) || null,
    company_id: null,
    status: submissionStatus(row),
    submitted_at: timestamp(row.submitted_date) || timestamp(row.submissionDate) || timestamp(row.created_date),
    submitted_by: clean(row.created_by),
    contact_name: clean(row.client) || clean(row.vendorName),
    submission_notes: legacyNotes(row, clean(row.notes) || clean(row.comments)),
    client_feedback: clean(row.client_feedback),
    bill_rate: number(row.rate),
    created_by: clean(row.created_by),
    created_at: timestamp(row.created_date),
    updated_at: timestamp(row.updated_date),
  }));
  if (!submissionsState.complete) {
    const insertedSubmissions = await insertRows("submissions", submissions);
    missingSubmissionRows.forEach((row, index) => submissionOldToNew.set(row.id, insertedSubmissions[index].id));
    console.log(`submissions: ${insertedSubmissions.length}`);
  }

  const taskRows = loadExport("Task");
  if (await countRows("tasks")) {
    throw new Error("tasks already has rows. Stop here to avoid duplicate tasks.");
  }
  const tasks = taskRows.map((row) => compact({
    title: clean(row.title) || "Imported Task",
    description: clean(row.description) || clean(row.completion_notes),
    status: taskStatus(row),
    priority: priority(row),
    due_date: date(row.due_date),
    assigned_to: clean(row.assigned_to),
    related_entity_type: clean(row.related_entity),
    related_entity_id: submissionOldToNew.get(row.related_id) || oldToNew.candidates.get(row.related_id) || oldToNew.jobs.get(row.related_id) || null,
    entity_type: clean(row.related_entity),
    entity_id: submissionOldToNew.get(row.related_id) || oldToNew.candidates.get(row.related_id) || oldToNew.jobs.get(row.related_id) || null,
    tags: array(row.tags),
    created_by: clean(row.created_by),
    created_at: timestamp(row.created_date),
    updated_at: timestamp(row.updated_date),
  }));
  const insertedTasks = await insertRows("tasks", tasks);
  console.log(`tasks: ${insertedTasks.length}`);

  const timesheetRows = loadExport("Timesheet");
  if (await countRows("timesheets")) {
    throw new Error("timesheets already has rows. Stop here to avoid duplicate timesheets.");
  }
  const timesheets = timesheetRows.map((row) => {
    const start = date(row.date);
    return compact({
      week_start: start,
      week_end: weekEndFrom(start),
      hours_worked: number(row.hours) || 0,
      status: clean(row.status) === "approved" ? "approved" : "submitted",
      notes: legacyNotes(row, row.notes),
      submitted_by: clean(row.user_id) || clean(row.created_by),
      created_by: clean(row.created_by),
      created_at: timestamp(row.created_date),
      updated_at: timestamp(row.updated_date),
    });
  });
  const insertedTimesheets = await insertRows("timesheets", timesheets);
  console.log(`timesheets: ${insertedTimesheets.length}`);

  console.log("Import complete.");
  console.log("Role_export.csv was not imported because the live schema has no roles table.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
