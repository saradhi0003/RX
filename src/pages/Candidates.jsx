import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Eye,
  Edit,
  Upload,
  Users,
  MoreHorizontal,
  Trash,
  RefreshCcw,
  X,
  Loader2,
  Save,
  Zap,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Trash2,
  ChevronsLeft, // Added for pagination
  ChevronsRight, // Added for pagination
  ChevronLeft, // Added for pagination
  ChevronRight // Added for pagination
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from "@/api/base44Client";
import CandidateForm from "../components/candidates/CandidateForm";
import CandidateDetails from "../components/candidates/CandidateDetails";
import PermissionGate from "@/components/common/PermissionGate";
import PageHeader from "@/components/common/PageHeader";
import ImportModal from "@/components/common/ImportModal";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import CandidatesBulkUpdateModal from "@/components/candidates/CandidatesBulkUpdateModal";
import { usePermissions } from "@/components/common/PermissionsContext";
import ListViewSettingsModal from "@/components/common/ListViewSettingsModal";
import RightPreviewPanel from "@/components/common/RightPreviewPanel";
import CandidatePreviewWithLoader from "@/components/candidates/CandidatePreviewWithLoader";
import BulkBenchScorer from "@/components/ai/BulkBenchScorer";
import { emitEntityChanged, useEntityAutoRefresh } from "@/components/common/refreshBus";
import { addNotification } from "@/components/notifications/NotificationToast";
import { SkeletonTable } from "@/components/common/SkeletonLoader";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import BulkResumeUpload from "@/components/candidates/BulkResumeUpload";
import PasteToAddCandidate from "../components/candidates/PasteToAddCandidate";

const EmailModal = ({ open, onClose, recipient }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Send Email to {recipient?.first_name} {recipient?.last_name}</h3>
        <p>This is a placeholder for the email modal.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose}>Send</Button>
        </div>
      </div>
    </div>
  );
};

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);

  const [views, setViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState(null);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [showDeleteViewConfirm, setShowDeleteViewConfirm] = useState(false);

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showBenchScorer, setShowBenchScorer] = useState(false);
  const [showBulkResumeUpload, setShowBulkResumeUpload] = useState(false);
  const [showPasteToAdd, setShowPasteToAdd] = useState(false);

  const [highlightedCandidate, setHighlightedCandidate] = useState(null);
  const [highlightedChanges, setHighlightedChanges] = useState({});
  const [savingHighlighted, setSavingHighlighted] = useState(false);

  const [viewType, setViewType] = useState("list");
  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState(null);

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [stageFilter, setStageFilter] = useState("all");

  const navigate = useNavigate();
  const { listFilterFor, me, role, isAdmin, can } = usePermissions();

  const loadGuard = useRef({ ts: 0, inFlight: false });

  useEntityAutoRefresh("Candidate", () => loadCandidates(true));

  const filterCandidates = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredCandidates(candidates);
      return;
    }
    const filtered = candidates.filter(candidate =>
      `${candidate.first_name} ${candidate.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.current_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCandidates(filtered);
  }, [searchTerm, candidates]);

  const loadCandidates = useCallback(async (force = false) => {
    const now = Date.now();
    if (loadGuard.current.inFlight) {
      return;
    }
    if (!force && now - loadGuard.current.ts < 30000) {
      return;
    }

    loadGuard.current.inFlight = true;
    setLoading(true);

    const cacheKey = `candidates_cache_${me?.email || "anon"}`;
    const serveFromCache = () => {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.ts && now - parsed.ts < 60 * 1000 && Array.isArray(parsed.data)) {
            setCandidates(parsed.data);
            setFilteredCandidates(parsed.data);
            return true;
          }
        }
      } catch (e) {
        console.error("Error parsing candidates cache:", e);
      }
      return false;
    };

    try {
      const filter = listFilterFor("Candidate");
      // CHANGED: Limit to 200 for better performance, pagination handles rest
      const data = filter
        ? await base44.entities.Candidate.filter(filter, "-created_date", 200)
        : await base44.entities.Candidate.list("-created_date", 200);
      
      console.log(`✅ Loaded ${data.length} candidates from database`);
      
      setCandidates(data);
      setFilteredCandidates(data);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
      } catch (e) {
        console.error("Error writing candidates to cache:", e);
      }
    } catch (error) {
      console.warn("Error loading candidates from API:", error?.message || error);
      if (!serveFromCache()) {
        setCandidates([]);
        setFilteredCandidates([]);
      }
    } finally {
      setLoading(false);
      loadGuard.current.inFlight = false;
      loadGuard.current.ts = Date.now();
    }
  }, [listFilterFor, me?.email]);

  const handleHighlightCandidate = (candidate) => {
    setHighlightedCandidate(candidate);
    setHighlightedChanges({});
    setSelectedCandidate(null);
  };

  const updateHighlightedField = (field, value) => {
    setHighlightedChanges(prev => ({ ...prev, [field]: value }));
  };

  const saveHighlightedChanges = async () => {
    if (!highlightedCandidate || Object.keys(highlightedChanges).length === 0) return;

    setSavingHighlighted(true);
    try {
      await base44.entities.Candidate.update(highlightedCandidate.id, highlightedChanges);
      addNotification({
        type: "success",
        title: "Updated",
        message: `${highlightedCandidate.first_name} ${highlightedCandidate.last_name} updated successfully`
      });
      setHighlightedCandidate(null);
      setHighlightedChanges({});
      loadCandidates(true);
      emitEntityChanged("Candidate");
    } catch (error) {
      console.error("Error updating candidate:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update candidate" });
    }
    setSavingHighlighted(false);
  };

  const closeHighlightPanel = () => {
    setHighlightedCandidate(null);
    setHighlightedChanges({});
  };

  useEffect(() => {
    const loadViews = async () => {
      try {
        const list = await base44.entities.CandidateView.list();
        const myRoleName = (me?.role || "").toLowerCase();
        const myAccessName = (role?.name || "").toLowerCase();

        const visibleViews = list.filter(v => {
          if (me?.role === "admin") return true;
          if (v.created_by === me?.email) return true;
          if (v.visibility === "team" || v.visibility === "public") return true;
          if (v.visibility === "role_admin" && myRoleName === "admin") return true;
          if (v.visibility === "role_user" && myRoleName === "user") return true;
          if (v.visibility === "role_recruiter" && myAccessName === "recruiter") return true;
          return false;
        });
        setViews(visibleViews);
        const def = visibleViews.find(v => v.is_default) || visibleViews[0] || null;
        if (def) setSelectedViewId(def.id);
      } catch (e) {
        console.error("Error loading candidate views:", e);
        setViews([]);
        setSelectedViewId(null);
      }
    };
    loadViews();
  }, [me, role]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allVisibleSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedIds.has(c.id));
  const someVisibleSelected = filteredCandidates.some(c => selectedIds.has(c.id)) && !allVisibleSelected;
  const toggleSelectAllVisible = (checked) => {
    if (checked) setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
    else setSelectedIds(new Set());
  };

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    filterCandidates();
  }, [filterCandidates]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [filteredCandidates.length, loading]);

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedViewId, sortBy, sortOrder, filteredCandidates.length]);


  const handleAddCandidate = async (candidateData) => {
    try {
      if (editingCandidate) {
        await base44.entities.Candidate.update(editingCandidate.id, candidateData);
        try { localStorage.setItem("candidate_cache_bust", String(Date.now())); } catch (_) {}
        window.dispatchEvent(new Event("candidate_cache_bust"));
        window.dispatchEvent(new CustomEvent("entity:Candidate:changed"));
        setEditingCandidate(null);
        setShowForm(false);
        loadCandidates(true);
        emitEntityChanged("Candidate");
        return;
      }
      await base44.entities.Candidate.create(candidateData);
      try { localStorage.setItem("candidate_cache_bust", String(Date.now())); } catch (_) {}
      window.dispatchEvent(new Event("candidate_cache_bust"));
      window.dispatchEvent(new CustomEvent("entity:Candidate:changed"));
      setShowForm(false);
      loadCandidates(true);
      emitEntityChanged("Candidate");
    } catch (error) {
      console.error("Error adding/updating candidate:", error);
    }
  };

  const handleEdit = (candidate) => {
    setSelectedCandidate(null);
    setHighlightedCandidate(null);
    setEditingCandidate(candidate);
    setShowForm(true);
  };

  const handleDeleteCandidate = async (candidateId) => {
    const candidateToDel = candidates.find(c => c.id === candidateId);
    if (!candidateToDel) return;
    setCandidateToDelete(candidateToDel);
    setShowDelete(true);
  };

  const deleteCandidate = async () => {
    if (!candidateToDelete) return;
    try {
      await base44.entities.Candidate.delete(candidateToDelete.id);
      addNotification({ type: "success", title: "Deleted", message: `${candidateToDelete.first_name} ${candidateToDelete.last_name} deleted.` });
      setShowDelete(false);
      setCandidateToDelete(null);
      loadCandidates(true);
      emitEntityChanged("Candidate");
    } catch (error) {
      console.error("Error deleting candidate:", error);
      addNotification({ type: "error", title: "Error", message: `Failed to delete ${candidateToDelete.first_name} ${candidateToDelete.last_name}.` });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id => base44.entities.Candidate.delete(id)));
      addNotification({ type: "success", title: "Deleted", message: `${ids.length} candidates deleted.` });
      setShowBulkDelete(false);
      setSelectedIds(new Set());
      loadCandidates(true);
      emitEntityChanged("Candidate");
    } catch (error) {
      console.error("Error bulk deleting candidates:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to delete selected candidates." });
    }
  };

  const statusOptions = [
    { value: "active", label: "Active", color: "bg-green-100 text-green-800 border-green-300" },
    { value: "our_bench", label: "Our Bench", color: "bg-purple-100 text-purple-800 border-purple-300" },
    { value: "screened", label: "Screened", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "placed", label: "Placed", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "inactive", label: "Inactive", color: "bg-gray-100 text-gray-800 border-gray-300" },
    { value: "do_not_contact", label: "Do Not Contact", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  const getCandidateStatusColor = (status) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option ? option.color : "bg-gray-100 text-gray-800 border-gray-300";
  };

  const currentView = views.find(v => v.id === selectedViewId) || null;
  const canDeleteCurrentView = !!currentView && (isAdmin || currentView.created_by === me?.email);
  const viewStatuses = Array.isArray(currentView?.filters?.status) ? currentView.filters.status : [];
  
  let filteredCandidatesWithView = filteredCandidates.filter(c =>
    viewStatuses.length === 0 || viewStatuses.includes(c.status)
  );

  const defaultColumns = [
    { key: "first_name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "current_title", label: "Current Role" },
    { key: "current_company", label: "Company" },
    { key: "experience_years", label: "Experience" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status" },
    { key: "bench_match_score", label: "Score" },
    { key: "skills", label: "Skills" },
    { key: "created_date", label: "Added Date" },
  ];

  const [visibleColumns, setVisibleColumns] = useState(defaultColumns.map(col => col.key));

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const filteredAndSorted = [...filteredCandidatesWithView].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
    if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? 1 : -1;
    if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? -1 : 1;
    return 0;
  });

  const saveView = async (payload) => {
    try {
      let savedView;
      if (payload.id) {
        savedView = await base44.entities.CandidateView.update(payload.id, payload);
        setViews(prevViews => prevViews.map(v => (v.id === savedView.id ? savedView : v)));
      } else {
        savedView = await base44.entities.CandidateView.create(payload);
        setViews(prevViews => [savedView, ...prevViews]);
        setSelectedViewId(savedView.id);
      }
      addNotification({ type: "success", title: "View Saved", message: `View "${savedView.name}" saved successfully.` });
      setShowViewSettings(false);
    } catch (e) {
      console.error("Error saving candidate view:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to save view." });
    }
  };

  const handleDeleteView = async () => {
    if (!currentView) return;
    try {
      await base44.entities.CandidateView.delete(currentView.id);
      setViews(prev => prev.filter(v => v.id !== currentView.id));
      setSelectedViewId(null);
      addNotification({ type: "success", title: "View Deleted", message: `View "${currentView.name}" deleted.` });
      setShowDeleteViewConfirm(false);
    } catch (e) {
      console.error("Error deleting candidate view:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to delete view." });
    }
  };

  const currentHighlightStatus = highlightedChanges.status || highlightedCandidate?.status || "active";

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSorted.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCandidates = filteredAndSorted.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  // ── Derived metrics (memoized) ──
  const { totalActive, newThisWeek, aiMatched, avgScore } = useMemo(() => {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const totalActive = candidates.filter(c => ["active","screened","our_bench"].includes(c.status)).length;
    const newThisWeek = candidates.filter(c => new Date(c.created_date) >= sevenDaysAgo).length;
    const aiMatched = candidates.filter(c => (c.bench_match_score || c.screening_score || 0) >= 90).length;
    const scores = candidates.map(c => c.bench_match_score || c.screening_score).filter(Boolean);
    const avgScore = scores.length ? Math.round(scores.reduce((a,b) => a+b,0) / scores.length) : 0;
    return { totalActive, newThisWeek, aiMatched, avgScore };
  }, [candidates]);

  const stageFilteredCandidates = useMemo(() => {
    if (stageFilter === "all") return filteredAndSorted;
    if (stageFilter === "ai90") return filteredAndSorted.filter(c => (c.bench_match_score || c.screening_score || 0) >= 90);
    return filteredAndSorted.filter(c => c.status === stageFilter);
  }, [stageFilter, filteredAndSorted]);
  const totalStagePages = Math.ceil(stageFilteredCandidates.length / rowsPerPage);
  const paginatedStage = stageFilteredCandidates.slice(startIndex, startIndex + rowsPerPage);

  // ── Helpers ──
  const getInitials = (c) => `${c.first_name?.[0]||""}${c.last_name?.[0]||""}`.toUpperCase();
  const avatarPalette = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#EF4444,#DC2626","#0EA5E9,#0284C7"];
  const avatarGrad = (c) => { const p = avatarPalette[(c.first_name?.charCodeAt(0)||0) % avatarPalette.length].split(","); return `linear-gradient(135deg,${p[0]},${p[1]})`; };
  const scoreColor = (s) => s >= 85 ? "#30A14E" : s >= 70 ? "#F4820F" : "#AEAEB2";
  const stageBadge = (status) => {
    const m = { screening:{bg:"rgba(244,130,15,.13)",c:"#D97706"}, interview:{bg:"rgba(48,161,78,.12)",c:"#16A34A"}, offer:{bg:"rgba(142,68,214,.12)",c:"#7C3AED"}, applied:{bg:"rgba(0,113,227,.10)",c:"#0071E3"}, hired:{bg:"rgba(10,142,130,.10)",c:"#0A8E82"}, rejected:{bg:"rgba(255,59,48,.10)",c:"#DC2626"}, active:{bg:"rgba(0,113,227,.10)",c:"#0071E3"}, our_bench:{bg:"rgba(142,68,214,.10)",c:"#7C3AED"}, on_bench:{bg:"rgba(244,130,15,.10)",c:"#D97706"}, placed:{bg:"rgba(10,142,130,.10)",c:"#0A8E82"}, inactive:{bg:"rgba(0,0,0,.06)",c:"#86868B"}, do_not_contact:{bg:"rgba(255,59,48,.08)",c:"#DC2626"} };
    return m[status] || {bg:"rgba(0,0,0,.06)",c:"#86868B"};
  };
  const timeAgo = (d) => { const days = Math.floor((Date.now()-new Date(d))/86400000); return days===0?"Today":days===1?"1d ago":days<7?`${days}d ago`:`${Math.floor(days/7)}w ago`; };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background:"#F5F5F7", minHeight:"100vh" }}>

      {/* ── Metrics bar ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", background:"#fff", borderBottom:"1px solid #E5E5EA" }}>
        {[
          { label:"Total Active", value: loading?"—":totalActive, sub:"in pipeline" },
          { label:"New This Week", value: loading?"—":newThisWeek, sub:`+${newThisWeek} vs prior week`, subColor:"#30A14E" },
          { label:"AI Matched ≥90%", value: loading?"—":aiMatched, sub:"strong fits", valColor:"#0071E3" },
          { label:"Avg Score", value: loading?"—":avgScore, suf:"%", sub:"across cohort" },
        ].map((m,i) => (
          <div key={i} style={{ padding:"22px 28px", borderRight:i<3?"1px solid #E5E5EA":"none" }}>
            <div style={{ fontSize:11.5, fontWeight:500, color:"#86868B", marginBottom:5 }}>{m.label}</div>
            <div style={{ fontSize:42, fontWeight:700, letterSpacing:"-.04em", lineHeight:1, color:m.valColor||"#1D1D1F" }}>
              {m.value}{m.suf&&<span style={{ fontSize:18, fontWeight:500, color:"#6E6E73" }}>{m.suf}</span>}
            </div>
            <div style={{ fontSize:11.5, color:m.subColor||"#86868B", marginTop:6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Stage pills + Add button ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 24px", background:"#fff", borderBottom:"1px solid #E5E5EA", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, fontWeight:600, color:"#86868B", marginRight:4 }}>Stage</span>
        {[{k:"all",l:"All"},{k:"active",l:"Applied"},{k:"screening",l:"Screening"},{k:"interview",l:"Interview"},{k:"offer",l:"Offer"}].map(s => (
          <button key={s.k} onClick={() => { setStageFilter(s.k); setCurrentPage(1); }}
            style={{ padding:"5px 13px", borderRadius:20, fontSize:13, fontWeight:stageFilter===s.k?600:500, border:"none", cursor:"pointer", background:stageFilter===s.k?"#1D1D1F":"#fff", color:stageFilter===s.k?"#fff":"#6E6E73", boxShadow:stageFilter===s.k?"none":"0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)", transition:"all 120ms" }}>
            {s.l}
          </button>
        ))}
        <button onClick={() => { setStageFilter("ai90"); setCurrentPage(1); }}
          style={{ padding:"5px 13px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", background:stageFilter==="ai90"?"#30A14E":"rgba(48,161,78,.10)", color:stageFilter==="ai90"?"#fff":"#30A14E", boxShadow:"0 1px 4px rgba(0,0,0,.06)" }}>
          ⚡ AI ≥90%
        </button>

        {/* Search */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,.06)", borderRadius:10, padding:"5px 10px", marginLeft:8 }}>
          <Search style={{ width:13, height:13, color:"#86868B" }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search…"
            style={{ border:"none", background:"transparent", outline:"none", fontSize:13, color:"#1D1D1F", width:160 }} />
        </div>

        {/* Right actions */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:500, border:"1px solid #E5E5EA", background:"#fff", color:"#6E6E73", cursor:"pointer" }}>More ▾</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => loadCandidates(true)}><RefreshCcw className="w-4 h-4 mr-2" />Refresh</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPasteToAdd(true)}><Zap className="w-4 h-4 mr-2" />Paste to Add</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBulkResumeUpload(true)}><Upload className="w-4 h-4 mr-2" />Bulk Upload</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowBenchScorer(true)}><Briefcase className="w-4 h-4 mr-2" />Bulk Scoring</DropdownMenuItem>
              {selectedIds.size > 0 && <DropdownMenuSeparator />}
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkUpdate(true)}>Mass Update ({selectedIds.size})</DropdownMenuItem>}
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkDelete(true)} className="text-red-600">Delete Selected ({selectedIds.size})</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSelectedViewId(null); setShowViewSettings(true); }}>+ New View</DropdownMenuItem>
              {selectedViewId && <DropdownMenuItem onClick={() => setShowViewSettings(true)}>Edit View</DropdownMenuItem>}
              {selectedViewId && canDeleteCurrentView && <DropdownMenuItem onClick={() => setShowDeleteViewConfirm(true)} className="text-red-600">Delete View</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionGate entity="Candidate" action="create">
            <button onClick={() => { setShowForm(true); setEditingCandidate(null); setSelectedCandidate(null); setHighlightedCandidate(null); }}
              style={{ padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", background:"#0071E3", color:"#fff", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,113,227,.3)" }}>
              + Add Candidate
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding:"20px 24px 40px" }}>
        <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 2px 12px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)", overflow:"hidden" }}>
          {/* Table header */}
          <div style={{ display:"grid", gridTemplateColumns:"1.8fr 130px 70px 130px 110px 80px 36px", gap:0, padding:"9px 20px", borderBottom:"1px solid #E5E5EA", background:"#FAFAFA" }}>
            {["CANDIDATE","COMPANY","SCORE","STAGE","ROLE","ADDED",""].map((h,i) => (
              <div key={i} style={{ fontSize:11, fontWeight:600, letterSpacing:".04em", color:"#86868B", display:"flex", alignItems:"center", gap:i===0?8:0 }}>
                {i===0 && <Checkbox checked={allVisibleSelected} onCheckedChange={c => toggleSelectAllVisible(!!c)} />}
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding:"48px", textAlign:"center", color:"#86868B" }}>
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color:"#0071E3" }} />
              <div style={{ fontSize:13 }}>Loading candidates…</div>
            </div>
          ) : paginatedStage.length === 0 ? (
            <div style={{ padding:"60px", textAlign:"center" }}>
              <Users style={{ width:36, height:36, color:"#AEAEB2", margin:"0 auto 12px" }} />
              <div style={{ fontSize:15, fontWeight:600, color:"#1D1D1F", marginBottom:6 }}>No candidates found</div>
              <div style={{ fontSize:13, color:"#86868B" }}>{searchTerm ? "Try adjusting your search" : "Add your first candidate to get started"}</div>
            </div>
          ) : paginatedStage.map((candidate, idx) => {
            const score = candidate.bench_match_score || candidate.screening_score;
            const isSelected = selectedCandidate?.id === candidate.id;
            const sb = stageBadge(candidate.status);

            return (
              <div key={candidate.id} onClick={() => setSelectedCandidate(candidate)}
                style={{ display:"grid", gridTemplateColumns:"1.8fr 130px 70px 130px 110px 80px 36px", gap:0, padding:"10px 20px", borderBottom:idx<paginatedStage.length-1?"1px solid #F2F2F7":"none", alignItems:"center", cursor:"pointer", background:isSelected?"rgba(0,113,227,.05)":"transparent", transition:"background 100ms" }}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background="#F9F9FB"; }}
                onMouseLeave={e => { e.currentTarget.style.background=isSelected?"rgba(0,113,227,.05)":"transparent"; }}>

                {/* Candidate */}
                <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                  <Checkbox checked={selectedIds.has(candidate.id)} onCheckedChange={() => toggleSelect(candidate.id)} onClick={e=>e.stopPropagation()} />
                  <div style={{ width:32, height:32, borderRadius:"50%", background:avatarGrad(candidate), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11.5, fontWeight:700, flexShrink:0 }}>
                    {getInitials(candidate)}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"#1D1D1F", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} onClick={e=>e.stopPropagation()} style={{ color:"inherit", textDecoration:"none" }}>
                        {candidate.first_name} {candidate.last_name}
                      </Link>
                      {score >= 90 && <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:6, background:"rgba(0,113,227,.10)", color:"#0071E3" }}>⚡{Math.round(score)}%</span>}
                    </div>
                    <div style={{ fontSize:11.5, color:"#86868B", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {[candidate.current_title, candidate.experience_years ? `${candidate.experience_years}yr` : null].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>

                {/* Company */}
                <div style={{ fontSize:12.5, color:"#6E6E73", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{candidate.current_company || "—"}</div>

                {/* Score */}
                <div style={{ fontSize:13, fontWeight:700, color:score?scoreColor(score):"#AEAEB2" }}>{score?`${Math.round(score)}%`:"—"}</div>

                {/* Stage */}
                <div>
                  <span style={{ display:"inline-block", fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sb.bg, color:sb.c, whiteSpace:"nowrap" }}>
                    {(candidate.status||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}
                  </span>
                </div>

                {/* Role */}
                <div style={{ fontSize:12.5, color:"#6E6E73", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {candidate.current_title ? candidate.current_title.split(" ").slice(0,2).join(" ") : "—"}
                </div>

                {/* Added */}
                <div style={{ fontSize:12, color:"#86868B" }}>{candidate.created_date ? timeAgo(candidate.created_date) : "—"}</div>

                {/* Actions */}
                <div onClick={e=>e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"none", cursor:"pointer", color:"#86868B" }} className="hover:bg-black/[.07]">
                        <MoreHorizontal style={{ width:14, height:14 }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(createPageUrl("CandidateDetails")+`?id=${candidate.id}`)}><Eye className="w-4 h-4 mr-2"/>View Details</DropdownMenuItem>
                      {can("Candidate","update") && <DropdownMenuItem onClick={()=>handleEdit(candidate)}><Edit className="w-4 h-4 mr-2"/>Edit</DropdownMenuItem>}
                      {can("Candidate","update") && <DropdownMenuItem onClick={()=>handleHighlightCandidate(candidate)}><Zap className="w-4 h-4 mr-2"/>Quick Edit</DropdownMenuItem>}
                      {candidate.email && <DropdownMenuItem onClick={()=>{setEmailRecipient(candidate);setEmailModalOpen(true);}}><Mail className="w-4 h-4 mr-2"/>Send Email</DropdownMenuItem>}
                      {can("Candidate","delete") && <><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>handleDeleteCandidate(candidate.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2"/>Delete</DropdownMenuItem></>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {!loading && stageFilteredCandidates.length > rowsPerPage && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:14, fontSize:13, color:"#86868B" }}>
            <span>Showing {startIndex+1}–{Math.min(startIndex+rowsPerPage, stageFilteredCandidates.length)} of {stageFilteredCandidates.length}</span>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button onClick={()=>goToPage(currentPage-1)} disabled={currentPage===1}
                style={{ padding:"5px 12px", borderRadius:20, border:"1px solid #E5E5EA", background:"#fff", color:currentPage===1?"#AEAEB2":"#1D1D1F", cursor:currentPage===1?"default":"pointer", fontSize:13 }}>← Prev</button>
              <span style={{ fontSize:12 }}>Page {currentPage} of {totalStagePages}</span>
              <button onClick={()=>goToPage(currentPage+1)} disabled={currentPage>=totalStagePages}
                style={{ padding:"5px 12px", borderRadius:20, border:"1px solid #E5E5EA", background:"#fff", color:currentPage>=totalStagePages?"#AEAEB2":"#1D1D1F", cursor:currentPage>=totalStagePages?"default":"pointer", fontSize:13 }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Edit panel ── */}
      {highlightedCandidate && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1D1D1F", borderRadius:16, padding:"16px 20px", boxShadow:"0 8px 32px rgba(0,0,0,.28)", display:"flex", alignItems:"center", gap:12, zIndex:50 }}>
          <div style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{highlightedCandidate.first_name} {highlightedCandidate.last_name}</div>
          <div style={{ width:1, height:20, background:"rgba(255,255,255,.15)" }} />
          {statusOptions.map(o => (
            <button key={o.value} onClick={()=>updateHighlightedField("status",o.value)}
              style={{ padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:currentHighlightStatus===o.value?"#0071E3":"rgba(255,255,255,.12)", color:"#fff" }}>
              {o.label}
            </button>
          ))}
          <div style={{ width:1, height:20, background:"rgba(255,255,255,.15)" }} />
          <button onClick={saveHighlightedChanges} disabled={savingHighlighted||Object.keys(highlightedChanges).length===0}
            style={{ padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, border:"none", cursor:"pointer", background:"#30A14E", color:"#fff", opacity:Object.keys(highlightedChanges).length===0?.5:1 }}>
            {savingHighlighted ? "Saving…" : "Save"}
          </button>
          <button onClick={closeHighlightPanel} style={{ background:"none", border:"none", color:"rgba(255,255,255,.5)", cursor:"pointer", fontSize:16 }}>✕</button>
        </div>
      )}

      {/* ── Right Preview Panel ── */}
      <RightPreviewPanel open={!!selectedCandidate && !showForm} title="Candidate Details" onClose={() => setSelectedCandidate(null)}>
         {selectedCandidate && (
           <CandidatePreviewWithLoader id={selectedCandidate.id} onEdit={handleEdit} onUpdated={() => { loadCandidates(true); }} />
         )}
       </RightPreviewPanel>

      {/* ── Modals ── */}
      {showForm && <CandidateForm candidate={editingCandidate} onSave={handleAddCandidate} onCancel={()=>{setShowForm(false);setEditingCandidate(null);}} />}
      {showImport && <ImportModal open={showImport} onClose={()=>setShowImport(false)} entityName="Candidates" entitySdk={base44.entities.Candidate} onImported={()=>{setShowImport(false);loadCandidates(true);emitEntityChanged("Candidate");}} />}
      {showDelete && candidateToDelete && <DeleteConfirmModal open={showDelete} title="Delete Candidate" message={`Delete ${candidateToDelete.first_name} ${candidateToDelete.last_name}?`} confirmLabel="Delete Candidate" onConfirm={deleteCandidate} onCancel={()=>{setShowDelete(false);setCandidateToDelete(null);}} />}
      {showBulkDelete && selectedIds.size>0 && <DeleteConfirmModal open={showBulkDelete} title="Delete Selected" message={`Delete ${selectedIds.size} candidate(s)?`} confirmLabel="Delete" onConfirm={handleBulkDelete} onCancel={()=>setShowBulkDelete(false)} />}
      {showBulkUpdate && selectedIds.size>0 && <CandidatesBulkUpdateModal open={showBulkUpdate} selectedIds={Array.from(selectedIds)} onClose={()=>{setShowBulkUpdate(false);setSelectedIds(new Set());}} onUpdated={()=>{loadCandidates(true);emitEntityChanged("Candidate");setShowBulkUpdate(false);setSelectedIds(new Set());}} />}
      <ListViewSettingsModal open={showViewSettings} onClose={()=>setShowViewSettings(false)} initial={currentView||{name:"",filters:{status:[]},visibility:"private",sort:"-created_date"}} statusOptions={statusOptions} onSave={saveView} availableColumns={defaultColumns} selectedColumns={visibleColumns} onColumnsChange={setVisibleColumns} />
      {showDeleteViewConfirm && currentView && <DeleteConfirmModal open={showDeleteViewConfirm} title="Delete View" message={`Delete "${currentView.name}"?`} confirmLabel="Delete View" onConfirm={handleDeleteView} onCancel={()=>setShowDeleteViewConfirm(false)} />}
      <BulkBenchScorer open={showBenchScorer} onClose={()=>setShowBenchScorer(false)} onDone={()=>{setShowBenchScorer(false);loadCandidates(true);emitEntityChanged("Candidate");}} />
      {emailModalOpen && emailRecipient && <EmailModal open={emailModalOpen} onClose={()=>{setEmailModalOpen(false);setEmailRecipient(null);}} recipient={emailRecipient} />}
      {showBulkResumeUpload && <BulkResumeUpload open={showBulkResumeUpload} onClose={()=>setShowBulkResumeUpload(false)} onComplete={()=>{setShowBulkResumeUpload(false);loadCandidates(true);}} />}
      {showPasteToAdd && <PasteToAddCandidate open={showPasteToAdd} onClose={()=>setShowPasteToAdd(false)} onSuccess={()=>{setShowPasteToAdd(false);loadCandidates(true);emitEntityChanged("Candidate");}} />}
    </div>
  );
}