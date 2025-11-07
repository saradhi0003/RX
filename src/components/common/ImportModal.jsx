
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, X, AlertTriangle, Sparkles, RefreshCw, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { sendAppEmail } from "@/components/utils/email";
import { User } from "@/entities/User";

function normalizeKey(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Lightweight CSV/TSV parser with quotes support
function parseCSV(text) {
  let delimiter = ",";
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\t")) {
      if (delimiter === "," && ch === "\t") delimiter = "\t";
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => (h || "").toString().trim());
  const data = rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = r[idx] ?? ""));
    return obj;
  });
  return data;
}

// AI-powered smart mapping
async function aiSuggestMapping(srcKeys, tgtProps, sampleData) {
  try {
    const targetFields = Object.entries(tgtProps || {}).map(([key, prop]) => ({
      field_name: key,
      type: prop.type,
      description: prop.description || "",
      enum_values: prop.enum || [],
      required: false
    }));

    const sourceColumns = srcKeys.map(key => ({
      column_name: key,
      sample_values: sampleData
        .slice(0, 3)
        .map(row => row[key])
        .filter(v => v && String(v).trim())
    }));

    const prompt = `You are an intelligent data mapping assistant. Analyze the CSV column names and their sample data, then map them to the appropriate target database fields.

**Target Database Fields:**
${JSON.stringify(targetFields, null, 2)}

**Source CSV Columns:**
${JSON.stringify(sourceColumns, null, 2)}

**Your Task:**
For each source column, determine:
1. The most appropriate target field to map to (or null if no good match)
2. A confidence score (0-100) indicating how confident you are in this mapping
3. The reasoning behind your decision

**Mapping Rules:**
- Look for semantic similarity, not just string matching
- Consider sample data to understand column content
- "First Name" or "fname" → first_name
- "Email Address" or "email" → email  
- "Phone" or "mobile" → phone
- "Job Title" or "position" → current_title
- "Company" → current_company
- "Skills" (comma-separated) → skills (array)
- "Years Experience" or "yoe" → experience_years
- Consider data types (number fields shouldn't map to string columns)
- If no clear match exists, suggest null

Return a JSON array of mappings in this exact format:
{
  "mappings": [
    {
      "source_column": "column name",
      "target_field": "field_name or null",
      "confidence": 95,
      "reasoning": "brief explanation"
    }
  ]
}`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          mappings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source_column: { type: "string" },
                target_field: { type: "string" },
                confidence: { type: "number" },
                reasoning: { type: "string" }
              }
            }
          }
        }
      }
    });

    const mappingObj = {};
    const confidenceObj = {};
    const reasoningObj = {};

    (response.mappings || []).forEach(m => {
      if (m.target_field && m.target_field !== "null") {
        mappingObj[m.source_column] = m.target_field;
        confidenceObj[m.source_column] = m.confidence || 0;
        reasoningObj[m.source_column] = m.reasoning || "";
      }
    });

    return { mapping: mappingObj, confidence: confidenceObj, reasoning: reasoningObj };
  } catch (error) {
    console.error("AI mapping failed:", error);
    // Fallback to basic normalization
    return { 
      mapping: suggestMapping(srcKeys, tgtProps), 
      confidence: {}, 
      reasoning: {} 
    };
  }
}

function suggestMapping(srcKeys, tgtProps) {
  const tgtKeys = Object.keys(tgtProps || {});
  const tgtNorm = Object.fromEntries(tgtKeys.map((k) => [normalizeKey(k), k]));
  const m = {};
  srcKeys.forEach((src) => {
    const nn = normalizeKey(src);
    if (tgtNorm[nn]) {
      m[src] = tgtNorm[nn];
      return;
    }
    const partial = tgtKeys.find(
      (tk) => normalizeKey(tk).includes(nn) || nn.includes(normalizeKey(tk))
    );
    if (partial) m[src] = partial;
  });
  return m;
}

async function withTimeout(p, ms) {
  let t;
  const to = new Promise((_, rej) => (t = setTimeout(() => rej(new Error("Processing timed out")), ms)));
  try {
    const res = await Promise.race([p, to]);
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function toContacts(input) {
  if (Array.isArray(input)) {
    return input.flatMap((v) => toContacts(v) || []);
  }
  const s = String(input ?? "").trim();
  if (!s) return [];
  const parts = s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  const emailRegex = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i;
  const phoneRegex = /(\+?\d[\d\-\s().]{6,}\d)/;

  parts.forEach((p) => {
    const emailMatch = p.match(emailRegex);
    const phoneMatch = p.match(phoneRegex);
    const email = emailMatch ? emailMatch[1].trim() : undefined;
    const phone = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, "") : undefined;

    const angle = p.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (angle) {
      out.push({ name: angle[1].trim() || undefined, email: angle[2].trim(), phone });
      return;
    }
    if (email) {
      const name = p.replace(email, "").replace(/[<>\-–—|]/g, "").trim();
      out.push({ email, name: name || undefined, phone });
    } else {
      out.push({ name: p, phone });
    }
  });

  const seen = new Set();
  const dedup = [];
  for (const c of out) {
    const key = c.email ? c.email.toLowerCase() : `${c.name || ""}|${c.phone || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(c);
  }
  return dedup;
}

// CSV builder for emailing duplicates
function toCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "no,rows\n";
  const keysSet = new Set();
  rows.forEach((r) => {
    if (r && typeof r === "object") Object.keys(r).forEach((k) => keysSet.add(k));
  });
  const keys = Array.from(keysSet);
  const esc = (v) => {
    const s =
      v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    const needsQuotes = /[",\n]/.test(s);
    return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map(esc).join(",");
  const lines = rows.map((r) => keys.map((k) => esc(r?.[k])).join(","));
  return [header, ...lines].join("\n");
}

// chunking helper
function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

export default function ImportModal({ open, onClose, entityName, entitySdk, onImported }) {
  const [fileName, setFileName] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [preview, setPreview] = React.useState([]);
  const [mapping, setMapping] = React.useState({});
  const [confidence, setConfidence] = React.useState({});
  const [reasoning, setReasoning] = React.useState({});
  const [step, setStep] = React.useState("ready"); // ready | mapping | inserting | done
  const [error, setError] = React.useState("");
  const [hint, setHint] = React.useState("");
  const [inserted, setInserted] = React.useState(0);
  const [skipped, setSkipped] = React.useState(0);
  const [aiMapping, setAiMapping] = React.useState(false);

  const [tab, setTab] = React.useState("all"); // all | mapped | unmapped | high_confidence
  const [q, setQ] = React.useState("");

  const fileInputRef = React.useRef(null);
  const longRunRef = React.useRef(false);
  const [myEmail, setMyEmail] = React.useState(""); // current user email

  // load current user email to use as recipient for emails
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await User.me();
        if (mounted && me?.email) setMyEmail(me.email);
      } catch (e) {
        console.warn("ImportModal: unable to fetch current user email, emails will be skipped.");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const schema = React.useMemo(
    () => (typeof entitySdk.schema === "function" ? entitySdk.schema() : {}),
    [entitySdk]
  );
  const schemaProps = schema.properties || {};

  const reset = () => {
    setFileName("");
    setUploading(false);
    setParsing(false);
    setPreview([]);
    setMapping({});
    setConfidence({});
    setReasoning({});
    setStep("ready");
    setError("");
    setHint("");
    setInserted(0);
    setSkipped(0);
    setAiMapping(false);
    onClose?.();
  };

  const setMapDefaults = async (rows) => {
    const sample = rows[0] || {};
    const srcKeys = Object.keys(sample);
    
    // Use AI mapping for smart suggestions
    setAiMapping(true);
    setHint("🤖 AI is analyzing your columns and suggesting intelligent mappings...");
    
    try {
      const { mapping: aiMap, confidence: aiConf, reasoning: aiReas } = await aiSuggestMapping(
        srcKeys, 
        schemaProps, 
        rows.slice(0, 5)
      );
      
      // Ensure no duplicate mappings (one CSV column → one target field only)
      const cleanedMapping = {};
      const usedTargetFields = new Set();
      
      // Sort by confidence to prioritize high-confidence mappings
      const sortedEntries = Object.entries(aiMap).sort((a, b) => {
        const confA = aiConf[a[0]] || 0;
        const confB = aiConf[b[0]] || 0;
        return confB - confA;
      });
      
      for (const [srcCol, targetField] of sortedEntries) {
        if (targetField && targetField !== "null" && !usedTargetFields.has(targetField)) {
          cleanedMapping[srcCol] = targetField;
          usedTargetFields.add(targetField);
        }
      }
      
      setMapping(cleanedMapping);
      setConfidence(aiConf);
      setReasoning(aiReas);
      setHint("✨ AI mapping complete! Review and adjust mappings below.");
    } catch (err) {
      console.error("AI mapping error:", err);
      setMapping(suggestMapping(srcKeys, schemaProps));
      setHint("⚠️ AI mapping failed, using basic matching. You can manually adjust mappings.");
    } finally {
      setAiMapping(false);
    }
  };

  const localCSVImport = async (file) => {
    setParsing(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        setError("No rows detected in CSV/TSV.");
        setParsing(false);
        return;
      }
      setPreview(rows.slice(0, 500));
      await setMapDefaults(rows);
      setStep("mapping");
    } catch (e) {
      setError(e?.message || "Failed to parse file locally.");
    } finally {
      setParsing(false);
    }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setHint("");
    setFileName(f.name);

    const isDelimited =
      /\.csv$/i.test(f.name) || /\.tsv$/i.test(f.name) || f.type === "text/csv";
    if (isDelimited) {
      await localCSVImport(f);
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setUploading(false);
      setParsing(true);

      const res = await withTimeout(
        base44.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: schema }),
        25000
      );

      if (res.status !== "success" || !res.output) {
        setError(res.details || "Could not extract data from file.");
        setParsing(false);
        return;
      }

      const rows = Array.isArray(res.output) ? res.output : [res.output];
      setPreview(rows.slice(0, 500));
      await setMapDefaults(rows);
      setStep("mapping");
    } catch (err) {
      setError(err?.message || "Import failed.");
      setHint("Tip: Try exporting to CSV and re-upload.");
    } finally {
      setParsing(false);
    }
  };

  const sourceColumns = React.useMemo(() => Object.keys(preview[0] || {}), [preview]);

  const sampleFor = React.useCallback(
    (col) => {
      for (let i = 0; i < preview.length; i++) {
        const v = preview[i]?.[col];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return "";
    },
    [preview]
  );

  const filteredColumns = React.useMemo(() => {
    const qq = q.toLowerCase();
    return sourceColumns.filter((c) => {
      const mapped = !!mapping[c];
      const conf = confidence[c] || 0;
      
      let byTab = true;
      if (tab === "mapped") byTab = mapped;
      else if (tab === "unmapped") byTab = !mapped;
      else if (tab === "high_confidence") byTab = mapped && conf >= 80;
      
      const smpl = String(sampleFor(c) ?? "").toLowerCase();
      const bySearch = !qq || c.toLowerCase().includes(qq) || smpl.includes(qq);
      return byTab && bySearch;
    });
  }, [sourceColumns, mapping, confidence, tab, q, sampleFor]);

  const mappedCount = React.useMemo(
    () => Object.values(mapping).filter(Boolean).length,
    [mapping]
  );
  
  const highConfidenceCount = React.useMemo(
    () => Object.entries(confidence).filter(([k, v]) => mapping[k] && v >= 80).length,
    [confidence, mapping]
  );

  const busy = uploading || parsing || aiMapping;

  // Type coercion helpers + row shaping
  const applyMapping = (rows, map, schemaObj) => {
    const props = schemaObj.properties || {};

    const toBool = (v) => {
      if (typeof v === "boolean") return v;
      const s = String(v ?? "").trim().toLowerCase();
      if (!s) return undefined;
      if (["true", "1", "yes", "y", "t"].includes(s)) return true;
      if (["false", "0", "no", "n", "f"].includes(s)) return false;
      return undefined;
    };
    const toNum = (v) => {
      if (v === null || v === undefined || String(v).trim() === "") return undefined;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    };
    const toArr = (v) => {
      if (Array.isArray(v)) return v;
      const s = String(v ?? "").trim();
      if (!s) return undefined;
      return s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    };
    const coerce = (raw, prop) => {
      if (!prop) return raw;
      const t = prop.type;
      if (t === "boolean") return toBool(raw);
      if (t === "number" || t === "integer") return toNum(raw);
      if (t === "array") {
        if (prop.items && prop.items.type === "object") {
          const arr = Array.isArray(raw) ? raw : [raw];
          const objs = arr.flatMap((val) => toContacts(val));
          return objs.length ? objs : undefined;
        }
        return toArr(raw);
      }
      if (t === "string") {
        const s = String(raw ?? "").trim();
        return s === "" ? undefined : s;
      }
      if (t === "object") return raw && typeof raw === "object" ? raw : undefined;
      return raw;
    };

    // Normalize Company payload
    const normalizeCompanyPayload = (obj) => {
      if (typeof obj.status === "string") {
        const s = obj.status.toLowerCase();
        const statusMap = {
          new: "prospect",
          prospect: "prospect",
          active: "active",
          open: "active",
          inactive: "inactive",
          closed: "inactive",
        };
        obj.status = statusMap[s] || "prospect";
      }
      if (typeof obj.type === "string") {
        const s = obj.type.toLowerCase();
        const typeMap = {
          lead: "client",
          client: "client",
          vendor: "client",
          internal: "internal",
        };
        obj.type = typeMap[s] || "client";
      }
      if (Array.isArray(obj.contacts)) {
        let contacts = [];
        obj.contacts.forEach((c) => {
          if (typeof c === "string") contacts = contacts.concat(toContacts(c));
          else if (c && typeof c === "object") contacts.push(c);
        });
        const seen = new Set();
        const dedup = [];
        for (const c of contacts) {
          const key = c.email ? c.email.toLowerCase() : `${c.name || ""}|${c.phone || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          dedup.push(c);
        }
        if (dedup.length) {
          if (!dedup.some((c) => c.is_primary)) dedup[0].is_primary = true;
        } else if (obj.primary_phone || obj.secondary_phone) {
          dedup.push({
            name: obj.primary_contact_last_name || "Primary Contact",
            phone: obj.primary_phone || "",
            is_primary: true,
          });
          if (obj.secondary_phone)
            dedup.push({ name: "Secondary Contact", phone: obj.secondary_phone });
        }
        if (obj.primary_phone) {
          const p = dedup.find((c) => c.is_primary) || dedup[0];
          if (p) p.phone = p.phone || obj.primary_phone;
        }
        if (obj.secondary_phone) {
          const s = dedup.find((c) => !c.is_primary && c.phone) ||
            dedup.find((c) => !c.is_primary) ||
            dedup[1] ||
            null;
          if (s) s.phone = s.phone || obj.secondary_phone;
          else dedup.push({ name: "Secondary Contact", phone: obj.secondary_phone });
        }
        if (obj.primary_contact_last_name) {
          const p = dedup.find((c) => c.is_primary) || dedup[0];
          if (p) {
            const hasLast = (p.name || "").trim().split(/\s+/).length > 1;
            if (!hasLast)
              p.name = [p.name || "", obj.primary_contact_last_name].filter(Boolean).join(" ").trim();
          }
        }
        obj.contacts = dedup;
      } else {
        const contacts = [];
        if (obj.primary_phone) {
          contacts.push({
            name: obj.primary_contact_last_name || "Primary Contact",
            phone: obj.primary_phone,
            is_primary: true,
          });
        }
        if (obj.secondary_phone) {
          contacts.push({ name: "Secondary Contact", phone: obj.secondary_phone, is_primary: false });
        }
        if (contacts.length) obj.contacts = contacts;
      }
      return obj;
    };

    const out = [];
    let skippedLocal = 0;

    rows.forEach((r) => {
      const obj = {};
      Object.entries(map).forEach(([src, tgt]) => {
        if (!tgt || !props[tgt]) return;
        const v = coerce(r[src], props[tgt]);
        if (v === undefined) return;
        if (Array.isArray(v) && Array.isArray(obj[tgt])) {
          obj[tgt] = [...obj[tgt], ...v];
        } else {
          obj[tgt] = v;
        }
      });

      if ((props.first_name || props.last_name) && !obj.last_name && typeof obj.first_name === "string" && obj.first_name.includes(" ")) {
        const parts = obj.first_name.trim().split(/\s+/);
        const ln = parts.pop();
        const fn = parts.join(" ");
        obj.first_name = fn || obj.first_name;
        obj.last_name = ln;
      }

      if (props.contacts || props.status || props.type) {
        normalizeCompanyPayload(obj);
      }

      Object.keys(obj).forEach((k) => {
        if (obj[k] === "" || obj[k] === null) delete obj[k];
      });

      const requiredFields = Array.isArray(schema.required) ? schema.required : [];
      const ok = requiredFields.every((f) => obj[f] !== undefined && obj[f] !== "");
      if (ok) out.push(obj);
      else skippedLocal += 1;
    });

    return { rows: out, skipped: skippedLocal };
  };

  const dedupeRows = (rows) => {
    const props = schema.properties || {};
    const isCandidate = !!props.email && !!props.first_name;
    const isJob = !!props.title && !!props.company_id;
    const isCompany = !!props.name && !!props.contacts;

    const keyFor = (r) => {
      if (isCandidate) {
        const email = String(r.email || "").trim().toLowerCase();
        if (email) return `candidate_email:${email}`;
        const firstName = String(r.first_name || "").trim().toLowerCase();
        const lastName = String(r.last_name || "").trim().toLowerCase();
        return `candidate_name:${firstName}|${lastName}`;
      }
      if (isJob) {
        const title = String(r.title || "").trim().toLowerCase();
        const comp = String(r.company_id || "").trim().toLowerCase();
        const loc = String(r.location || "").trim().toLowerCase();
        return `job:${title}|${comp}|${loc}`;
      }
      if (isCompany) {
        const name = String(r.name || "").trim().toLowerCase();
        return `company:${name}`;
      }
      return JSON.stringify(r);
    };

    const seen = new Set();
    const unique = [];
    const duplicates = [];
    for (const r of rows) {
      const k = keyFor(r);
      if (!k || k === "{}") {
        unique.push(r);
        continue;
      }
      if (seen.has(k)) {
        duplicates.push(r);
      } else {
        seen.add(k);
        unique.push(r);
      }
    }
    return { unique, duplicates };
  };

  const doInsert = async () => {
    setStep("inserting");
    setError("");
    longRunRef.current = false;
    const lrTimer = setTimeout(() => {
      longRunRef.current = true;
      setHint("Import is taking longer. You will receive an email when the process completes.");
    }, 4000);

    try {
      const { rows, skipped: skippedFromRequired } = applyMapping(preview, mapping, schema);
      let rowsToInsert = rows;
      let skippedUnmatchedCompanies = 0;

      const schemaPropsLocal = schema.properties || {};
      const isJob = !!schemaPropsLocal.company_id && !!schemaPropsLocal.title;

      if (isJob) {
        const companies = await base44.entities.Company.list();
        const idSet = new Set(companies.map((c) => c.id));
        const nameMap = new Map(
          companies.map((c) => [String(c.name || "").trim().toLowerCase(), c.id])
        );
        const defaultName = "TalentStack";
        let defaultCompanyId =
          nameMap.get(defaultName.toLowerCase()) || nameMap.get("talent stack");
        if (!defaultCompanyId) {
          const created = await base44.entities.Company.create({ name: defaultName, status: "prospect" });
          defaultCompanyId = created.id;
          nameMap.set(defaultName.toLowerCase(), created.id);
          idSet.add(created.id);
        }
        rowsToInsert = rows.map((r) => {
          let cid = r.company_id;
          if (!cid) return { ...r, company_id: defaultCompanyId };
          const val = String(cid).trim();
          if (idSet.has(val)) return r;
          const byName = nameMap.get(val.toLowerCase());
          if (byName) return { ...r, company_id: byName };
          return { ...r, company_id: defaultCompanyId };
        });
      } else if (rows.some((r) => typeof r.company_id === "string" && r.company_id)) {
        const companies = await base44.entities.Company.list();
        const idSet = new Set(companies.map((c) => c.id));
        const nameMap = new Map(
          companies.map((c) => [String(c.name || "").trim().toLowerCase(), c.id])
        );
        rowsToInsert = rows.map((r) => {
          if (!r.company_id) return r;
          const val = String(r.company_id).trim();
          if (idSet.has(val)) return r;
          const id = nameMap.get(val.toLowerCase());
          if (id) return { ...r, company_id: id };
          return { ...r, company_id: undefined, "__invalid_company__": val };
        });
        const valid = [];
        for (const r of rowsToInsert) {
          if (r.company_id) valid.push(r);
          else skippedUnmatchedCompanies += 1;
        }
        rowsToInsert = valid;
      }

      const { unique, duplicates } = dedupeRows(rowsToInsert);
      rowsToInsert = unique;

      if (!rowsToInsert.length && duplicates.length === 0) {
        clearTimeout(lrTimer);
        setError("Nothing to upload. Map at least one column and ensure required fields are present.");
        setStep("mapping");
        return;
      }

      if (!rowsToInsert.length && duplicates.length > 0) {
        clearTimeout(lrTimer);
        setError("All rows were duplicates or invalid. Nothing to upload.");
        setSkipped((skippedFromRequired || 0) + (skippedUnmatchedCompanies || 0) + duplicates.length);
        try {
          const csv = toCSV(duplicates);
          const dupFile = new File([csv], "duplicates.csv", { type: "text/csv" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file: dupFile });
          if (myEmail) {
            await sendAppEmail({
              to: myEmail,
              subject: `Import duplicates for ${entityName || "records"}`,
              body: `We skipped ${duplicates.length} duplicate ${entityName?.toLowerCase() || "records"}.\nDownload CSV: ${file_url}`,
            });
          } else {
            console.warn("ImportModal: No recipient email available for duplicates email.");
          }
        } catch (e) {
          console.warn("Failed to email duplicates CSV:", e);
        }
        setStep("done");
        return;
      }

      const chunks = chunk(rowsToInsert, 500);
      let totalInserted = 0;
      for (let i = 0; i < chunks.length; i++) {
        const created = await entitySdk.bulkCreate(chunks[i]);
        const inc = Array.isArray(created) ? created.length : chunks[i].length;
        totalInserted += inc;
        setInserted(totalInserted);
      }

      setSkipped(
        (skippedFromRequired || 0) + (skippedUnmatchedCompanies || 0) + (duplicates?.length || 0)
      );

      let dupUrl = null;
      if (duplicates && duplicates.length) {
        try {
          const csv = toCSV(duplicates);
          const dupFile = new File([csv], "duplicates.csv", { type: "text/csv" });
          const { file_url } = await base44.integrations.Core.UploadFile({ file: dupFile });
          dupUrl = file_url;
          if (myEmail) {
            await sendAppEmail({
              to: myEmail,
              subject: `Import duplicates for ${entityName || "records"}`,
              body: `We skipped ${duplicates.length} duplicate ${entityName?.toLowerCase() || "records"}.\nDownload CSV: ${file_url}`,
            });
          } else {
            console.warn("ImportModal: No recipient email available for duplicates email.");
          }
        } catch (e) {
          console.warn("Failed to upload/email duplicates CSV:", e);
        }
      }

      clearTimeout(lrTimer);
      if (longRunRef.current) {
        try {
          if (myEmail) {
            await sendAppEmail({
              to: myEmail,
              subject: `Import completed: ${entityName || "records"}`,
              body: `Your import has completed.\nInserted: ${totalInserted}\nSkipped: ${(
                (skippedFromRequired || 0) + (skippedUnmatchedCompanies || 0) + (duplicates?.length || 0)
              )}\n${dupUrl ? `Duplicates CSV: ${dupUrl}` : ""}`,
            });
          } else {
            console.warn("ImportModal: No recipient email available for completion email.");
          }
          setHint("");
        } catch (e) {
          console.warn("Failed to send completion email:", e);
        }
      }

      setStep("done");
      onImported?.(null);
    } catch (e) {
      clearTimeout(lrTimer);
      setError(e?.message || "Upload failed");
      setStep("mapping");
    }
  };

  const retryAiMapping = async () => {
    if (preview.length === 0) return;
    await setMapDefaults(preview);
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 90) return "bg-green-100 text-green-800 border-green-300";
    if (conf >= 70) return "bg-blue-100 text-blue-800 border-blue-300";
    if (conf >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  // Track which target fields are already mapped to prevent duplicates
  const mappedTargetFields = React.useMemo(() => {
    return new Set(Object.values(mapping).filter(Boolean));
  }, [mapping]);

  // Handler to update mapping with duplicate prevention
  const handleMappingChange = (sourceCol, newTargetField) => {
    const newMapping = { ...mapping };
    
    // Get the currently mapped target field for this source column
    const oldTargetFieldForSource = newMapping[sourceCol];
    
    // If the user is unmapping the current source column (setting to null/empty)
    if (!newTargetField || newTargetField === "null") {
      delete newMapping[sourceCol]; // Remove the mapping for this source column
      setMapping(newMapping);
      return;
    }

    // Check if this new target field is already mapped by another source column
    // and if that other source column is NOT the current one being changed
    const existingSourceForTarget = Object.entries(newMapping).find(
      ([src, tgt]) => tgt === newTargetField && src !== sourceCol
    );
    
    if (existingSourceForTarget) {
      // Prompt user for confirmation to replace existing mapping
      const shouldReplace = window.confirm(
        `The field "${newTargetField}" is already mapped from CSV column "${existingSourceForTarget[0]}".\n\n` +
        `Do you want to map CSV column "${sourceCol}" to "${newTargetField}" instead and unmap "${existingSourceForTarget[0]}"?`
      );
      
      if (shouldReplace) {
        // Remove the old mapping from the conflicting source column
        delete newMapping[existingSourceForTarget[0]];
        // Apply the new mapping for the current source column
        newMapping[sourceCol] = newTargetField;
      } else {
        // User cancelled, keep the existing mapping as it was.
        // If there was an old mapping for 'sourceCol', ensure it's preserved.
        if (oldTargetFieldForSource) {
          newMapping[sourceCol] = oldTargetFieldForSource;
        } else {
          // If there was no previous mapping, just don't add the new one.
          delete newMapping[sourceCol];
        }
      }
    } else {
      // No conflict, or user confirmed replacement, apply the new mapping
      newMapping[sourceCol] = newTargetField;
    }
    
    setMapping(newMapping);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6 overflow-y-auto"
      onClick={reset}
    >
      <Card
        className="w-full max-w-6xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white z-10 border-b">
          <div className="flex items-center gap-3">
            <CardTitle>Import {entityName} with AI Field Mapping</CardTitle>
            {aiMapping && (
              <Badge className="bg-purple-100 text-purple-800 animate-pulse">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Mapping...
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "mapping" && preview.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={retryAiMapping}
                  disabled={aiMapping}
                  className="gap-2"
                  title="Retry AI mapping"
                >
                  <RefreshCw className={`w-4 h-4 ${aiMapping ? 'animate-spin' : ''}`} />
                  Re-map with AI
                </Button>
                <Button
                  onClick={doInsert}
                  disabled={mappedCount === 0 || busy}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  title={mappedCount === 0 ? "Map at least one column to enable upload" : "Upload mapped rows"}
                >
                  <Upload className="w-4 h-4" />
                  Upload {mappedCount > 0 ? `(${mappedCount} mapped)` : ''}
                </Button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onFile}
              accept=".csv,.tsv,.xls,.xlsx,.pdf,.png,.jpg,.jpeg"
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
              {fileName ? "Change File" : "Upload"}
            </Button>
            <Button variant="ghost" size="icon" onClick={reset} className="text-red-600 hover:text-red-700">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="p-4 space-y-4">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">
                {busy
                  ? "Processing..."
                  : step === "mapping"
                  ? "Map Columns"
                  : step === "inserting"
                  ? "Uploading…"
                  : inserted > 0
                  ? "Completed"
                  : "Ready"}
              </Badge>
              {fileName && <span className="text-slate-600 truncate">File: {fileName}</span>}
              {mappedCount > 0 && step === "mapping" && (
                <Badge className="bg-blue-100 text-blue-800">
                  {mappedCount}/{sourceColumns.length} mapped
                </Badge>
              )}
              {highConfidenceCount > 0 && step === "mapping" && (
                <Badge className="bg-green-100 text-green-800">
                  <Check className="w-3 h-3 mr-1" />
                  {highConfidenceCount} high confidence
                </Badge>
              )}
              {inserted > 0 && (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="w-4 h-4" /> Inserted {inserted}
                </span>
              )}
              {skipped > 0 && <span className="text-amber-700">• Skipped {skipped}</span>}
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}

            {/* Hint display */}
            {hint && (
              <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded p-3">
                {hint}
              </div>
            )}

            {/* Ready state - file upload */}
            {step === "ready" && (
              <div className="border-2 border-dashed rounded-lg p-8 bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-slate-900 mb-2">
                      AI-Powered Smart Import
                    </p>
                    <p className="text-sm text-slate-600 mb-4">
                      Upload your CSV and our AI will automatically map columns to the correct fields
                    </p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    <Upload className="w-4 h-4" />
                    Choose File to Import
                  </Button>
                  <div className="text-xs text-slate-500">
                    Supports CSV, TSV, Excel, PDF, and image files
                  </div>
                </div>
              </div>
            )}

            {/* Mapping state - column mapping table */}
            {step === "mapping" && preview.length > 0 && (
              <div className="space-y-3">
                {/* Filter tabs and info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Mapping Review
                    </Badge>
                    <span className="text-sm text-slate-600">
                      Review AI suggestions and adjust if needed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={tab === "all" ? "default" : "outline"}
                      onClick={() => setTab("all")}
                    >
                      All ({sourceColumns.length})
                    </Button>
                    <Button
                      size="sm"
                      variant={tab === "mapped" ? "default" : "outline"}
                      onClick={() => setTab("mapped")}
                    >
                      Mapped ({mappedCount})
                    </Button>
                    <Button
                      size="sm"
                      variant={tab === "unmapped" ? "default" : "outline"}
                      onClick={() => setTab("unmapped")}
                    >
                      Unmapped ({sourceColumns.length - mappedCount})
                    </Button>
                    <Button
                      size="sm"
                      variant={tab === "high_confidence" ? "default" : "outline"}
                      onClick={() => setTab("high_confidence")}
                      className="gap-1"
                    >
                      <Check className="w-3 h-3" />
                      High Confidence ({highConfidenceCount})
                    </Button>
                  </div>
                </div>

                {/* Search */}
                <Input 
                  placeholder="Search columns or sample data..." 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)}
                  className="max-w-md"
                />

                {/* Mapping table */}
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  <div className="overflow-auto max-h-[55vh]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[20%]">CSV Column</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[20%]">Sample Data</th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[35%]">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-purple-600" />
                              AI Suggested Field
                            </div>
                          </th>
                          <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[25%]">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredColumns.map((col) => {
                          const conf = confidence[col] || 0;
                          const reason = reasoning[col] || "";
                          const mappedField = mapping[col];
                          const isHighConfidence = conf >= 80 && mappedField;
                          
                          return (
                            <tr key={col} className="border-t hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {col}
                              </td>
                              <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">
                                {String(sampleFor(col) ?? "")}
                              </td>
                              <td className="px-4 py-3">
                                <Select
                                  value={mappedField || ""}
                                  onValueChange={(v) => handleMappingChange(col, v)}
                                >
                                  <SelectTrigger className={`w-full ${mappedField ? 'border-green-300 bg-green-50' : ''}`}>
                                    <SelectValue placeholder="— Select field or ignore —">
                                      {mappedField ? (
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{mappedField}</span>
                                          {isHighConfidence && (
                                            <Badge className="text-xs bg-green-100 text-green-800 border-green-300">
                                              ✓ AI Match
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        "— Select field or ignore —"
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.keys(schemaProps).map((k) => {
                                      const isAlreadyMapped = mappedTargetFields.has(k) && mapping[col] !== k;
                                      const mappedFrom = isAlreadyMapped 
                                        ? Object.entries(mapping).find(([src, tgt]) => tgt === k)?.[0]
                                        : null;
                                      
                                      return (
                                        <SelectItem key={k} value={k} disabled={isAlreadyMapped}>
                                          <div className="flex items-center gap-2">
                                            <span className={isAlreadyMapped ? "text-slate-400" : ""}>{k}</span>
                                            {isAlreadyMapped && mappedFrom && (
                                              <span className="text-xs text-orange-600">(mapped from {mappedFrom})</span>
                                            )}
                                            {mappedField === k && conf >= 80 && (
                                              <Badge className="text-xs bg-green-100 text-green-800">
                                                AI Match
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                    <SelectItem value={"null"}>
                                      <span className="text-slate-400">— Ignore Column —</span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {reason && (
                                  <p className="text-xs text-slate-500 mt-1 italic">
                                    💡 {reason}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {mappedField && conf > 0 ? (
                                  <Badge className={getConfidenceColor(conf)}>
                                    {conf}% confident
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-400">No mapping</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredColumns.length === 0 && (
                          <tr>
                            <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                              No columns match your filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer with actions */}
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t sticky bottom-0">
                    <div className="text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>
                          Mapped {mappedCount}/{sourceColumns.length} columns
                          {highConfidenceCount > 0 && ` • ${highConfidenceCount} high confidence matches`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={reset}>Cancel</Button>
                      <Button 
                        onClick={doInsert} 
                        disabled={mappedCount === 0 || busy} 
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Upload className="w-4 h-4" />
                        Import {preview.length} Rows
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inserting state */}
            {step === "inserting" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-700">Uploading records...</p>
              </div>
            )}

            {/* Done state */}
            {step === "done" && (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-700 mb-2">Import completed!</p>
                  <p className="text-sm text-slate-600">
                    Inserted {inserted} {entityName?.toLowerCase() || "records"}
                    {skipped ? `, skipped ${skipped}` : ""}
                  </p>
                </div>
                <Button onClick={reset}>Close</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
