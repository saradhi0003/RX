import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Plus,
  Briefcase,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Users,
  Eye,
  Edit,
  MoreHorizontal,
  MailPlus,
  Upload,
  Trash2,
  Save,
  Loader2,
  X,
  Zap,
  RefreshCcw,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  FileText
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Job, Company, Recruiter, Candidate } from "@/entities/all";
import { supabase } from "@/lib/supabase";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PermissionGate from "@/components/common/PermissionGate";
import PageHeader from "@/components/common/PageHeader";
import EmailBlastModal from "../components/jobs/EmailBlastModal";
import ImportModal from "@/components/common/ImportModal";
import JobForm from "../components/jobs/JobForm";
import BulkJobPaste from "../components/jobs/BulkJobPaste";
import { usePermissions } from "@/components/common/PermissionsContext";
import { Checkbox } from "@/components/ui/checkbox";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import ListViewSettingsModal from "@/components/common/ListViewSettingsModal";
import { JobView } from "@/entities/JobView";
import JobsBulkUpdateModal from "../components/jobs/JobsBulkUpdateModal";
import { addNotification } from "@/components/notifications/NotificationToast";
import { emitEntityChanged } from "@/components/common/refreshBus";
import RecommendedCandidates from "../components/ai/RecommendedCandidates";

function exportJobsToCSV(rows) {
  const headers = [
    "Title", "Company", "Location", "Type", "Status", "Priority",
    "Skills Required", "Experience Min", "Experience Max",
    "Salary Range", "Openings", "Source", "Posted Date"
  ];
  const escape = (v) => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(j => [
      escape(j.title), escape(j.company_name), escape(j.location),
      escape(j.job_type), escape(j.status), escape(j.priority),
      escape(j.skills_required), escape(j.experience_min), escape(j.experience_max),
      escape(j.salary_range), escape(j.openings), escape(j.source),
      escape(j.created_date),
    ].join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `jobs_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [recruiters, setRecruiters] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [showEmailBlast, setShowEmailBlast] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [views, setViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState(null);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const [highlightedJob, setHighlightedJob] = useState(null);
  const [highlightedChanges, setHighlightedChanges] = useState({});
  const [savingHighlighted, setSavingHighlighted] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);

  const [viewType, setViewType] = useState("list");
  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [aiMatchesModalOpen, setAiMatchesModalOpen] = useState(false);
  const [selectedJobForMatches, setSelectedJobForMatches] = useState(null);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");

  const defaultVisibleColumns = [
    { key: "title", label: "Job Title", default: true },
    { key: "company_id", label: "Company", default: true },
    { key: "location", label: "Location", default: true },
    { key: "employment_type", label: "Employment Type", default: true },
    { key: "salary_range", label: "Salary Range", default: true },
    { key: "priority", label: "Priority", default: true },
    { key: "status", label: "Status", default: true },
    { key: "due_date", label: "Due Date", default: true },
  ];
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);

  const jobsGuard = useRef({ ts: 0, inFlight: false });
  const { listFilterFor, me } = usePermissions();

  const loadData = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && jobsGuard.current.inFlight) return;
    if (!force && now - jobsGuard.current.ts < 10000) return;
    jobsGuard.current.inFlight = true;
    setLoading(true);

    try {
      const jobFilter = listFilterFor("Job");
      const companyFilter = listFilterFor("Company");

      const [jobsData, companiesData] = await Promise.all([
        jobFilter ? Job.filter(jobFilter, `-${sortBy}`, 200) : Job.list(`-${sortBy}`, 200),
        companyFilter ? Company.filter(companyFilter, '-created_date', 100) : Company.list('-created_date', 100)
      ]);
      setJobs(jobsData);
      setCompanies(companiesData);
    } catch (error) {
      console.error("Error loading jobs:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to load jobs." });
    } finally {
      setLoading(false);
      jobsGuard.current.inFlight = false;
      jobsGuard.current.ts = Date.now();
    }
  }, [listFilterFor, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const loadViews = async () => {
      try {
        const list = await JobView.list();
        const visibleViews = list.filter(v => {
          if (me?.role === "admin") return true;
          if (v.created_by?.endsWith("admin")) return true;
          if (v.visibility === "team") return true;
          if (me && v.created_by === me.email) return true;
          return false;
        });
        setViews(visibleViews);
        const def = visibleViews.find(v => v.is_default) || visibleViews[0] || null;
        if (def) {
          setSelectedViewId(def.id);
          if (def.sort) {
            const order = def.sort.startsWith('-') ? 'desc' : 'asc';
            const by = def.sort.replace(/^-/, '');
            setSortBy(by);
            setSortOrder(order);
          } else {
            setSortBy("created_date");
            setSortOrder("desc");
          }
          if (def.columns && def.columns.length > 0) {
            setVisibleColumns(def.columns.map(colKey => defaultVisibleColumns.find(col => col.key === colKey) || { key: colKey, label: colKey.replace(/_/g, ' '), default: false }));
          } else {
            setVisibleColumns(defaultVisibleColumns);
          }
          if (def.type) {
            setViewType(def.type);
          } else {
            setViewType("list");
          }
        } else {
          setSelectedViewId(null);
          setSortBy("created_date");
          setSortOrder("desc");
          setVisibleColumns(defaultVisibleColumns);
          setViewType("list");
        }
      } catch (e) {
        console.error("Error loading job views:", e);
        addNotification({ type: "error", title: "Error", message: "Failed to load job views." });
        setViews([]);
        setSelectedViewId(null);
      }
    };
    loadViews();
  }, [me]);

  const sortedJobs = React.useMemo(() => {
    let currentJobs = [...jobs];
    if (sortBy) {
      currentJobs.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];

        if (sortBy === 'company_id') {
          valA = companies.find(c => c.id === a.company_id)?.name || '';
          valB = companies.find(c => c.id === b.company_id)?.name || '';
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA === null || valA === undefined) return sortOrder === 'asc' ? 1 : -1;
        if (valB === null || valB === undefined) return sortOrder === 'asc' ? -1 : 1;
        
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }
    return currentJobs;
  }, [jobs, sortBy, sortOrder, companies]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredJobs(sortedJobs);
      return;
    }

    const filtered = sortedJobs.filter(job =>
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCompanyName(job.company_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.required_skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredJobs(filtered);
  }, [searchTerm, sortedJobs, companies]);

  const handleSort = (columnKey) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnKey);
      setSortOrder("asc");
    }
  };

  const currentView = views.find(v => v.id === selectedViewId) || null;
  const viewStatuses = React.useMemo(() => {
    const s = currentView?.filters?.status;
    return Array.isArray(s) ? s : [];
  }, [currentView]);

  const visibleJobs = React.useMemo(
    () => (filteredJobs || []).filter(j => viewStatuses.length === 0 || viewStatuses.includes(j.status)),
    [filteredJobs, viewStatuses]
  );

  useEffect(() => { setSelectedIds(new Set()); }, [visibleJobs.length, loading]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  
  const toggleSelectAllVisible = (checked) => {
    if (checked) setSelectedIds(new Set(visibleJobs.map(j => j.id)));
    else setSelectedIds(new Set());
  };

  useEffect(() => {
    const loadEmailBlastData = async () => {
      if (!showEmailBlast) return;
      try {
        if (recruiters.length === 0) {
          const recs = await Recruiter.list();
          setRecruiters(recs || []);
        }
        if (candidates.length === 0) {
          const cands = await Candidate.list("-updated_date", 200);
          setCandidates(cands || []);
        }
      } catch (e) {
        console.error("Error loading email blast data:", e);
        addNotification({ type: "error", title: "Error", message: "Failed to load recruiter/candidate data." });
      }
    };
    loadEmailBlastData();
  }, [showEmailBlast, recruiters.length, candidates.length]);

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      await Job.delete(jobToDelete.id);
      setShowDelete(false);
      setJobToDelete(null);
      loadData(true);
      addNotification({ type: "success", title: "Deleted", message: `${jobToDelete.title} deleted successfully.` });
      emitEntityChanged("Job");
    } catch (e) {
      console.error("Failed to delete job:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to delete job." });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id => Job.delete(id)));
      setShowBulkDelete(false);
      setSelectedIds(new Set());
      loadData(true);
      addNotification({ type: "success", title: "Deleted", message: `${ids.length} job(s) deleted successfully.` });
      emitEntityChanged("Job");
    } catch (e) {
      console.error("Failed to bulk delete jobs:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to bulk delete jobs." });
    }
  };

  const saveJob = async (payload) => {
    try {
      let savedJob;
      if (editingJob) {
        savedJob = await Job.update(editingJob.id, payload);
        addNotification({ type: "success", title: "Updated", message: `${savedJob.title} updated successfully.` });
      } else {
        savedJob = await Job.create(payload);
        addNotification({ type: "success", title: "Created", message: `${savedJob.title} created successfully.` });
      }
      
      if (savedJob.status === 'open') {
        try {
          const syncResult = await supabase.functions.invoke('syncJobToCareers', {
            body: { job_id: savedJob.id }
          });
          
          if (syncResult.data?.success) {
            addNotification({ 
              type: "success", 
              title: "Published to Careers", 
              message: `${savedJob.title} is now visible on talentstack.org/careers` 
            });
          }
        } catch (syncError) {
          console.error("Failed to sync to careers page:", syncError);
          console.warn("Job saved but careers sync failed - can be retried manually");
        }
      }
      
      setShowJobForm(false);
      setEditingJob(null);
      loadData(true);
      emitEntityChanged("Job");
      return savedJob;
    } catch (error) {
      console.error("Error saving job:", error);
      addNotification({ type: "error", title: "Error", message: `Failed to save job: ${error.message}.` });
      throw error;
    }
  };

  const getCompanyName = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      open: "bg-green-100 text-green-800",
      on_hold: "bg-yellow-100 text-yellow-800",
      filled: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.draft;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority] || colors.medium;
  };

  const saveView = async (payload) => {
    try {
      let saved;
      if (payload.id) {
        saved = await JobView.update(payload.id, payload);
        setViews(prev => {
            const updatedViews = prev.map(v => v.id === saved.id ? saved : v);
            if (saved.is_default && selectedViewId !== saved.id) {
                setSelectedViewId(saved.id);
            }
            return updatedViews;
        });
        addNotification({ type: "success", title: "Updated", message: `View '${saved.name}' updated successfully.` });
      } else {
        saved = await JobView.create(payload);
        setViews(prev => [saved, ...prev]);
        setSelectedViewId(saved.id);
        addNotification({ type: "success", title: "Created", message: `View '${saved.name}' created successfully.` });
      }
      setShowViewSettings(false);
      if (saved.id === selectedViewId || !selectedViewId) {
        if (saved.sort) {
          const order = saved.sort.startsWith('-') ? 'desc' : 'asc';
          const by = saved.sort.replace(/^-/, '');
          setSortBy(by);
          setSortOrder(order);
        } else {
          setSortBy("created_date");
          setSortOrder("desc");
        }
        if (saved.columns && saved.columns.length > 0) {
          setVisibleColumns(saved.columns.map(colKey => defaultVisibleColumns.find(col => col.key === colKey) || { key: colKey, label: colKey.replace(/_/g, ' '), default: false }));
        } else {
          setVisibleColumns(defaultVisibleColumns);
        }
        if (saved.type) {
          setViewType(saved.type);
        } else {
          setViewType("list");
        }
      }
    } catch (e) {
      console.error("Error saving job view:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to save job view." });
    }
  };

  const jobStatusOptions = [
    { value: "draft", label: "Draft" },
    { value: "open", label: "Open" },
    { value: "on_hold", label: "On Hold" },
    { value: "filled", label: "Filled" },
    { value: "cancelled", label: "Cancelled" }
  ];

  const handleHighlightJob = (job) => {
    setHighlightedJob(job);
    setHighlightedChanges({});
    setSelectedJob(null);
  };

  const updateHighlightedField = (field, value) => {
    setHighlightedChanges(prev => ({ ...prev, [field]: value }));
  };

  const saveHighlightedChanges = async () => {
    if (!highlightedJob || Object.keys(highlightedChanges).length === 0) return;
    
    setSavingHighlighted(true);
    try {
      await Job.update(highlightedJob.id, highlightedChanges);
      addNotification({ 
        type: "success", 
        title: "Updated", 
        message: `${highlightedJob.title} updated successfully` 
      });
      setHighlightedJob(null);
      setHighlightedChanges({});
      loadData(true);
      emitEntityChanged("Job");
    } catch (error) {
      console.error("Error updating job:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update job" });
    }
    setSavingHighlighted(false);
  };

  const closeHighlightPanel = () => {
    setHighlightedJob(null);
    setHighlightedChanges({});
  };

  const statusOptions = [
    { value: "draft", label: "Draft", color: "bg-slate-100 text-slate-800 border-slate-300" },
    { value: "open", label: "Open", color: "bg-green-100 text-green-800 border-green-300" },
    { value: "on_hold", label: "On Hold", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    { value: "filled", label: "Filled", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  const priorityOptions = [
    { value: "low", label: "Low", color: "bg-slate-100 text-slate-800 border-slate-300" },
    { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "high", label: "High", color: "bg-orange-100 text-orange-800 border-orange-300" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  const currentStatus = highlightedChanges.status || highlightedJob?.status || "open";
  const currentPriority = highlightedChanges.priority || highlightedJob?.priority || "medium";

  const openAIMatchesModal = (job) => {
    setSelectedJobForMatches(job);
    setAiMatchesModalOpen(true);
  };

  const closeAIMatchesModal = () => {
    setAiMatchesModalOpen(false);
    setSelectedJobForMatches(null);
  };

  const totalPages = Math.ceil(visibleJobs.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedJobs = visibleJobs.slice(startIndex, endIndex);

  const allVisibleSelected = paginatedJobs.length > 0 && paginatedJobs.every(j => selectedIds.has(j.id));
  const someVisibleSelected = paginatedJobs.some(j => selectedIds.has(j.id)) && !allVisibleSelected;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy, sortOrder, selectedViewId, visibleJobs.length]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  // ── Derived metrics ──
  const openJobs = jobs.filter(j => j.status === "open").length;
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newThisWeek = jobs.filter(j => new Date(j.created_date) >= sevenDaysAgo).length;
  const urgentJobs = jobs.filter(j => j.priority === "urgent" || j.priority === "high").length;
  const filledJobs = jobs.filter(j => j.status === "filled").length;

  const allStatusFiltered = statusFilter === "all" ? visibleJobs : statusFilter === "urgent" ? visibleJobs.filter(j => j.priority === "urgent" || j.priority === "high") : visibleJobs.filter(j => j.status === statusFilter);
  const totalStatusPages = Math.ceil(allStatusFiltered.length / rowsPerPage);
  const paginatedStatusJobs = allStatusFiltered.slice(startIndex, startIndex + rowsPerPage);

  // ── Helpers ──
  const getInitials = (name) => name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";
  const avatarPalette = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#EF4444,#DC2626","#0EA5E9,#0284C7"];
  const avatarGrad = (name) => { const p = avatarPalette[(name?.charCodeAt(0)||0) % avatarPalette.length].split(","); return `linear-gradient(135deg,${p[0]},${p[1]})`; };
  const statusBadge = (s) => ({ open:{bg:"rgba(48,161,78,.12)",c:"#16A34A"}, draft:{bg:"rgba(0,0,0,.06)",c:"#94A3B8"}, on_hold:{bg:"rgba(244,130,15,.12)",c:"#D97706"}, filled:{bg:"rgba(0,113,227,.10)",c:"#9333EA"}, cancelled:{bg:"rgba(255,59,48,.10)",c:"#DC2626"} }[s] || {bg:"rgba(0,0,0,.06)",c:"#94A3B8"});
  const priorityBadge = (p) => ({ urgent:{bg:"rgba(255,59,48,.10)",c:"#DC2626"}, high:{bg:"rgba(244,130,15,.12)",c:"#D97706"}, medium:{bg:"rgba(0,113,227,.10)",c:"#9333EA"}, low:{bg:"rgba(0,0,0,.06)",c:"#94A3B8"} }[p] || {bg:"rgba(0,0,0,.06)",c:"#94A3B8"});
  const timeAgo = (d) => { const days = Math.floor((Date.now()-new Date(d))/86400000); return days===0?"Today":days===1?"1d ago":days<7?`${days}d ago`:`${Math.floor(days/7)}w ago`; };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>

      {/* ── Metrics bar ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", background:"#fff", borderBottom:"1px solid #E2E8F0" }}>
        {[
          { label:"Open Roles", value:loading?"—":openJobs, sub:"actively hiring" },
          { label:"New This Week", value:loading?"—":newThisWeek, sub:`+${newThisWeek} posted`, subColor:"#10B981" },
          { label:"High Priority", value:loading?"—":urgentJobs, sub:"urgent + high", valColor:"#D97706" },
          { label:"Filled", value:loading?"—":filledJobs, sub:"this pipeline" },
        ].map((m,i) => (
          <div key={i} style={{ padding:"22px 28px", borderRight:i<3?"1px solid #E2E8F0":"none" }}>
            <div style={{ fontSize:11.5, fontWeight:500, color:"#94A3B8", marginBottom:5 }}>{m.label}</div>
            <div style={{ fontSize:42, fontWeight:700, letterSpacing:"-.04em", lineHeight:1, color:m.valColor||"#0F172A" }}>{m.value}</div>
            <div style={{ fontSize:11.5, color:m.subColor||"#94A3B8", marginTop:6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 24px", background:"#fff", borderBottom:"1px solid #E2E8F0", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontWeight:600, color:"#94A3B8", marginRight:4 }}>Status</span>
        {[{k:"all",l:"All"},{k:"open",l:"Open"},{k:"draft",l:"Draft"},{k:"on_hold",l:"On Hold"},{k:"filled",l:"Filled"}].map(s => (
          <button key={s.k} onClick={() => { setStatusFilter(s.k); setCurrentPage(1); }}
            style={{ padding:"5px 13px", borderRadius:20, fontSize:13, fontWeight:statusFilter===s.k?600:500, border:"none", cursor:"pointer", background:statusFilter===s.k?"#0F172A":"#fff", color:statusFilter===s.k?"#fff":"#64748B", boxShadow:statusFilter===s.k?"none":"0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)", transition:"all 120ms" }}>
            {s.l}
          </button>
        ))}
        <button onClick={() => { setStatusFilter("urgent"); setCurrentPage(1); }}
          style={{ padding:"5px 13px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", background:statusFilter==="urgent"?"#D97706":"rgba(244,130,15,.10)", color:statusFilter==="urgent"?"#fff":"#D97706" }}>
          🔥 Urgent
        </button>

        {/* Search */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,.06)", borderRadius:10, padding:"5px 10px", marginLeft:8 }}>
          <Search style={{ width:13, height:13, color:"#94A3B8" }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search jobs…"
            style={{ border:"none", background:"transparent", outline:"none", fontSize:13, color:"#0F172A", width:160 }} />
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:500, border:"1px solid #E2E8F0", background:"#fff", color:"#64748B", cursor:"pointer" }}>More ▾</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => loadData(true)}><RefreshCcw className="w-4 h-4 mr-2" />Refresh</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmailBlast(true)}><MailPlus className="w-4 h-4 mr-2" />Email Blast</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkPaste(true)}><FileText className="w-4 h-4 mr-2" />Paste Requirement</DropdownMenuItem>
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkUpdate(true)}>Mass Update ({selectedIds.size})</DropdownMenuItem>}
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => {
                const sel = visibleJobs.filter(j => selectedIds.has(j.id));
                exportJobsToCSV(sel);
              }}>Export Selected ({selectedIds.size}) as CSV</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => exportJobsToCSV(visibleJobs)}>Export All ({visibleJobs.length}) as CSV</DropdownMenuItem>
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkDelete(true)} className="text-red-600">Delete Selected ({selectedIds.size})</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => { setSelectedViewId(null); setShowViewSettings(true); }}>+ New View</DropdownMenuItem>
              {selectedViewId && <DropdownMenuItem onClick={() => setShowViewSettings(true)}>Edit View</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionGate entity="Job" action="create">
            <button onClick={() => { setEditingJob(null); setShowJobForm(true); setSelectedJob(null); setHighlightedJob(null); }}
              style={{ padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", background:"#9333EA", color:"#fff", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,113,227,.3)" }}>
              + Add Job
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding:"20px 24px 40px" }}>
        <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 2px 12px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 140px 100px 110px 100px 80px 80px 36px", gap:0, padding:"9px 20px", borderBottom:"1px solid #E2E8F0", background:"#FAFAFA" }}>
            {["JOB","COMPANY","TYPE","PRIORITY","STATUS","RATE","ADDED",""].map((h,i) => (
              <div key={i} style={{ fontSize:11, fontWeight:600, letterSpacing:".04em", color:"#94A3B8", display:"flex", alignItems:"center", gap:i===0?8:0 }}>
                {i===0 && <Checkbox checked={allVisibleSelected} onCheckedChange={c=>toggleSelectAllVisible(!!c)} />}
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding:"48px", textAlign:"center", color:"#94A3B8" }}>
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color:"#9333EA" }} />
              <div style={{ fontSize:13 }}>Loading jobs…</div>
            </div>
          ) : paginatedStatusJobs.length === 0 ? (
            <div style={{ padding:"60px", textAlign:"center" }}>
              <Briefcase style={{ width:36, height:36, color:"#94A3B8", margin:"0 auto 12px" }} />
              <div style={{ fontSize:15, fontWeight:600, color:"#0F172A", marginBottom:6 }}>No jobs found</div>
              <div style={{ fontSize:13, color:"#94A3B8" }}>{searchTerm ? "Try adjusting your search" : "Add your first job to get started"}</div>
            </div>
          ) : paginatedStatusJobs.map((job, idx) => {
            const isSelected = selectedJob?.id === job.id;
            const sb = statusBadge(job.status);
            const pb = priorityBadge(job.priority);
            const compName = getCompanyName(job.company_id);

            return (
              <div key={job.id} onClick={() => setSelectedJob(job)}
                style={{ display:"grid", gridTemplateColumns:"1.6fr 140px 100px 110px 100px 80px 80px 36px", gap:0, padding:"10px 20px", borderBottom:idx<paginatedStatusJobs.length-1?"1px solid #F2F2F7":"none", alignItems:"center", cursor:"pointer", background:isSelected?"rgba(0,113,227,.05)":"transparent", transition:"background 100ms" }}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background="#F9F9FB"; }}
                onMouseLeave={e => { e.currentTarget.style.background=isSelected?"rgba(0,113,227,.05)":"transparent"; }}>

                {/* Job */}
                <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                  <Checkbox checked={selectedIds.has(job.id)} onCheckedChange={() => toggleSelect(job.id)} onClick={e=>e.stopPropagation()} />
                  <div style={{ width:32, height:32, borderRadius:8, background:avatarGrad(compName), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {getInitials(compName)}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"#0F172A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      <Link to={createPageUrl(`JobDetails?id=${job.id}`)} onClick={e=>e.stopPropagation()} style={{ color:"inherit", textDecoration:"none" }}>{job.title}</Link>
                    </div>
                    <div style={{ fontSize:11.5, color:"#94A3B8" }}>{job.location || "Remote"}</div>
                  </div>
                </div>
                <div style={{ fontSize:12.5, color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{compName}</div>
                <div style={{ fontSize:12, color:"#64748B" }}>{(job.employment_type||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase()) || "—"}</div>
                <div><span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:pb.bg, color:pb.c }}>{(job.priority||"").replace(/\b\w/g,l=>l.toUpperCase()) || "—"}</span></div>
                <div><span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sb.bg, color:sb.c }}>{(job.status||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</span></div>
                <div style={{ fontSize:12.5, color:"#64748B" }}>{job.rate || "—"}</div>
                <div style={{ fontSize:12, color:"#94A3B8" }}>{job.created_date ? timeAgo(job.created_date) : "—"}</div>
                <div onClick={e=>e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"none", cursor:"pointer", color:"#94A3B8" }} className="hover:bg-black/[.07]">
                        <MoreHorizontal style={{ width:14, height:14 }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to={createPageUrl(`JobDetails?id=${job.id}`)}><Eye className="w-4 h-4 mr-2"/>View Details</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={()=>{setEditingJob(job);setShowJobForm(true);}}><Edit className="w-4 h-4 mr-2"/>Edit Job</DropdownMenuItem>
                      <DropdownMenuItem onClick={()=>handleHighlightJob(job)}><Zap className="w-4 h-4 mr-2"/>Quick Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={()=>openAIMatchesModal(job)}><Sparkles className="w-4 h-4 mr-2"/>AI Matches</DropdownMenuItem>
                      <PermissionGate entity="Job" action="delete">
                        <DropdownMenuItem className="text-red-600" onClick={()=>{setJobToDelete(job);setShowDelete(true);}}><Trash2 className="w-4 h-4 mr-2"/>Delete</DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More button */}
        {!loading && currentPage < totalStatusPages && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:24, marginBottom:20 }}>
            <button onClick={()=>goToPage(currentPage+1)}
              style={{ padding:"8px 24px", borderRadius:20, border:"1px solid #E2E8F0", background:"#fff", color:"#9333EA", cursor:"pointer", fontSize:13, fontWeight:600, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Quick Edit floating bar */}
      {highlightedJob && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#0F172A", borderRadius:16, padding:"14px 20px", boxShadow:"0 8px 32px rgba(0,0,0,.28)", display:"flex", alignItems:"center", gap:10, zIndex:50, flexWrap:"wrap" }}>
          <div style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{highlightedJob.title}</div>
          <div style={{ width:1, height:18, background:"rgba(255,255,255,.15)" }} />
          {statusOptions.map(o => <button key={o.value} onClick={()=>updateHighlightedField("status",o.value)} style={{ padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:currentStatus===o.value?"#9333EA":"rgba(255,255,255,.12)", color:"#fff" }}>{o.label}</button>)}
          <div style={{ width:1, height:18, background:"rgba(255,255,255,.15)" }} />
          <button onClick={saveHighlightedChanges} disabled={savingHighlighted||Object.keys(highlightedChanges).length===0}
            style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:"#10B981", color:"#fff", opacity:Object.keys(highlightedChanges).length===0?.5:1 }}>
            {savingHighlighted?"Saving…":"Save"}
          </button>
          <button onClick={closeHighlightPanel} style={{ background:"none", border:"none", color:"rgba(255,255,255,.5)", cursor:"pointer", fontSize:16 }}>✕</button>
        </div>
      )}

      {showEmailBlast && (
        <EmailBlastModal
          open={showEmailBlast}
          onClose={() => setShowEmailBlast(false)}
          jobs={jobs}
          recruiters={recruiters}
          candidates={candidates}
        />
      )}

      {showJobForm && (
        <JobForm
          job={editingJob}
          onSave={saveJob}
          onCancel={() => { setShowJobForm(false); setEditingJob(null); }}
        />
      )}

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          entityName="Jobs"
          entitySdk={Job}
          onImported={() => { setShowImport(false); loadData(true); }}
        />
      )}

      {showBulkPaste && (
        <BulkJobPaste
          open={showBulkPaste}
          onClose={() => setShowBulkPaste(false)}
          onSuccess={() => {
            setShowBulkPaste(false);
            loadData(true);
          }}
          companies={companies}
        />
      )}

      {showDelete && jobToDelete && (
        <DeleteConfirmModal
          open={showDelete}
          title="Delete Job"
          message={`Are you sure you want to delete "${jobToDelete.title}"? This action cannot be undone.`}
          confirmLabel="Delete Job"
          onConfirm={handleDeleteJob}
          onCancel={() => { setShowDelete(false); setJobToDelete(null); }}
        />
      )}

      {showBulkDelete && selectedIds.size > 0 && (
        <DeleteConfirmModal
          open={showBulkDelete}
          title="Delete Selected Jobs"
          message={`Are you sure you want to delete ${selectedIds.size} selected job(s)? This action cannot be undone.`}
          confirmLabel="Delete Jobs"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}

      <ListViewSettingsModal
        open={showViewSettings}
        onClose={() => setShowViewSettings(false)}
        initial={currentView || { name: "", filters: { status: [] }, visibility: "private", sort: "-created_date", type: "list", columns: defaultVisibleColumns.map(c => c.key) }}
        statusOptions={jobStatusOptions}
        columnOptions={defaultVisibleColumns}
        onSave={saveView}
      />

      {showBulkUpdate && (
        <JobsBulkUpdateModal
          open={showBulkUpdate}
          onClose={() => setShowBulkUpdate(false)}
          selectedIds={selectedIds}
          onComplete={() => {
            setShowBulkUpdate(false);
            setSelectedIds(new Set());
            loadData(true);
          }}
        />
      )}

      {aiMatchesModalOpen && selectedJobForMatches && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>AI Recommended Candidates</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  For: {selectedJobForMatches.title}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeAIMatchesModal}>
                <X className="w-5 h-5" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-6">
              <RecommendedCandidates job={selectedJobForMatches} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}