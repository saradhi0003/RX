import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, Briefcase, Building2, TrendingUp, ArrowUpRight,
  RefreshCcw, Sparkles, AlertTriangle, CheckCircle2, Loader2, Plus,
  ChevronRight, Clock, Activity, Brain, Zap, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Candidate, Job, Company, Application, Submission, Task } from "@/entities/all";
import { User as UserEntity } from "@/entities/all";
import { usePermissions } from "@/components/common/PermissionsContext";
import { getRolesCached } from "@/components/utils/rolesCache";
import { base44 } from "@/api/base44Client";
import { addNotification } from "@/components/notifications/NotificationToast";
import { DashboardConfig } from "@/entities/DashboardConfig";
import WidgetRenderer from "@/components/dashboard/WidgetRenderer";
import BuilderModal from "@/components/dashboard/BuilderModal";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import DataListModal from "@/components/common/DataListModal";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip
} from "recharts";

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, trend, trendUp, onClick, loading }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F0] rounded-xl px-6 py-5 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
    >
      <p className="text-[13px] text-[#94A3B8] font-medium mb-1">{label}</p>
      {loading ? (
        <div className="h-10 w-20 bg-slate-100 rounded animate-pulse my-1" />
      ) : (
        <p className="text-[40px] font-bold text-[#1E293B] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
          {value}
        </p>
      )}
      <div className="flex items-center gap-1.5 mt-2">
        {trend && (
          <span className={`flex items-center gap-0.5 text-[12px] font-semibold ${trendUp ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            {trend}
          </span>
        )}
        {sub && <span className="text-[12px] text-[#94A3B8]">{sub}</span>}
      </div>
    </div>
  );
}

function PipelineFunnelBar({ stages, loading }) {
  const max = Math.max(...stages.map(s => s.count), 1);
  const COLORS = {
    Applied: "#2563EB", Screened: "#F97316", Interview: "#16A34A",
    Offer: "#7C3AED", Placed: "#0891B2",
  };
  return (
    <div className="space-y-3">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)
        : stages.map(s => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="w-[72px] text-[13px] text-[#475569] font-medium shrink-0">{s.label}</span>
              <div className="flex-1 h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, (s.count / max) * 100)}%`, backgroundColor: COLORS[s.label] || "#2563EB" }}
                />
              </div>
              <span className="w-8 text-right text-[13px] font-semibold text-[#1E293B]">{s.count}</span>
            </div>
          ))
      }
    </div>
  );
}

function avatarColor(name = "") {
  const palette = [
    "bg-[#EFF6FF] text-[#2563EB]", "bg-[#F0FDF4] text-[#16A34A]",
    "bg-[#FFF7ED] text-[#D97706]", "bg-[#F5F3FF] text-[#7C3AED]",
    "bg-[#FEF2F2] text-[#DC2626]", "bg-[#E0F2FE] text-[#0369A1]",
  ];
  let h = 0; for (const c of name) h += c.charCodeAt(0);
  return palette[h % palette.length];
}

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

const STAGE_PILL = {
  interviewing: "bg-[#EFF6FF] text-[#2563EB]",
  screening: "bg-[#FFF7ED] text-[#D97706]",
  screened: "bg-[#FFF7ED] text-[#D97706]",
  offered: "bg-[#F0FDF4] text-[#16A34A]",
  hired: "bg-[#F0FDF4] text-[#16A34A]",
  submitted: "bg-[#F5F3FF] text-[#7C3AED]",
  active: "bg-[#F8FAFC] text-[#475569]",
  rejected: "bg-[#FEF2F2] text-[#DC2626]",
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [stats, setStats] = useState({ totalCandidates: 0, activeJobs: 0, totalCompanies: 0, thisMonthPlacements: 0 });
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myTasksToday, setMyTasksToday] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [modal, setModal] = useState({ open: false, title: "", columns: [], rows: [] });
  const [config, setConfig] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiInsights, setAIInsights] = useState(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [completingTask, setCompletingTask] = useState(null);

  const dashGuard = useRef({ ts: 0, inFlight: false });
  const { listFilterFor } = usePermissions();

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const quarter = `Q${Math.ceil((today.getMonth() + 1) / 3)} ${today.getFullYear()}`;

  const loadDashboardData = useCallback(async (force = false) => {
    const now = Date.now();
    if (dashGuard.current.inFlight) return;
    if (!force && now - dashGuard.current.ts < 30000) return;
    dashGuard.current.inFlight = true;
    setLoading(true);
    try {
      const meUser = await UserEntity.me().catch(() => null);
      setMe(meUser);
      let admin = meUser?.role === "admin";
      if (meUser?.role_id) {
        const roles = await getRolesCached();
        const r = roles.find(it => it.id === meUser.role_id);
        admin = admin || (r?.name || "").toLowerCase() === "admin";
      }
      setIsAdmin(admin);

      const cfgList = await DashboardConfig.filter({ is_global: true, is_active: true }, "-updated_date");
      const cfg = cfgList[0] || null;
      setConfig(cfg);
      setWidgets(cfg?.widgets || []);

      const candFilter = listFilterFor("Candidate");
      const jobFilter = listFilterFor("Job");
      const compFilter = listFilterFor("Company");
      const appFilter = listFilterFor("Application");
      const subFilter = listFilterFor("Submission");
      let taskFilter = !admin && meUser?.email ? { created_by: meUser.email } : null;

      const [candidatesData, jobsData, companiesData, applicationsData, submissionsData, tasks] = await Promise.all([
        candFilter ? Candidate.filter(candFilter, '-created_date', 100) : Candidate.list('-created_date', 100),
        jobFilter ? Job.filter(jobFilter, '-created_date', 50) : Job.list('-created_date', 50),
        compFilter ? Company.filter(compFilter, '-created_date', 50) : Company.list('-created_date', 50),
        appFilter ? Application.filter(appFilter, '-created_date', 50) : Application.list('-created_date', 50),
        subFilter ? Submission.filter(subFilter, '-created_date', 50) : Submission.list('-created_date', 50),
        taskFilter ? Task.filter(taskFilter, '-created_date', 50) : Task.list('-created_date', 50)
      ]);

      setCandidates(candidatesData || []);
      setJobs(jobsData || []);
      setCompanies(companiesData || []);
      setApplications(applicationsData || []);
      setSubmissions(submissionsData || []);

      const activeJobs = jobsData.filter(j => j.status === "open").length;
      const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
      const thisMonthPlacements = applicationsData.filter(a => {
        if (a.status !== "hired") return false;
        const d = new Date(a.created_date);
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }).length;
      setStats({ totalCandidates: candidatesData.length, activeJobs, totalCompanies: companiesData.length, thisMonthPlacements });

      const todayTs = todayMidnight.getTime();
      const my = (tasks || [])
        .filter(t => ["pending", "in_progress"].includes(t.status))
        .filter(t => !t.due_date || new Date(t.due_date).setHours(0,0,0,0) <= todayTs)
        .sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date) : new Date("9999");
          const db = b.due_date ? new Date(b.due_date) : new Date("9999");
          return da - db;
        });
      setMyTasksToday(my);
    } catch (err) {
      console.error("Dashboard load error:", err);
    }
    setLoading(false);
    dashGuard.current.inFlight = false;
    dashGuard.current.ts = Date.now();
  }, [listFilterFor]);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const completeTask = async (taskId) => {
    setCompletingTask(taskId);
    try {
      await Task.update(taskId, { status: "completed", completion_notes: "Completed from Dashboard" });
      setMyTasksToday(prev => prev.filter(t => t.id !== taskId));
    } catch (err) { console.error(err); }
    setCompletingTask(null);
  };

  const saveGlobalDashboard = async (dash) => {
    let saved = config?.id
      ? await DashboardConfig.update(config.id, { ...dash, is_global: true, is_active: true })
      : await DashboardConfig.create({ ...dash, is_global: true, is_active: true });
    setConfig(saved);
    setWidgets(saved.widgets || []);
    setBuilderOpen(false);
  };

  const onWidgetDragEnd = async ({ destination, source }) => {
    if (!destination || destination.index === source.index) return;
    const arr = Array.from(widgets);
    const [moved] = arr.splice(source.index, 1);
    arr.splice(destination.index, 0, moved);
    setWidgets(arr);
    if (isAdmin && config?.id) await DashboardConfig.update(config.id, { ...config, widgets: arr });
  };

  const openModalFor = (type) => {
    const fmt = d => d ? new Date(d).toLocaleDateString() : "—";
    if (type === "candidates") {
      setModal({ open: true, title: "All Candidates", columns: [
        { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "location", label: "Location" }
      ], rows: candidates.map(c => ({ name: `${c.first_name} ${c.last_name}`, status: c.status?.replace("_"," "), location: c.location || "—" })) });
    } else if (type === "jobs") {
      setModal({ open: true, title: "Active Jobs", columns: [
        { key: "title", label: "Title" }, { key: "company", label: "Company" }, { key: "status", label: "Status" }, { key: "priority", label: "Priority" }
      ], rows: jobs.map(j => ({ title: j.title, company: companies.find(c => c.id === j.company_id)?.name || "—", status: j.status?.replace("_"," "), priority: j.priority })) });
    } else if (type === "companies") {
      setModal({ open: true, title: "All Companies", columns: [
        { key: "name", label: "Company" }, { key: "industry", label: "Industry" }, { key: "status", label: "Status" }
      ], rows: companies.map(co => ({ name: co.name, industry: co.industry || "—", status: co.status || "—" })) });
    } else if (type === "hires") {
      setModal({ open: true, title: "This Month's Placements", columns: [
        { key: "candidate", label: "Candidate" }, { key: "job", label: "Job" }, { key: "date", label: "Date" }
      ], rows: applications.filter(a => a.status === "hired").map(a => ({
        candidate: (() => { const c = candidates.find(x => x.id === a.candidate_id); return c ? `${c.first_name} ${c.last_name}` : "—"; })(),
        job: jobs.find(j => j.id === a.job_id)?.title || "—",
        date: fmt(a.created_date)
      })) });
    }
  };

  const runAIAnalysis = async () => {
    setAnalyzingAI(true);
    try {
      const dataSummary = {
        candidates: { total: candidates.length, by_status: candidates.reduce((a, c) => { a[c.status] = (a[c.status]||0)+1; return a; }, {}) },
        jobs: { total: jobs.length, open: jobs.filter(j => j.status === "open").length },
        applications: { total: applications.length, hired: applications.filter(a => a.status === "hired").length }
      };
      const r = await base44.integrations.Core.InvokeLLM({
        prompt: `Recruitment pipeline data: ${JSON.stringify(dataSummary)}. Give 4 concise, actionable insights for a recruiter. Each should be 1 sentence identifying a specific issue or opportunity.`,
        response_json_schema: {
          type: "object",
          properties: {
            insights: { type: "array", items: { type: "object", properties: { text: { type: "string" }, type: { type: "string", enum: ["warning","success","info","urgent"] }, action: { type: "string" } } } },
            summary: { type: "string" }
          }
        }
      });
      setAIInsights(r);
      addNotification({ type: "success", title: "AI Analysis Complete", message: "Insights ready" });
    } catch (err) {
      console.error(err);
      addNotification({ type: "error", message: "Failed to generate insights" });
    }
    setAnalyzingAI(false);
  };

  // Pipeline stage data
  const pipelineStages = [
    { label: "Applied",   count: candidates.filter(c => c.status === "active").length },
    { label: "Screened",  count: candidates.filter(c => c.status === "screened").length },
    { label: "Interview", count: applications.filter(a => a.status === "interviewing").length },
    { label: "Offer",     count: applications.filter(a => a.status === "offered").length },
    { label: "Placed",    count: stats.thisMonthPlacements },
  ];

  const pipelineMax = Math.max(...pipelineStages.map(s => s.count), 1);
  const PIPE_COLORS = { Applied: "#2563EB", Screened: "#F97316", Interview: "#16A34A", Offer: "#7C3AED", Placed: "#0891B2" };

  const statusChartData = Object.entries(
    candidates.reduce((a, c) => { a[c.status] = (a[c.status]||0)+1; return a; }, {})
  ).map(([name, value]) => ({ name: name.replace(/_/g," "), value }));

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "pipeline", label: "Pipeline" },
    { id: "activity", label: "Activity" },
  ];

  // Recent candidates
  const recentCandidates = [...candidates]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-[#1E293B]" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
            <p className="text-[12px] text-[#94A3B8] mt-0.5">{dateLabel} · {quarter}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-[13px] border-[#E2E8F0] text-[#475569]"
              onClick={() => { setRefreshKey(k => k+1); loadDashboardData(true); }}
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </Button>
            {isAdmin && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-[13px] border-[#E2E8F0] text-[#475569]"
                onClick={() => setBuilderOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Customize
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 text-[13px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white border-0"
              onClick={runAIAnalysis}
              disabled={analyzingAI}
            >
              {analyzingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {analyzingAI ? "Analyzing..." : "AI Actions"}
            </Button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-0 mt-3 -mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <>
            {/* Top row: Pipeline Funnel + Today's Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
              {/* Pipeline Funnel */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">Pipeline Funnel</h2>
                  <Link to={createPageUrl("Submissions")} className="text-[12px] text-[#2563EB] font-medium hover:underline">
                    View All
                  </Link>
                </div>
                <div className="space-y-3">
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 bg-slate-100 rounded animate-pulse" />)
                    : pipelineStages.map(s => (
                        <div key={s.label} className="flex items-center gap-3">
                          <span className="w-20 text-[13px] text-[#475569] font-medium shrink-0">{s.label}</span>
                          <div className="flex-1 h-2.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(3, (s.count / pipelineMax) * 100)}%`, backgroundColor: PIPE_COLORS[s.label] || "#2563EB" }}
                            />
                          </div>
                          <span className="w-8 text-right text-[13px] font-semibold text-[#1E293B]">{s.count}</span>
                        </div>
                      ))
                  }
                </div>
              </div>

              {/* Today's Tasks */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">Today's Tasks</h2>
                  <Link to={createPageUrl("Tasks")} className="flex items-center gap-1 text-[12px] text-[#2563EB] font-medium hover:underline">
                    <Plus className="w-3.5 h-3.5" /> New
                  </Link>
                </div>
                <div className="flex-1 divide-y divide-[#F8FAFC]">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-16 mx-5 my-2 bg-slate-100 rounded animate-pulse" />
                    ))
                  ) : myTasksToday.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
                      <p className="text-[13px] text-[#64748B]">All caught up!</p>
                    </div>
                  ) : (
                    myTasksToday.slice(0, 6).map(t => {
                      const isOverdue = t.due_date && new Date(t.due_date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                      const isToday = t.due_date && new Date(t.due_date).setHours(0,0,0,0) === new Date().setHours(0,0,0,0);
                      const dueLabel = t.due_date
                        ? isOverdue
                          ? `Overdue · ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : isToday ? "Due today" : `Due ${new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : null;
                      return (
                        <div key={t.id} className="flex items-start gap-3 px-5 py-4 hover:bg-[#F8FAFC] transition-colors">
                          <button
                            onClick={() => completeTask(t.id)}
                            disabled={completingTask === t.id}
                            className="mt-1 w-4 h-4 rounded-full border-2 border-[#CBD5E1] hover:border-[#2563EB] flex items-center justify-center flex-shrink-0 transition-colors"
                          >
                            {completingTask === t.id && <Loader2 className="w-2.5 h-2.5 animate-spin text-[#2563EB]" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#1E293B] leading-snug">{t.title}</p>
                            {t.related_entity && (
                              <p className="text-[11px] text-[#94A3B8] mt-0.5 capitalize">{t.related_entity.replace(/_/g," ")}</p>
                            )}
                            {dueLabel && (
                              <p className={`text-[11px] mt-0.5 font-semibold ${isOverdue ? "text-[#DC2626]" : "text-[#94A3B8]"}`}>
                                {dueLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {!loading && myTasksToday.length > 6 && (
                    <div className="px-5 py-3">
                      <Link to={createPageUrl("Tasks")} className="text-[12px] text-[#2563EB] font-medium hover:underline">
                        +{myTasksToday.length - 6} more tasks
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom row: Recent Candidates + AI Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
              {/* Recent Candidates */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">Recent Candidates</h2>
                  <Link to={createPageUrl("Candidates")} className="text-[12px] text-[#2563EB] font-medium hover:underline">
                    See All
                  </Link>
                </div>
                {/* Table header */}
                <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  {["CANDIDATE", "ROLE", "SCORE", "STAGE", "APPLIED"].map(h => (
                    <span key={h} className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-14 mx-5 my-2 bg-slate-100 rounded animate-pulse" />
                  ))
                ) : recentCandidates.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-[#94A3B8]">No candidates yet</div>
                ) : (
                  recentCandidates.map(c => {
                    const app = applications.find(a => a.candidate_id === c.id);
                    const stage = app?.status || c.status || "active";
                    const score = app?.match_score || c.screening_score;
                    const color = avatarColor(`${c.first_name}${c.last_name}`);
                    const pillClass = STAGE_PILL[stage] || "bg-[#F8FAFC] text-[#475569]";
                    return (
                      <div
                        key={c.id}
                        className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3 border-b border-[#F8FAFC] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity: "Candidate", id: c.id } }))}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${color}`}>
                            {(c.first_name?.[0] || "")}{(c.last_name?.[0] || "")}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#1E293B] truncate">{c.first_name} {c.last_name}</p>
                            {c.current_title && <p className="text-[11px] text-[#94A3B8] truncate">{c.current_title}</p>}
                          </div>
                        </div>
                        <span className="text-[12px] text-[#475569] truncate">{c.current_title || "—"}</span>
                        <span className={`text-[13px] font-semibold ${score ? (score >= 85 ? "text-[#16A34A]" : score >= 70 ? "text-[#D97706]" : "text-[#94A3B8]") : "text-[#CBD5E1]"}`}>
                          {score ? `${Math.round(score)}%` : "—"}
                        </span>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize inline-block ${pillClass}`}>
                          {stage.replace(/_/g, " ")}
                        </span>
                        <span className="text-[12px] text-[#94A3B8]">{timeAgo(c.created_date)}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* AI Insights */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-[#2563EB]" />
                    </div>
                    <h2 className="text-[15px] font-semibold text-[#1E293B]">AI Insights</h2>
                    <div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                  </div>
                </div>
                <div className="p-5 flex-1">
                  {analyzingAI ? (
                    <div className="py-6 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#2563EB] mx-auto mb-2" />
                      <p className="text-[12px] text-[#64748B]">Analyzing pipeline...</p>
                    </div>
                  ) : (
                    <ul className="space-y-3.5">
                      {(aiInsights?.insights?.length > 0 ? aiInsights.insights : [
                        { text: `${candidates.filter(c => c.status === "active").length} candidates match active roles at 90%+ confidence`, type: "info" },
                        { text: `${candidates.filter(c => c.status === "screened").length > 0 ? "Top screened candidates showing high intent" : "No screened candidates yet — start reviewing"}`, type: "success" },
                        { text: `${stats.thisMonthPlacements} placements this month — pipeline is ${stats.thisMonthPlacements > 0 ? "performing well" : "needs attention"}`, type: "info" },
                        { text: `${stats.activeJobs} open roles — consider sourcing from talent communities`, type: "warning" },
                      ]).map((ins, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#475569]">
                          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            ins.type === "urgent" ? "bg-[#DC2626]" :
                            ins.type === "warning" ? "bg-[#D97706]" :
                            ins.type === "success" ? "bg-[#16A34A]" : "bg-[#2563EB]"
                          }`} />
                          <span className="leading-snug">{ins.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="px-5 pb-4">
                  <Button
                    size="sm"
                    onClick={runAIAnalysis}
                    disabled={analyzingAI}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[12px] gap-1.5"
                  >
                    {analyzingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    {analyzingAI ? "Analyzing..." : "Refresh Insights"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Custom Widgets */}
            {widgets && widgets.length > 0 && (
              isAdmin ? (
                <DragDropContext onDragEnd={onWidgetDragEnd}>
                  <Droppable droppableId="dash-widgets" direction="horizontal">
                    {(drop) => (
                      <div ref={drop.innerRef} {...drop.droppableProps} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {widgets.map((w, idx) => (
                          <Draggable key={w.id} draggableId={w.id} index={idx}>
                            {(drag) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                                <WidgetRenderer widget={w} refreshKey={refreshKey} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {drop.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {widgets.map(w => <WidgetRenderer key={w.id} widget={w} refreshKey={refreshKey} />)}
                </div>
              )
            )}
          </>
        )}

        {/* ── Pipeline Tab ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-5">
            {/* Stage KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {pipelineStages.map(s => (
                <div key={s.label} className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIPE_COLORS[s.label] || "#2563EB" }} />
                    <span className="text-[12px] text-[#64748B] font-medium">{s.label}</span>
                  </div>
                  <p className="text-[28px] font-bold text-[#1E293B] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                    {loading ? <span className="inline-block w-8 h-7 bg-slate-100 rounded animate-pulse" /> : s.count}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-1">candidates</p>
                </div>
              ))}
            </div>

            {/* Funnel visual + chart side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
              {/* Detailed funnel */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">Conversion Funnel</h2>
                  <Link to={createPageUrl("Submissions")} className="flex items-center gap-1 text-[12px] text-[#2563EB] font-medium hover:underline">
                    View All <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-4">
                  {pipelineStages.map((s, i) => {
                    const prev = i > 0 ? pipelineStages[i - 1].count : s.count;
                    const convRate = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
                    return (
                      <div key={s.label}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="w-20 text-[13px] text-[#475569] font-medium shrink-0">{s.label}</span>
                          <div className="flex-1 h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(2, (s.count / pipelineMax) * 100)}%`, backgroundColor: PIPE_COLORS[s.label] || "#2563EB" }}
                            />
                          </div>
                          <span className="w-8 text-right text-[13px] font-bold text-[#1E293B]">{s.count}</span>
                        </div>
                        {i > 0 && s.count > 0 && (
                          <div className="ml-[92px] text-[10px] text-[#94A3B8] -mt-0.5">
                            {convRate}% from {pipelineStages[i-1].label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Candidates by Status chart */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6">
                <h2 className="text-[15px] font-semibold text-[#1E293B] mb-5">Candidates by Status</h2>
                {!loading && statusChartData.length > 0 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData} barSize={24}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                        <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-52 flex items-center justify-center text-[13px] text-[#94A3B8]">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" /> : "No data yet"}
                  </div>
                )}
              </div>
            </div>

            {/* Open Jobs table */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                <h2 className="text-[15px] font-semibold text-[#1E293B]">Open Roles</h2>
                <Link to={createPageUrl("Jobs")} className="text-[12px] text-[#2563EB] font-medium hover:underline">See All</Link>
              </div>
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                {["ROLE", "COMPANY", "TYPE", "PRIORITY", "POSTED"].map(h => (
                  <span key={h} className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 mx-5 my-2 bg-slate-100 rounded animate-pulse" />)
              ) : jobs.filter(j => j.status === "open").slice(0, 6).map(j => {
                const company = companies.find(c => c.id === j.company_id);
                const priorityColors = { urgent: "bg-[#FEF2F2] text-[#DC2626]", high: "bg-[#FFF7ED] text-[#D97706]", medium: "bg-[#EFF6FF] text-[#2563EB]", low: "bg-[#F0FDF4] text-[#16A34A]" };
                return (
                  <div key={j.id} className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3.5 border-b border-[#F8FAFC] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-[#1E293B] truncate">{j.title}</p>
                      <p className="text-[11px] text-[#94A3B8] truncate">{j.location || j.remote_type?.replace(/_/g," ") || "—"}</p>
                    </div>
                    <span className="text-[12px] text-[#475569] truncate">{company?.name || "—"}</span>
                    <span className="text-[11px] text-[#64748B] capitalize">{j.employment_type?.replace(/_/g," ") || "—"}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize inline-block ${priorityColors[j.priority] || "bg-[#F8FAFC] text-[#475569]"}`}>
                      {j.priority || "—"}
                    </span>
                    <span className="text-[12px] text-[#94A3B8]">{timeAgo(j.created_date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Activity Tab ── */}
        {activeTab === "activity" && (
          <div className="space-y-5">
            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4">
                <p className="text-[12px] text-[#94A3B8] font-medium mb-1">Total Candidates</p>
                <p className="text-[32px] font-bold text-[#1E293B] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  {loading ? <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" /> : stats.totalCandidates}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1">in pipeline</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4">
                <p className="text-[12px] text-[#94A3B8] font-medium mb-1">Active Roles</p>
                <p className="text-[32px] font-bold text-[#2563EB] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  {loading ? <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" /> : stats.activeJobs}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1">open positions</p>
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-xl px-5 py-4">
                <p className="text-[12px] text-[#94A3B8] font-medium mb-1">Placed This Month</p>
                <p className="text-[32px] font-bold text-[#16A34A] leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  {loading ? <span className="inline-block w-12 h-8 bg-slate-100 rounded animate-pulse" /> : stats.thisMonthPlacements}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1">successful placements</p>
              </div>
            </div>

            {/* Activity feed + task list side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
              {/* Activity feed */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">Recent Activity</h2>
                  <Link to={createPageUrl("Candidates")} className="text-[12px] text-[#2563EB] font-medium hover:underline">View All</Link>
                </div>
                <div className="divide-y divide-[#F8FAFC]">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 mx-5 my-2 bg-slate-100 rounded animate-pulse" />)
                  ) : [...candidates].sort((a,b) => new Date(b.created_date)-new Date(a.created_date)).slice(0,12).map(c => {
                    const color = avatarColor(`${c.first_name}${c.last_name}`);
                    const app = applications.find(a => a.candidate_id === c.id);
                    const stage = app?.status || c.status || "active";
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity: "Candidate", id: c.id } }))}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${color}`}>
                          {c.first_name?.[0]}{c.last_name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#1E293B]">
                            {c.first_name} {c.last_name}
                            <span className="font-normal text-[#64748B]"> added to pipeline</span>
                          </p>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{c.current_title || "Candidate"} · {timeAgo(c.created_date)}</p>
                        </div>
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize shrink-0 ${STAGE_PILL[stage] || "bg-[#F8FAFC] text-[#475569]"}`}>
                          {stage.replace(/_/g," ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All tasks panel */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
                  <h2 className="text-[15px] font-semibold text-[#1E293B]">All Pending Tasks</h2>
                  <Link to={createPageUrl("Tasks")} className="flex items-center gap-1 text-[12px] text-[#2563EB] font-medium hover:underline">
                    <Plus className="w-3.5 h-3.5" /> New
                  </Link>
                </div>
                <div className="flex-1 divide-y divide-[#F8FAFC] overflow-auto">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 mx-5 my-2 bg-slate-100 rounded animate-pulse" />)
                  ) : myTasksToday.length === 0 ? (
                    <div className="p-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
                      <p className="text-[13px] text-[#64748B]">All caught up!</p>
                    </div>
                  ) : myTasksToday.map(t => {
                    const isOverdue = t.due_date && new Date(t.due_date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                    const priorityDot = { urgent: "bg-[#DC2626]", high: "bg-[#D97706]", medium: "bg-[#2563EB]", low: "bg-[#16A34A]" };
                    return (
                      <div key={t.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors">
                        <button
                          onClick={() => completeTask(t.id)}
                          disabled={completingTask === t.id}
                          className="mt-1 w-4 h-4 rounded-full border-2 border-[#CBD5E1] hover:border-[#2563EB] flex items-center justify-center flex-shrink-0 transition-colors"
                        >
                          {completingTask === t.id && <Loader2 className="w-2.5 h-2.5 animate-spin text-[#2563EB]" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#1E293B] leading-snug truncate">{t.title}</p>
                          {t.due_date && (
                            <p className={`text-[11px] mt-0.5 font-semibold ${isOverdue ? "text-[#DC2626]" : "text-[#94A3B8]"}`}>
                              {isOverdue ? "Overdue · " : "Due "}{new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${priorityDot[t.priority] || "bg-[#CBD5E1]"}`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <BuilderModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        initial={config || { name: "Global Dashboard", description: "", widgets: [] }}
        onSave={saveGlobalDashboard}
      />
      <DataListModal
        open={modal.open}
        title={modal.title}
        columns={modal.columns}
        rows={modal.rows}
        onClose={() => setModal({ open: false, title: "", columns: [], rows: [] })}
      />
    </div>
  );
}