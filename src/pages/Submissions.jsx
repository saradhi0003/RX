import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  User,
  Briefcase,
  Calendar,
  Send,
  ChevronUp,
  ChevronDown,
  RefreshCcw,
  Settings,
  Save,
  Loader2,
  X,
  Zap,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import SubmissionForm from "@/components/submissions/SubmissionForm";
import KanbanBoard from "@/components/submissions/KanbanBoard";
import ViewSettingsModal from "@/components/submissions/ViewSettingsModal";
import PageHeader from "@/components/common/PageHeader";
import { PermissionsProvider, usePermissions } from "@/components/common/PermissionsContext";
import PermissionGate from "@/components/common/PermissionGate";
import { addNotification } from "@/components/notifications/NotificationToast";
import { executeAutomationRules } from "@/components/automation/executeAutomation";

function SubmissionsPageContent() {
  const { can, isAdmin } = usePermissions();
  const [submissions, setSubmissions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formSubmission, setFormSubmission] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewType, setViewType] = useState("kanban"); // Default to kanban
  const [sortBy, setSortBy] = useState("submitted_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [views, setViews] = useState([]);

  const [highlightedSubmission, setHighlightedSubmission] = useState(null);
  const [highlightedChanges, setHighlightedChanges] = useState({});
  const [savingHighlighted, setSavingHighlighted] = useState(false);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [visibleColumns, setVisibleColumns] = useState([
    { key: "candidate_id", label: "Candidate", visible: true },
    { key: "job_id", label: "Job", visible: true },
    { key: "status", label: "Status", visible: true },
    { key: "submitted_date", label: "Submitted", visible: true },
  ]);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const [submissionsData, candidatesData, jobsData, companiesData, viewsData] = await Promise.all([
        base44.entities.Submission.list("-submitted_date", 200),
        base44.entities.Candidate.list("-updated_date", 200),
        base44.entities.Job.list("-updated_date", 100),
        base44.entities.Company.list("-updated_date", 100),
        base44.entities.SubmissionView.list().catch(() => [])
      ]);
      
      // Filter submissions to only show past 1 month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const recentSubmissions = (submissionsData || []).filter(submission => {
        if (!submission.submitted_date) return true; // Include if no date
        const submittedDate = new Date(submission.submitted_date);
        return submittedDate >= oneMonthAgo;
      });
      
      setSubmissions(recentSubmissions);
      setCandidates(candidatesData || []);
      setJobs(jobsData || []);
      setCompanies(companiesData || []);
      setViews(viewsData || []);
      
      // Only apply saved view if there's an explicitly marked default view
      // Otherwise, keep the initial kanban default
      if (!activeView && viewsData && viewsData.length > 0) {
        const defaultView = viewsData.find(v => v.is_default);
        if (defaultView) {
          setActiveView(defaultView);
          applyView(defaultView);
        }
        // If no default view is marked, keep initial "kanban" state
      }
    } catch (error) {
      console.error("Error loading submissions:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to load applications: " + error.message });
    }
    setLoading(false);
  }, [activeView]);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const applyView = (view) => {
    if (!view) return;
    // Reset filters before applying view filters
    setStatusFilter("all"); 
    setSearchTerm("");

    if (view.filters) {
      if (view.filters.status && view.filters.status.length > 0) {
        setStatusFilter(view.filters.status); // Assuming statusFilter can take an array for multi-select
      } else {
        setStatusFilter("all");
      }
    }
    if (view.sort_by) setSortBy(view.sort_by);
    if (view.sort_order) setSortOrder(view.sort_order);
    if (view.visible_columns) {
      setVisibleColumns(view.visible_columns);
    }
    // Always respect the view's view_type if it exists, otherwise default to kanban
    if (view.view_type) {
      setViewType(view.view_type);
    } else {
      setViewType("kanban"); // Fallback to kanban
    }
    setCurrentPage(1); // Reset pagination when view is applied
  };

  const handleHighlightSubmission = (submission) => {
    setHighlightedSubmission(submission);
    setHighlightedChanges({});
    setSelectedSubmission(null);
  };

  const updateHighlightedField = (field, value) => {
    setHighlightedChanges(prev => ({ ...prev, [field]: value }));
  };

  const saveHighlightedChanges = async () => {
    if (!highlightedSubmission || Object.keys(highlightedChanges).length === 0) return;
    
    setSavingHighlighted(true);
    try {
      // Store old data for automation comparison
      const oldData = { ...highlightedSubmission };
      
      await base44.entities.Submission.update(highlightedSubmission.id, highlightedChanges);
      
      // Execute automation rules if status changed
      if (highlightedChanges.status) {
        const newData = { ...highlightedSubmission, ...highlightedChanges };
        executeAutomationRules("Submission", highlightedSubmission.id, oldData, newData).catch(err => {
          console.warn("Automation execution failed:", err);
        });
      }
      
      const candidate = candidates.find(c => c.id === highlightedSubmission.candidate_id);
      const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}` : "Submission";
      addNotification({ 
        type: "success", 
        title: "Updated", 
        message: `${candidateName} submission updated successfully` 
      });
      setHighlightedSubmission(null);
      setHighlightedChanges({});
      loadSubmissions();
    } catch (error) {
      console.error("Error updating submission:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update submission" });
    }
    setSavingHighlighted(false);
  };

  const closeHighlightPanel = () => {
    setHighlightedSubmission(null);
    setHighlightedChanges({});
  };

  const statusOptions = [
    { value: "submitted", label: "Submitted", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "under_review", label: "Under Review", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { value: "interviewing", label: "Interviewing", color: "bg-purple-100 text-purple-800 border-purple-300" },
    { value: "rejected", label: "Rejected", color: "bg-red-100 text-red-800 border-red-300" },
    { value: "hired", label: "Hired", color: "bg-green-100 text-green-800 border-green-300" },
    { value: "withdrawn", label: "Withdrawn", color: "bg-slate-100 text-slate-800 border-slate-300" }
  ];

  const currentStatus = highlightedChanges.status || highlightedSubmission?.status || "submitted";

  const getHighlightedCandidateName = () => {
    if (!highlightedSubmission) return "";
    const candidate = candidates.find(c => c.id === highlightedSubmission.candidate_id);
    if (!candidate) return "Submission";
    return `${candidate.first_name} ${candidate.last_name}`;
  };

  const getHighlightedJobTitle = () => {
    if (!highlightedSubmission) return "";
    const job = jobs.find(j => j.id === highlightedSubmission.job_id);
    return job?.title || "Job";
  };

  const handleDeleteSubmission = async (id) => {
    if (!confirm("Are you sure you want to delete this submission?")) return;
    try {
      await base44.entities.Submission.delete(id);
      addNotification({ type: "success", title: "Deleted", message: "Application deleted successfully" });
      loadSubmissions();
    } catch (error) {
      console.error("Error deleting submission:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to delete application" });
    }
  };

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredAndSortedSubmissions = submissions.filter(submission => {
    const candidate = candidates.find(c => c.id === submission.candidate_id);
    const job = jobs.find(j => j.id === submission.job_id);
    
    const matchesSearch = !searchTerm || 
      (candidate && `${candidate.first_name} ${candidate.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job && job.title?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesStatus = true;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (Array.isArray(statusFilter)) {
      matchesStatus = statusFilter.length === 0 || statusFilter.includes(submission.status);
    } else {
      matchesStatus = submission.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (sortBy === "candidate_id") {
      const candA = candidates.find(c => c.id === a.candidate_id);
      const candB = candidates.find(c => c.id === b.candidate_id);
      aVal = candA ? `${candA.first_name} ${candA.last_name}` : "";
      bVal = candB ? `${candB.first_name} ${candB.last_name}` : "";
    } else if (sortBy === "job_id") {
      const jobA = jobs.find(j => j.id === a.job_id);
      const jobB = jobs.find(j => j.id === b.job_id); // Changed from c.id to j.id
      aVal = jobA?.title || "";
      bVal = jobB?.title || "";
    }
    
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // Calculate pagination for list view
  const totalPages = Math.ceil(filteredAndSortedSubmissions.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedSubmissions = filteredAndSortedSubmissions.slice(startIndex, endIndex);

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [submissions.length, searchTerm, statusFilter, sortBy, sortOrder]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when rows per page changes
  };

  const toggleSelectAllVisible = (checked) => {
    if (checked) {
      setSelectedIds(new Set(paginatedSubmissions.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const allVisibleSelected = paginatedSubmissions.length > 0 && paginatedSubmissions.every(s => selectedIds.has(s.id));
  const someVisibleSelected = paginatedSubmissions.some(s => selectedIds.has(s.id)) && !allVisibleSelected;

  const getStatusColor = (status) => {
    switch (status) {
      case "submitted": return "bg-blue-100 text-blue-800";
      case "under_review": return "bg-yellow-100 text-yellow-800";
      case "interviewing": return "bg-purple-100 text-purple-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "hired": return "bg-green-100 text-green-800";
      case "withdrawn": return "bg-slate-100 text-slate-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  // ── Derived metrics ──
  const openRoles = jobs.filter(j => j.status === "open").length;
  const filledThisMonth = (() => {
    const now = new Date();
    return submissions.filter(s => s.status === "hired" && new Date(s.submitted_date || s.created_date).getMonth() === now.getMonth() && new Date(s.submitted_date || s.created_date).getFullYear() === now.getFullYear()).length;
  })();
  const pipelineDepth = submissions.filter(s => !["rejected","withdrawn","hired"].includes(s.status)).length;
  const avgFillDays = (() => {
    const hired = submissions.filter(s => s.status === "hired" && s.submitted_date);
    if (!hired.length) return null;
    const avg = hired.reduce((sum, s) => sum + Math.floor((Date.now() - new Date(s.submitted_date)) / 86400000), 0) / hired.length;
    return Math.round(avg);
  })();

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background: "#F5F5F7", minHeight: "100vh" }}>

      {/* ── Metrics bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#fff", borderBottom: "1px solid #E5E5EA" }}>
        {[
          { label: "Open Roles",        value: loading ? "—" : openRoles,      sub: "actively hiring",    valColor: "#1D1D1F" },
          { label: "Filled This Month", value: loading ? "—" : filledThisMonth, sub: `+${filledThisMonth} vs last`, subColor: "#30A14E", valColor: "#30A14E" },
          { label: "Avg Time to Fill",  value: loading ? "—" : (avgFillDays != null ? avgFillDays + "d" : "—"), sub: "days", valColor: "#1D1D1F" },
          { label: "Pipeline Depth",    value: loading ? "—" : pipelineDepth,  sub: "active candidates",  valColor: "#0071E3" },
        ].map((m, i) => (
          <div key={i} style={{ padding: "22px 28px", borderRight: i < 3 ? "1px solid #E5E5EA" : "none" }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "#86868B", marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1, color: m.valColor || "#1D1D1F" }}>{m.value}</div>
            <div style={{ fontSize: 11.5, color: m.subColor || "#86868B", marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "#fff", borderBottom: "1px solid #E5E5EA", flexWrap: "wrap" }}>
        {/* View toggle */}
        <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginRight: 2 }}>View</span>
        {["kanban","list"].map(v => (
          <button key={v} onClick={() => setViewType(v)}
            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: viewType === v ? 600 : 500, border: "none", cursor: "pointer", background: viewType === v ? "#1D1D1F" : "#fff", color: viewType === v ? "#fff" : "#6E6E73", boxShadow: viewType === v ? "none" : "0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)", textTransform: "capitalize" }}>
            {v === "kanban" ? "Kanban" : "List"}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: "#E5E5EA", margin: "0 4px" }} />

        {/* Status filter pills */}
        <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginRight: 2 }}>Status</span>
        {[{k:"all",l:"All"},{k:"submitted",l:"Submitted"},{k:"under_review",l:"Screening"},{k:"interviewing",l:"Interviewing"},{k:"offered",l:"Offer"},{k:"hired",l:"Hired"},{k:"rejected",l:"Rejected"}].map(s => (
          <button key={s.k} onClick={() => { setStatusFilter(s.k); setCurrentPage(1); }}
            style={{ padding: "5px 13px", borderRadius: 20, fontSize: 13, fontWeight: statusFilter === s.k ? 600 : 500, border: "none", cursor: "pointer", background: statusFilter === s.k ? "#1D1D1F" : "#fff", color: statusFilter === s.k ? "#fff" : "#6E6E73", boxShadow: statusFilter === s.k ? "none" : "0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)", transition: "all 120ms" }}>
            {s.l}
          </button>
        ))}

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.06)", borderRadius: 10, padding: "5px 10px", marginLeft: 8 }}>
          <Search style={{ width: 13, height: 13, color: "#86868B" }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search applications…"
            style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#1D1D1F", width: 160 }} />
        </div>

        {/* Right actions */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => loadSubmissions()} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: "1px solid #E5E5EA", background: "#fff", color: "#6E6E73", cursor: "pointer" }}>
            Refresh
          </button>
          <PermissionGate entity="Submission" action="create">
            <button onClick={() => { setShowForm(true); setFormSubmission(null); setSelectedSubmission(null); setHighlightedSubmission(null); }}
              style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,113,227,.3)" }}>
              + Post Role
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Quick edit floating bar ── */}
      {highlightedSubmission && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1D1D1F", borderRadius: 16, padding: "14px 20px", boxShadow: "0 8px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 10, zIndex: 50, flexWrap: "wrap" }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{getHighlightedCandidateName()}</div>
          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>→ {getHighlightedJobTitle()}</div>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
          {statusOptions.map(o => (
            <button key={o.value} onClick={() => updateHighlightedField("status", o.value)}
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: currentStatus === o.value ? "#0071E3" : "rgba(255,255,255,.12)", color: "#fff" }}>
              {o.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
          <button onClick={saveHighlightedChanges} disabled={savingHighlighted || Object.keys(highlightedChanges).length === 0}
            style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: "#30A14E", color: "#fff", opacity: Object.keys(highlightedChanges).length === 0 ? .5 : 1 }}>
            {savingHighlighted ? "Saving…" : "Save"}
          </button>
          <button onClick={closeHighlightPanel} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── Content area ── */}
      <div style={{ padding: "20px 24px 60px" }}>

      {viewType === "kanban" ? (
        <KanbanBoard
          submissions={filteredAndSortedSubmissions}
          candidates={candidates}
          jobs={jobs}
          companies={companies}
          onSubmissionClick={setSelectedSubmission}
          onRefresh={loadSubmissions}
          onAddNew={() => { setShowForm(true); setFormSubmission(null); }}
        />
      ) : viewType === "list" && loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#0071E3" }} />
          <div style={{ fontSize: 13 }}>Loading applications…</div>
        </div>
      ) : viewType === "list" && paginatedSubmissions.length > 0 ? (
        <>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1.8fr 1.4fr 120px 120px 120px 36px", padding: "9px 20px", borderBottom: "1px solid #E5E5EA", background: "#FAFAFA" }}>
              {["", "CANDIDATE", "JOB", "STATUS", "SUBMITTED", "MATCH", ""].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".04em", color: "#86868B", display: "flex", alignItems: "center", gap: i === 0 ? 0 : 0 }}>
                  {i === 0 ? <Checkbox checked={allVisibleSelected} onCheckedChange={c => toggleSelectAllVisible(!!c)} /> : h}
                </div>
              ))}
            </div>

            {paginatedSubmissions.map((submission, idx) => {
              const candidate = candidates.find(c => c.id === submission.candidate_id);
              const job = jobs.find(j => j.id === submission.job_id);
              const company = companies.find(c => c.id === job?.company_id);
              const candName = candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown";
              const sb = { submitted:{bg:"rgba(59,130,246,.12)",c:"#2563EB"}, under_review:{bg:"rgba(245,158,11,.12)",c:"#D97706"}, interviewing:{bg:"rgba(139,92,246,.12)",c:"#7C3AED"}, offered:{bg:"rgba(16,185,129,.12)",c:"#059669"}, hired:{bg:"rgba(48,161,78,.12)",c:"#16A34A"}, rejected:{bg:"rgba(239,68,68,.12)",c:"#DC2626"}, withdrawn:{bg:"rgba(107,114,128,.12)",c:"#6B7280"} }[submission.status] || {bg:"rgba(0,0,0,.06)",c:"#86868B"};
              const avatarPalette = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#EF4444,#DC2626"];
              const p = avatarPalette[(candName?.charCodeAt(0)||0) % avatarPalette.length].split(",");
              const grad = `linear-gradient(135deg,${p[0]},${p[1]})`;
              const ini = candName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

              return (
                <div key={submission.id} onClick={() => setSelectedSubmission(submission)}
                  style={{ display: "grid", gridTemplateColumns: "40px 1.8fr 1.4fr 120px 120px 120px 36px", padding: "10px 20px", borderBottom: idx < paginatedSubmissions.length - 1 ? "1px solid #F2F2F7" : "none", alignItems: "center", cursor: "pointer", background: highlightedSubmission?.id === submission.id ? "rgba(0,113,227,.04)" : "transparent", transition: "background 100ms" }}
                  onMouseEnter={e => { if (highlightedSubmission?.id !== submission.id) e.currentTarget.style.background = "#F9F9FB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = highlightedSubmission?.id === submission.id ? "rgba(0,113,227,.04)" : "transparent"; }}>
                  <div onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(submission.id)} onCheckedChange={() => toggleSelect(submission.id)} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: grad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ini}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{candName}</div>
                      <div style={{ fontSize: 11.5, color: "#86868B" }}>{candidate?.current_title || candidate?.email || "—"}</div>
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job?.title || "—"}</div>
                    <div style={{ fontSize: 11.5, color: "#86868B" }}>{company?.name || job?.hiring_manager || "—"}</div>
                  </div>
                  <div><span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sb.bg, color: sb.c }}>{(submission.status||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</span></div>
                  <div style={{ fontSize: 12, color: "#86868B" }}>{submission.submitted_date ? new Date(submission.submitted_date).toLocaleDateString() : "—"}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: submission.match_score != null ? "#0071E3" : "#AEAEB2" }}>{submission.match_score != null ? submission.match_score : "—"}</div>
                  <div onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#86868B" }} className="hover:bg-black/[.07]">
                          <MoreVertical style={{ width: 14, height: 14 }} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedSubmission(submission)}><Eye className="w-4 h-4 mr-2"/>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleHighlightSubmission(submission)}><Zap className="w-4 h-4 mr-2"/>Quick Edit</DropdownMenuItem>
                        {can("Submission","update") && <DropdownMenuItem onClick={() => { setFormSubmission(submission); setShowForm(true); }}><Edit className="w-4 h-4 mr-2"/>Edit</DropdownMenuItem>}
                        {can("Submission","delete") && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => handleDeleteSubmission(submission.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2"/>Delete</DropdownMenuItem></>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, fontSize: 13, color: "#86868B" }}>
              <span>Showing {startIndex + 1}–{Math.min(startIndex + rowsPerPage, filteredAndSortedSubmissions.length)} of {filteredAndSortedSubmissions.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
                  style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #E5E5EA", background: "#fff", color: currentPage === 1 ? "#AEAEB2" : "#1D1D1F", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13 }}>← Prev</button>
                <span style={{ fontSize: 12 }}>Page {currentPage} of {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
                  style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #E5E5EA", background: "#fff", color: currentPage >= totalPages ? "#AEAEB2" : "#1D1D1F", cursor: currentPage >= totalPages ? "default" : "pointer", fontSize: 13 }}>Next →</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: 60, textAlign: "center" }}>
          <Send style={{ width: 36, height: 36, color: "#AEAEB2", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1D1D1F", marginBottom: 6 }}>No applications found</div>
          <div style={{ fontSize: 13, color: "#86868B", marginBottom: 16 }}>{searchTerm || statusFilter !== "all" ? "Try adjusting your search or filters" : "No submissions in the past month"}</div>
          <PermissionGate entity="Submission" action="create">
            <button onClick={() => { setShowForm(true); setFormSubmission(null); }} style={{ padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer" }}>
              + New Application
            </button>
          </PermissionGate>
        </div>
      )}

      </div>{/* end content area */}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {formSubmission ? "Edit Application" : "New Application"}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setFormSubmission(null); }}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <SubmissionForm
                submission={formSubmission}
                candidates={candidates}
                jobs={jobs}
                onSuccess={() => {
                  setShowForm(false);
                  setFormSubmission(null);
                  loadSubmissions();
                }}
                onCancel={() => { setShowForm(false); setFormSubmission(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {showViewSettings && (
        <ViewSettingsModal
          open={showViewSettings}
          onClose={() => setShowViewSettings(false)}
          initial={activeView || { name: "", view_type: "kanban", columns: ["submitted","under_review","interviewing","rejected","hired","withdrawn"], filters: { status: [] }, visibility: "private" }}
          onSave={async (viewData) => {
            try {
              if (viewData.id) {
                await base44.entities.SubmissionView.update(viewData.id, viewData);
              } else {
                await base44.entities.SubmissionView.create(viewData);
              }
              loadSubmissions();
              setShowViewSettings(false);
              addNotification({ type: "success", title: "Saved", message: "View saved successfully" });
            } catch (error) {
              console.error("Error saving view:", error);
              addNotification({ type: "error", title: "Error", message: "Failed to save view" });
            }
          }}
        />
      )}

      {selectedSubmission && (
        <div className="fixed inset-y-0 right-0 z-[100] pointer-events-auto">
          <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-slate-900">Application Details</h3>
              <button onClick={() => setSelectedSubmission(null)} className="p-2 rounded hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[calc(100%-56px)] overflow-auto p-4">
              {(() => {
                const candidate = candidates.find(c => c.id === selectedSubmission.candidate_id);
                const job = jobs.find(j => j.id === selectedSubmission.job_id);
                return (
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Candidate</p>
                          <p className="font-medium">{candidate ? `${candidate.first_name} ${candidate.last_name}` : "—"}</p>
                          {candidate?.email && <p className="text-sm text-slate-600">{candidate.email}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Job</p>
                          <p className="font-medium">{job?.title || "—"}</p>
                          {job?.location && <p className="text-sm text-slate-600">{job.location}</p>}
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Status</p>
                          <Badge className={getStatusColor(selectedSubmission.status)}>
                            {selectedSubmission.status?.replace("_", " ")}
                          </Badge>
                        </div>
                        {selectedSubmission.submitted_date && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Submitted</p>
                            <p className="text-sm">{new Date(selectedSubmission.submitted_date).toLocaleDateString()}</p>
                          </div>
                        )}
                        {selectedSubmission.notes && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Notes</p>
                            <p className="text-sm text-slate-700">{selectedSubmission.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setFormSubmission(selectedSubmission);
                          setShowForm(true);
                          setSelectedSubmission(null);
                        }}
                        className="flex-1 gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedSubmission(null)}
                        className="flex-1"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubmissionsPage() {
  return (
    <PermissionsProvider>
      <SubmissionsPageContent />
    </PermissionsProvider>
  );
}