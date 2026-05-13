import React, { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Candidate } from "@/entities/Candidate";
import { Job } from "@/entities/Job";
import { Resume } from "@/entities/Resume";
import * as Core from "@/integrations/Core";
import { invokeLLMJson } from "@/lib/llm";
import ResumeFormLeft from "../components/resume/ResumeFormLeft";
import ResumePreview from "../components/resume/ResumePreview";
import ResumeLLMBuilder from "../components/resume/ResumeLLMBuilder";
import {
  AlertCircle, Brain, CheckCircle, Download, FileText,
  Loader2, Save, Sparkles, Target, TrendingUp, Upload, X, Zap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Score ring SVG gauge ─────────────────────────────────────────────────────
function ScoreRing({ score, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score || 0));
  const color = pct >= 75 ? "#34C759" : pct >= 50 ? "#FF9F0A" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${(pct/100)*circ} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text
        x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: "center",
          fontSize: size * 0.24, fontWeight: 700, fill: color }}
      >
        {pct}
      </text>
    </svg>
  );
}

// ─── Keyword chip ─────────────────────────────────────────────────────────────
function SkillChip({ skill, present }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border
      ${present
        ? "bg-[#F0FFF4] border-[#34C759] text-[#1A7F3C]"
        : "bg-[#FFF5F5] border-[#EF4444] text-[#C0392B]"}`}>
      {present ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {skill}
    </span>
  );
}

// ─── ATS Score Tab ────────────────────────────────────────────────────────────
function ScoreTab() {
  const [jdText, setJdText]         = useState("");
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState(null);
  const [uploading, setUploading]   = useState({ jd: false, resume: false });

  const handleUpload = async (file, target) => {
    setUploading(u => ({ ...u, [target]: true }));
    try {
      const { url } = await Core.UploadFile({ file, bucket: "uploads" });
      const text = await Core.ExtractDataFromUploadedFile({
        file_url: url,
        extraction_prompt: "Extract all readable text from this document. Return plain text only.",
      });
      const str = typeof text === "string" ? text : JSON.stringify(text);
      if (target === "jd") setJdText(str); else setResumeText(str);
    } catch {
      /* Preserve the original file when text extraction fails */
    }
    setUploading(u => ({ ...u, [target]: false }));
  };

  const analyze = async () => {
    if (!jdText.trim() || !resumeText.trim()) return;
    setLoading(true); setResult(null);
    try {
      const raw = await invokeLLMJson({
        prompt: `You are an expert ATS resume analyst and senior recruiter.

JOB DESCRIPTION:
${jdText}

CANDIDATE RESUME:
${resumeText}

Analyze the resume against the job description. Return ONLY a valid JSON object with this exact shape:
{
  "overall_score": <integer 0-100>,
  "ats_score": <integer 0-100>,
  "sections": {
    "skills_match": <0-100>,
    "experience_relevance": <0-100>,
    "education_fit": <0-100>,
    "keyword_density": <0-100>,
    "formatting": <0-100>
  },
  "matched_keywords": [<up to 12 keywords present in both>],
  "missing_keywords": [<up to 12 important JD keywords absent from resume>],
  "strengths": [<3 specific strengths>],
  "improvements": [<3 specific actionable improvements>],
  "narrative": "<2-3 sentence honest recruiter assessment>",
  "recommendation": "strong_fit" | "good_fit" | "partial_fit" | "not_fit"
}`,
        temperature: 0.2,
        max_tokens: 1500,
      });
      setResult(raw);
    } catch { setResult({ error: true }); }
    setLoading(false);
  };

  const REC = {
    strong_fit:  { label: "Strong Fit",  cls: "bg-[#F0FFF4] border-[#34C759] text-[#1A7F3C]" },
    good_fit:    { label: "Good Fit",    cls: "bg-[#EBF3FD] border-[#9333EA] text-[#0052A3]" },
    partial_fit: { label: "Partial Fit", cls: "bg-[#FFF7ED] border-[#FF9F0A] text-[#854D0E]" },
    not_fit:     { label: "Not a Fit",   cls: "bg-[#FFF5F5] border-[#EF4444] text-[#9B1C1C]" },
  };
  const SECTION_LABELS = {
    skills_match: "Skills Match", experience_relevance: "Experience",
    education_fit: "Education", keyword_density: "Keywords", formatting: "Formatting",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── inputs ── */}
      <div className="space-y-4">
        {[
          { key: "jd", label: "Job Description", icon: Target, value: jdText, set: setJdText },
          { key: "resume", label: "Candidate Resume", icon: FileText, value: resumeText, set: setResumeText },
        ].map(({ key, label, icon: Icon, value, set }) => (
          <Card key={key} className="border border-[#E2E8F0] rounded-2xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                <Icon className="w-4 h-4 text-[#9333EA]" /> {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                className="h-44 text-sm resize-none rounded-xl border-[#E2E8F0]"
                placeholder={`Paste ${label.toLowerCase()} here…`}
                value={value} onChange={e => set(e.target.value)}
              />
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#9333EA] hover:underline w-fit">
                {uploading[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload PDF / image
                <input type="file" accept=".pdf,image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], key)} />
              </label>
            </CardContent>
          </Card>
        ))}
        <Button onClick={analyze} disabled={!jdText.trim() || !resumeText.trim() || loading}
          className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white font-medium">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Analyzing…</>
            : <><Sparkles className="w-4 h-4 mr-2" />Analyze with AI</>}
        </Button>
      </div>

      {/* ── results ── */}
      <div className="space-y-4">
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-24 text-[#8E8E93] text-center">
            <Brain className="w-12 h-12 mb-3 opacity-25" />
            <p className="text-sm">Paste a JD + resume, then hit Analyze.</p>
            <p className="text-xs mt-1">The AI will score, rank, and explain the match.</p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#9333EA] mb-3" />
            <p className="text-sm text-[#64748B]">Running LLM analysis…</p>
          </div>
        )}
        {result && !result.error && (() => {
          const rec = REC[result.recommendation];
          return (
            <>
              {/* Score card */}
              <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
                <CardContent className="pt-5 flex items-center gap-5">
                  <ScoreRing score={result.overall_score} size={108} stroke={10} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#64748B]">Overall Match Score</p>
                    <p className="text-3xl font-bold text-[#0F172A] leading-none mt-0.5">
                      {result.overall_score}<span className="text-sm font-normal text-[#64748B]">/100</span>
                    </p>
                    {rec && (
                      <span className={`mt-2 inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${rec.cls}`}>
                        {rec.label}
                      </span>
                    )}
                    <p className="text-xs text-[#64748B] mt-2 leading-relaxed line-clamp-3">{result.narrative}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Section bars */}
              <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#0F172A]">Section Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(result.sections || {}).map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-[#0F172A]">{SECTION_LABELS[k] || k}</span>
                        <span className="text-[#64748B]">{v}/100</span>
                      </div>
                      <div className="h-2 bg-[#F2F2F7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${v}%`, background: v >= 75 ? "#34C759" : v >= 50 ? "#FF9F0A" : "#EF4444" }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Keywords */}
              <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#0F172A]">Keyword Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">Found in resume</p>
                    <div className="flex flex-wrap gap-1.5">{(result.matched_keywords || []).map(k => <SkillChip key={k} skill={k} present />)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B] mb-2">Missing — add these</p>
                    <div className="flex flex-wrap gap-1.5">{(result.missing_keywords || []).map(k => <SkillChip key={k} skill={k} present={false} />)}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths / Improvements */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: "Strengths", items: result.strengths, color: "#34C759", Icon: CheckCircle },
                  { title: "Improve",   items: result.improvements, color: "#FF9F0A", Icon: AlertCircle },
                ].map(({ title, items, color, Icon }) => (
                  <Card key={title} className="border border-[#E2E8F0] rounded-2xl shadow-sm">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-semibold flex items-center gap-1" style={{ color }}>
                        <Icon className="w-3.5 h-3.5" />{title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {(items || []).map((s, i) => (
                          <li key={i} className="text-xs text-[#0F172A] flex gap-1.5">
                            <span style={{ color }} className="shrink-0">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          );
        })()}
        {result?.error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4">
            Analysis failed — check your LLM config in .env.local and retry.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skills Lab Tab ───────────────────────────────────────────────────────────
function SkillsLabTab() {
  const [jobs, setJobs]                 = useState(/** @type {any[]} */ ([]));
  const [candidates, setCandidates]     = useState(/** @type {any[]} */ ([]));
  const [selectedJob, setSelectedJob]   = useState(/** @type {any} */ (null));
  const [skillInput, setSkillInput]     = useState("");
  const [requiredSkills, setRequiredSkills] = useState(/** @type {string[]} */ ([]));
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(/** @type {any} */ (null));
  const [loadingData, setLoadingData]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [j, c] = await Promise.all([
          Job.filter({ status: "open" }, "-created_date", 30).catch(() => []),
          Candidate.list("-created_date", 50).catch(() => []),
        ]);
        setJobs(j || []); setCandidates(c || []);
      } finally { setLoadingData(false); }
    })();
  }, []);

  const selectJob = async (job) => {
    setSelectedJob(job); setResult(null);
    if (!job?.description && !job?.requirements) return;
    try {
      const text = `${job.title} ${job.description || ""} ${job.requirements || ""}`;
      const skills = await invokeLLMJson({
        prompt: `Extract the top 8 required technical skills from this job posting. Return a JSON array of skill name strings only.\n\n${text}`,
        temperature: 0.1, max_tokens: 300,
      });
      if (Array.isArray(skills)) setRequiredSkills(skills.slice(0, 8));
    } catch {
      /* Resume library refresh is best-effort */
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !requiredSkills.includes(s)) setRequiredSkills(p => [...p, s]);
    setSkillInput("");
  };

  const analyze = async () => {
    if (!requiredSkills.length || !candidates.length) return;
    setLoading(true); setResult(null);
    try {
      const summaries = candidates.slice(0, 20).map(c => ({
        id: c.id, name: c.full_name,
        skills: Array.isArray(c.skills) ? c.skills : [],
        title: c.title || "", experience_years: c.experience_years || 0,
      }));
      const raw = await invokeLLMJson({
        prompt: `You are a senior technical recruiter scoring candidates against required skills.

Required skills: ${requiredSkills.join(", ")}

Candidates (JSON):
${JSON.stringify(summaries, null, 2)}

Return ONLY a valid JSON object:
{
  "scores": [
    {
      "candidate_id": "<id>",
      "name": "<name>",
      "overall_score": <0-100>,
      "skill_scores": { "<skill>": <0-100> },
      "strengths": ["<strength 1>", "<strength 2>"],
      "gaps": ["<gap 1>", "<gap 2>"],
      "tier": "A" | "B" | "C"
    }
  ],
  "market_demand": [{ "skill": "<name>", "demand": <0-100>, "supply": <0-100> }],
  "insight": "<2-sentence insight about this talent pool>"
}`,
        temperature: 0.2, max_tokens: 2500,
      });
      setResult(raw);
    } catch { setResult({ error: true }); }
    setLoading(false);
  };

  const TIER = { A: "#34C759", B: "#FF9F0A", C: "#EF4444" };

  if (loadingData) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-[#9333EA]" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job selector */}
        <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-[#0F172A]">Select Open Job</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {jobs.length === 0
              ? <p className="text-xs text-[#8E8E93]">No open jobs — add jobs in the Jobs page first.</p>
              : jobs.map(j => (
                <button key={j.id} onClick={() => selectJob(j)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all
                    ${selectedJob?.id === j.id
                      ? "border-[#9333EA] bg-[#EBF3FD] text-[#0052A3]"
                      : "border-[#E2E8F0] hover:border-[#9333EA]/40 text-[#0F172A]"}`}>
                  <p className="font-medium truncate">{j.title}</p>
                  <p className="text-[11px] text-[#64748B] truncate">{j.company_name || "Unknown company"}</p>
                </button>
              ))}
          </CardContent>
        </Card>

        {/* Skills panel */}
        <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center justify-between">
              Required Skills
              {selectedJob && <span className="text-[10px] text-[#9333EA] font-normal">AI-extracted from JD</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSkill()}
                placeholder="Type a skill and press Enter…"
                className="h-8 text-sm rounded-lg border-[#E2E8F0]" />
              <Button size="sm" onClick={addSkill} className="h-8 rounded-lg bg-[#9333EA] text-white px-3 text-xs">Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
              {requiredSkills.map(s => (
                <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EBF3FD] text-[#0052A3] rounded-full text-xs font-medium border border-[#9333EA]/30">
                  {s}
                  <button onClick={() => setRequiredSkills(p => p.filter(x => x !== s))}><X className="w-2.5 h-2.5" /></button>
                </span>
              ))}
            </div>
            <Button onClick={analyze} disabled={!requiredSkills.length || loading}
              className="w-full h-9 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white text-sm font-medium">
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Scoring {candidates.length} candidates…</>
                : <><Zap className="w-3.5 h-3.5 mr-1.5" />Score All Candidates</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && !result.error && (
        <>
          {result.insight && (
            <div className="bg-[#EBF3FD] border border-[#9333EA]/20 rounded-2xl px-4 py-3 flex gap-3 items-start">
              <Brain className="w-4 h-4 text-[#9333EA] shrink-0 mt-0.5" />
              <p className="text-sm text-[#0052A3] leading-relaxed">{result.insight}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Candidate Rankings — {(result.scores || []).length} scored</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {(result.scores || []).sort((a, b) => b.overall_score - a.overall_score).map(c => (
                <Card key={c.candidate_id} className="border border-[#E2E8F0] rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm font-semibold text-[#0F172A] truncate flex-1">{c.name}</p>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: TIER[c.tier] || "#8E8E93" }}>{c.tier}</span>
                        <span className="text-base font-bold" style={{ color: TIER[c.tier] || "#8E8E93" }}>{c.overall_score}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-3">
                      {Object.entries(c.skill_scores || {}).map(([skill, score]) => (
                        <div key={skill} className="flex items-center gap-2">
                          <span className="text-[10px] text-[#64748B] w-18 truncate shrink-0" style={{ width: 72 }}>{skill}</span>
                          <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${score}%`, background: /** @type {number} */ (score) >= 70 ? "#34C759" : /** @type {number} */ (score) >= 40 ? "#FF9F0A" : "#EF4444" }} />
                          </div>
                          <span className="text-[10px] text-[#8E8E93] w-5 text-right shrink-0">{score}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(c.strengths || []).map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#F0FFF4] text-[#1A7F3C] rounded text-[10px] border border-[#34C759]/30">{s}</span>
                      ))}
                      {(c.gaps || []).map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-[#FFF5F5] text-[#C0392B] rounded text-[10px] border border-[#EF4444]/30">{s}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {(result.market_demand || []).length > 0 && (
            <Card className="border border-[#E2E8F0] rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#9333EA]" /> Skill Supply vs. Market Demand
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={result.market_demand} barCategoryGap="30%">
                    <XAxis dataKey="skill" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="demand" name="Market Demand" fill="#9333EA" radius={[4,4,0,0]} />
                    <Bar dataKey="supply"  name="Candidate Supply" fill="#34C759" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
      {result?.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl p-4">
          Analysis failed — check LLM config in .env.local and retry.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const DEFAULT_RESUME = {
  name: "", headline: "", email: "", phone: "", location: "",
  linkedin: "", summary: "",
  experiences: [], education: [], projects: [], skills: [],
  theme_color: "#9333EA",
};

export default function ResumeStudio() {
  const [data, setData]           = useState(DEFAULT_RESUME);
  const [activeTab, setActiveTab] = useState("build");
  const [zoom, setZoom]           = useState(0.72);
  const [autoscale, setAutoscale] = useState(true);
  const [showAI, setShowAI]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const containerRef = useRef(null);
  const previewRef   = useRef(null);

  useEffect(() => {
    if (!autoscale || activeTab !== "build") return;
    const obs = new ResizeObserver(() => {
      if (containerRef.current)
        setZoom(Math.max(0.4, Math.min(1, containerRef.current.offsetWidth / 816)));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [autoscale, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    try { await Resume.create({ ...data, parsed_data: data }); } catch { /* Resume persistence is best-effort */ }
    setSaving(false);
  };

  const applyGenerated = useCallback((generated) => {
    if (generated && typeof generated === "object") setData(p => ({ ...p, ...generated }));
  }, []);

  return (
    <div className="p-6 bg-[#F8FAFC] min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Resume & Skills Studio</h1>
          <p className="text-sm text-[#64748B] mt-0.5">AI-powered resume writer · ATS scorer · skills intelligence</p>
        </div>
        {activeTab === "build" && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAI(v => !v)}
              className="rounded-xl border-[#E2E8F0] h-9 gap-1.5 text-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#9333EA]" />
              AI Writer {showAI ? "▲" : "▼"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}
              className="rounded-xl border-[#E2E8F0] h-9 gap-1.5 text-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            <Button size="sm" onClick={() => window.print()}
              className="rounded-xl bg-[#0F172A] hover:bg-[#2D2D2F] text-white h-9 gap-1.5 text-sm">
              <Download className="w-3.5 h-3.5" /> Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-[#E2E8F0] rounded-2xl p-1 mb-6 shadow-sm w-auto inline-flex">
          {[
            { key: "build",  Icon: FileText,    label: "Resume Builder" },
            { key: "score",  Icon: Target,       label: "ATS Scorer"    },
            { key: "skills", Icon: TrendingUp,   label: "Skills Lab"    },
          ].map(({ key, Icon, label }) => (
            <TabsTrigger key={key} value={key}
              className="rounded-xl px-5 py-2 text-sm font-medium gap-1.5
                data-[state=active]:bg-[#9333EA] data-[state=active]:text-white
                data-[state=inactive]:text-[#64748B] transition-all">
              <Icon className="w-3.5 h-3.5" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Resume Builder ── */}
        <TabsContent value="build" className="mt-0">
          {showAI && (
            <div className="mb-4 bg-white border border-[#9333EA]/20 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0] bg-gradient-to-r from-[#EBF3FD] to-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#9333EA]" />
                <span className="text-sm font-semibold text-[#0052A3]">AI Resume Writer</span>
                <span className="text-[11px] text-[#64748B] ml-1">— generate or rewrite from a job description</span>
              </div>
              <div className="p-4">
                <ResumeLLMBuilder resumeData={data} onApply={applyGenerated} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Form */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <p className="text-sm font-semibold text-[#0F172A]">Edit Sections</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "78vh" }}>
                <ResumeFormLeft data={data} onChange={setData} />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">Live Preview</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setAutoscale(false); setZoom(z => Math.max(0.3, z - 0.1)); }}
                    className="w-6 h-6 rounded-full bg-[#F2F2F7] text-xs flex items-center justify-center hover:bg-[#E2E8F0]">−</button>
                  <span className="text-xs text-[#64748B] w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => { setAutoscale(false); setZoom(z => Math.min(1.2, z + 0.1)); }}
                    className="w-6 h-6 rounded-full bg-[#F2F2F7] text-xs flex items-center justify-center hover:bg-[#E2E8F0]">+</button>
                  <button onClick={() => setAutoscale(true)} className="text-[10px] text-[#9333EA] hover:underline ml-1">Fit</button>
                </div>
              </div>
              <div ref={containerRef} className="overflow-auto bg-[#F8FAFC]" style={{ maxHeight: "78vh" }}>
                <div ref={previewRef}
                  style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
                  <ResumePreview data={data} />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── ATS Scorer ── */}
        <TabsContent value="score" className="mt-0"><ScoreTab /></TabsContent>

        {/* ── Skills Lab ── */}
        <TabsContent value="skills" className="mt-0"><SkillsLabTab /></TabsContent>
      </Tabs>
    </div>
  );
}
