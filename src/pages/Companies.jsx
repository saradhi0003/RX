import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  Plus,
  Building2,
  ExternalLink,
  Users,
  Briefcase,
  MoreHorizontal,
  Edit,
  Eye,
  Upload,
  MailPlus,
  Trash,
  ArrowUpDown,
  Save,         // NEW
  Loader2,      // NEW
  X,            // NEW
  Zap,          // NEW
  RefreshCcw,   // NEW
  MapPin,       // NEW
  ChevronUp,    // NEW
  ChevronDown,   // NEW
  ChevronsLeft,  // NEW
  ChevronsRight, // NEW
  ChevronLeft,   // NEW
  ChevronRight   // NEW
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
import { Company, Job } from "@/entities/all";
import { User } from "@/entities/User";
import CompanyForm from "../components/companies/CompanyForm";
import PermissionGate from "@/components/common/PermissionGate";
import PageHeader from "@/components/common/PageHeader";
import ImportModal from "@/components/common/ImportModal";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CompanyEmailBlastModal from "@/components/companies/CompanyEmailBlastModal";

import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import { usePermissions } from "@/components/common/PermissionsContext";
import ListViewSettingsModal from "@/components/common/ListViewSettingsModal";
import { CompanyView } from "@/entities/CompanyView";
import BulkUpdateModal from "@/components/companies/BulkUpdateModal";
import { Checkbox } from "@/components/ui/checkbox";
import useDebouncedValue from "@/components/common/useDebouncedValue";

// Placeholder for a notification system
const addNotification = ({ type, title, message }) => {
  console.log(`Notification (${type}): ${title} - ${message}`);
  // In a real app, you'd integrate with a toast library (e.g., react-hot-toast)
};

// Placeholder for an entity change event bus
const emitEntityChanged = (entityType) => {
  console.log(`Entity changed: ${entityType}`);
  // In a real app, this would trigger re-fetching or cache invalidation mechanisms
};

export default function CompaniesPage() { // Renamed component
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [showForm, setShowForm] = useState(false);
  const [formCompany, setFormCompany] = useState(null); // Renamed from editingCompany
  const [showImport, setShowImport] = useState(false);
  const [showEmailBlast, setShowEmailBlast] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [views, setViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState(null);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set()); // Changed to Set
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  const [highlightedCompany, setHighlightedCompany] = useState(null); // NEW
  const [highlightedChanges, setHighlightedChanges] = useState({}); // NEW
  const [savingHighlighted, setSavingHighlighted] = useState(false); // NEW
  const [selectedCompany, setSelectedCompany] = useState(null); // NEW: for general selection/preview
  const [viewType, setViewType] = useState("list"); // NEW: default view type

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [connStatusFilter, setConnStatusFilter] = useState("all");

  const { listFilterFor, me } = usePermissions();

  const loadCompanies = useCallback(async (force = false) => { // Renamed from loadData, added force parameter
    setLoading(true);
    try {
      const companyFilter = listFilterFor("Company");
      const [companiesData, jobsData, usersData] = await Promise.all([
        companyFilter ? Company.filter(companyFilter, "-created_date", 200) : Company.list("-created_date", 200),
        Job.list("-created_date", 100),
        User.list().catch(() => [])
      ]);
      setCompanies(companiesData);
      setJobs(jobsData);
      setUsers(usersData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  }, [listFilterFor]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Load views
  useEffect(() => {
    const loadViews = async () => {
      try {
        const list = await CompanyView.list().catch(() => []);
        // Show admin-created views to everyone, plus user's own views and team views
        const visibleViews = list.filter(v => {
          // If the current user is an admin, they see all views.
          if (me?.role === "admin") {
            return true;
          }
          // If the view was created by an email ending in "admin" (assumed admin-created)
          if (v.created_by?.endsWith("admin")) {
            return true;
          }
          // If the view's visibility is set to "team"
          if (v.visibility === "team") {
            return true;
          }
          // If the view was created by the current user (private view)
          if (me && v.created_by === me.email) {
            return true;
          }
          return false;
        });
        setViews(visibleViews);
        const def = visibleViews.find(v => v.is_default) || visibleViews[0] || null;
        if (def) setSelectedViewId(def.id);
      } catch (e) {
        console.error("Error loading company views:", e);
        setViews([]);
        setSelectedViewId(null);
      }
    };
    loadViews();
  }, [me]);

  // Build quick maps once (OPTIMIZE)
  const jobCounts = React.useMemo(() => {
    const map = new Map();
    for (const j of jobs) {
      if (j.status !== "open") continue;
      const key = j.company_id;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [jobs]);

  const usersMap = React.useMemo(() => {
    const m = new Map();
    (users || []).forEach(u => m.set(u.email, u.full_name || u.email));
    return m;
  }, [users]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setFilteredCompanies(companies);
      return;
    }
    const q = debouncedSearch.toLowerCase();
    const filtered = companies.filter(company =>
      company.name?.toLowerCase().includes(q) ||
      (company.industry || "").toLowerCase().includes(q) ||
      (company.location || "").toLowerCase().includes(q)
    );
    setFilteredCompanies(filtered);
  }, [debouncedSearch, companies]);

  const currentView = views.find(v => v.id === selectedViewId) || null;

  // NEW: sorting state derived from view.sort, adapted for new sortBy/sortOrder
  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    const s = (currentView?.sort || "-created_date");
    setSortBy(s.startsWith("-") ? s.slice(1) : s);
    setSortOrder(s.startsWith("-") ? "desc" : "asc");
  }, [currentView]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc"); // Default to ascending when changing sort field
    }
  };

  // NEW: columns visible (persisted on view)
  const defaultColumns = ["connection", "industry", "location", "primary_contact", "last_name", "contact_numbers", "open_jobs", "status", "created_by", "website", "job_stack_access"];

  // Enhanced filters summary
  const summarizeFilters = (view) => {
    if (!view) return "Default filters";
    const f = view.filters || {};
    const parts = [];
    if (Array.isArray(f.status) && f.status.length) parts.push(`status: ${f.status.join(", ")}`);
    if (f.industry_contains) parts.push(`industry~"${f.industry_contains}"`);
    if (f.location_contains) parts.push(`location~"${f.location_contains}"`);
    if (Array.isArray(f.created_by_in) && f.created_by_in.length) parts.push(`created by: ${f.created_by_in.length} user(s)`);
    if (f.has_website && f.has_website !== "any") parts.push(`website: ${f.has_website}`);
    return parts.length ? `Filters: ${parts.join(" | ")}` : "Default filters";
  };

  // apply filters from currentView
  const viewFilters = React.useMemo(() => currentView?.filters || {}, [currentView]);

  const filteredCompaniesWithView = React.useMemo(() => (filteredCompanies || []).filter(c => {
    const statusOk = !Array.isArray(viewFilters.status) || viewFilters.status.length === 0 || viewFilters.status.includes(c.status);
    const indOk = !viewFilters.industry_contains || (c.industry || "").toLowerCase().includes(String(viewFilters.industry_contains).toLowerCase());
    const locOk = !viewFilters.location_contains || (c.location || "").toLowerCase().includes(String(viewFilters.location_contains).toLowerCase());
    const createdOk = !Array.isArray(viewFilters.created_by_in) || viewFilters.created_by_in.length === 0 || viewFilters.created_by_in.includes(c.created_by);
    const web = viewFilters.has_website || "any";
    const webOk = web === "any" || (web === "yes" ? !!c.website : !c.website);
    return statusOk && indOk && locOk && createdOk && webOk;
  }), [filteredCompanies, viewFilters]);

  // NEW: sort rows client-side by selected field
  const sortedCompanies = React.useMemo(() => {
    const arr = [...filteredCompaniesWithView];
    const dirMul = sortOrder === "asc" ? 1 : -1;

    const getVal = (c) => {
      switch (sortBy) {
        case "name": return (c.name || "").toLowerCase();
        case "industry": return (c.industry || "").toLowerCase();
        case "location": return (c.location || "").toLowerCase();
        case "status": return (c.status || "").toLowerCase();
        case "created_date": return new Date(c.created_date).getTime() || 0;
        case "open_jobs":
          return jobCounts.get(c.id) || 0;
        case "created_by": return (c.created_by || "").toLowerCase();
        default: return (c[sortBy] ?? "").toString().toLowerCase();
      }
    };

    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return -1 * dirMul;
      if (va > vb) return 1 * dirMul;
      return 0;
    });
    return arr;
  }, [filteredCompaniesWithView, sortBy, sortOrder, jobCounts]);

  // Calculate pagination
  const totalPages = Math.ceil(sortedCompanies.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedCompanies = sortedCompanies.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, currentView, sortBy, sortOrder]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };


  // selection helpers (must come AFTER sortedCompanies is defined)
  const allVisibleSelected = sortedCompanies.length > 0 && selectedIds.size === sortedCompanies.length;
  const someVisibleSelected = selectedIds.size > 0 && selectedIds.size < sortedCompanies.length;

  const toggleSelectAllVisible = (checked) => {
    if (checked) setSelectedIds(new Set(sortedCompanies.map(c => c.id)));
    else setSelectedIds(new Set());
  };
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveView = async (payload) => {
    try {
      if (currentView) {
        const updated = await CompanyView.update(currentView.id, payload);
        setViews(views.map(v => (v.id === updated.id ? updated : v)));
      } else {
        const created = await CompanyView.create(payload);
        setViews([created, ...views]);
        setSelectedViewId(created.id);
      }
      setShowViewSettings(false);
    } catch (e) {
      console.error("Error saving company view:", e);
    }
  };

  const handleAddCompany = async (companyData) => {
    try {
      if (formCompany) { // Changed from editingCompany
        await Company.update(formCompany.id, companyData);
        setFormCompany(null); // Changed from editingCompany
      } else {
        await Company.create(companyData);
      }
      setShowForm(false);
      loadCompanies();
    } catch (error) {
      console.error(`Error ${formCompany ? 'updating' : 'adding'} company:`, error);
    }
  };

  const deleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await Company.delete(companyToDelete.id);
      setShowDelete(false);
      setCompanyToDelete(null);
      loadCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
    }
  };

  // bulk delete handler
  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) { setShowBulkDelete(false); return; } // Changed .length to .size
    setBulkDeleteLoading(true);
    try {
      for (const id of Array.from(selectedIds)) { // Iterate over Set
        await Company.delete(id);
        await new Promise((r) => setTimeout(r, 30));
      }
      setShowBulkDelete(false);
      setSelectedIds(new Set()); // Reset selectedIds
      loadCompanies();
    } catch (error) {
      console.error("Error during bulk delete:", error);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const getJobCount = (companyId) => jobCounts.get(companyId) || 0;

  // Updated statusOptions with color property
  const statusOptions = [
    { value: "active", label: "Active", color: "bg-green-100 text-green-800 border-green-300" },
    { value: "prospect", label: "Prospect", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "inactive", label: "Inactive", color: "bg-slate-100 text-slate-800 border-slate-300" }
  ];

  const typeOptions = [ // NEW
    { value: "client", label: "Client", color: "bg-purple-100 text-purple-800 border-purple-300" },
    { value: "internal", label: "Internal", color: "bg-indigo-100 text-indigo-800 border-indigo-300" }
  ];

  const getStatusColor = (status) => {
    const option = statusOptions.find(o => o.value === status);
    return option ? option.color : "bg-gray-100 text-gray-800"; // Fallback
  };

  const getUserLabel = (email) => usersMap.get(email) || email || "—";

  const getLastName = (fullName) => {
    if (!fullName) return "—";
    const parts = String(fullName).trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : "—";
  };
  const getPrimarySecondaryPhones = (contacts = []) => {
    if (!Array.isArray(contacts) || contacts.length === 0) return { primary: "—", secondary: "—" };
    const primary = contacts.find(c => c.is_primary);
    const nonPrimaryContacts = contacts.filter(c => !c.is_primary);
    const secondary = nonPrimaryContacts.length > 0 ? nonPrimaryContacts[0] : null;
    return {
      primary: primary?.phone || "—",
      secondary: secondary?.phone || "—"
    };
  };

  // NEW: column definitions to render dynamically
  const columnDefs = {
    connection: {
      key: "connection", // Added key
      label: "Connection",
      sortable: true,
      render: (company) => (
        <div>
          <button
            onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity: "Company", id: company.id } })); }}
            className="font-medium text-blue-600 hover:underline"
            title="Open connection"
          >
            {company.name}
          </button>
          <p className="text-sm text-slate-500">Added {new Date(company.created_date).toLocaleDateString()}</p>
        </div>
      )
    },
    industry: {
      key: "industry", // Added key
      label: "Industry",
      sortable: true,
      render: (c) => c.industry || "Not specified"
    },
    location: {
      key: "location", // Added key
      label: "Location",
      sortable: true,
      render: (c) => c.location || "Not specified"
    },
    primary_contact: {
      key: "primary_contact", // Added key
      label: "Primary Contact",
      sortable: false,
      render: (c) => {
        const p = c.contacts?.find(ct => ct.is_primary) || c.contacts?.[0];
        return p ? (
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-slate-600">{p.title}</p>
            <p className="text-sm text-slate-600">{p.email}</p>
          </div>
        ) : "No contact";
      }
    },
    last_name: {
      key: "last_name", // Added key
      label: "Last Name",
      sortable: false,
      render: (c) => {
        const p = c.contacts?.find(ct => ct.is_primary) || c.contacts?.[0];
        return getLastName(p?.name);
      }
    },
    contact_numbers: {
      key: "contact_numbers", // Added key
      label: "Contact Numbers",
      sortable: false,
      render: (c) => {
        const { primary, secondary } = getPrimarySecondaryPhones(c.contacts);
        return (
          <div className="text-sm">
            <div><span className="text-slate-500">Primary:</span> {primary}</div>
            <div><span className="text-slate-500">Secondary:</span> {secondary}</div>
          </div>
        );
      }
    },
    open_jobs: {
      key: "open_jobs", // Added key
      label: "Open Jobs",
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-1">
          <Briefcase className="w-3 h-3 text-slate-400" />
          {getJobCount(c.id)}
        </div>
      )
    },
    status: {
      key: "status", // Added key
      label: "Status",
      sortable: true,
      render: (c) => <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
    },
    created_by: {
      key: "created_by", // Added key
      label: "Created By",
      sortable: true,
      render: (c) => getUserLabel(c.created_by)
    },
    website: {
      key: "website", // Added key
      label: "Website",
      sortable: false,
      render: (c) => c.website ? (
        <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
          <ExternalLink className="w-3 h-3" />
          Visit
        </a>
      ) : "No website"
    },
    job_stack_access: {
      key: "job_stack_access", // Added key
      label: "Jobs Stack",
      sortable: false,
      render: (c) => c.job_stack_access ? <span className="text-green-600">Yes</span> : "No"
    }
  };

  // Convert visibleColumns keys to full column definition objects for rendering
  const finalVisibleColumns = React.useMemo(() => {
    const selectedKeys = Array.isArray(currentView?.columns) && currentView.columns.length
      ? currentView.columns
      : defaultColumns;
    return selectedKeys
      .map(key => columnDefs[key] ? { ...columnDefs[key], key } : null) // Ensure 'key' is in the object
      .filter(Boolean); // Filter out any nulls if a key doesn't exist in columnDefs
  }, [currentView, columnDefs]);

  const handleHighlightCompany = (company) => {
    setHighlightedCompany(company);
    setHighlightedChanges({});
    setSelectedCompany(null); // Clear general selection when highlighting
  };

  const updateHighlightedField = (field, value) => {
    setHighlightedChanges(prev => ({ ...prev, [field]: value }));
  };

  const saveHighlightedChanges = async () => {
    if (!highlightedCompany || Object.keys(highlightedChanges).length === 0) return;

    setSavingHighlighted(true);
    try {
      await Company.update(highlightedCompany.id, highlightedChanges);
      addNotification({
        type: "success",
        title: "Updated",
        message: `${highlightedCompany.name} updated successfully`
      });
      setHighlightedCompany(null);
      setHighlightedChanges({});
      loadCompanies(true);
      emitEntityChanged("Company");
    } catch (error) {
      console.error("Error updating company:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update company" });
    }
    setSavingHighlighted(false);
  };

  const closeHighlightPanel = () => {
    setHighlightedCompany(null);
    setHighlightedChanges({});
  };

  const currentStatus = highlightedChanges.status || highlightedCompany?.status || "prospect";
  const currentType = highlightedChanges.type || highlightedCompany?.type || "client"; // Assuming 'type' field for Company

  // Placeholder SkeletonTable component
  const SkeletonTablePlaceholder = () => (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <div className="h-4 w-4 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-28 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  <div className="h-4 w-12 bg-slate-200 rounded animate-pulse"></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Array.from({ length: 10 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="px-4 py-3"><div className="h-4 w-4 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-32 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 bg-slate-100 rounded animate-pulse"></div></td>
                  <td className="px-4 py-3 text-right"><div className="h-4 w-10 bg-slate-100 rounded animate-pulse ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );


  // ── Derived metrics ──
  const totalConnections = companies.length;
  const activeConnections = companies.filter(c => c.status === "active").length;
  const totalOpenJobs = jobs.filter(j => j.status === "open").length;
  const prospectConnections = companies.filter(c => c.status === "prospect").length;

  const connFiltered = connStatusFilter === "all" ? sortedCompanies : sortedCompanies.filter(c => c.status === connStatusFilter);
  const totalConnPages = Math.ceil(connFiltered.length / rowsPerPage);
  const paginatedConn = connFiltered.slice(startIndex, startIndex + rowsPerPage);

  // ── Helpers ──
  const avatarPalette = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#EF4444,#DC2626","#0EA5E9,#0284C7"];
  const avatarGrad = (name) => { const p = avatarPalette[(name?.charCodeAt(0)||0) % avatarPalette.length].split(","); return `linear-gradient(135deg,${p[0]},${p[1]})`; };
  const getInitials = (name) => name ? name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?";
  const connStatusBadge = (s) => ({ active:{bg:"rgba(48,161,78,.12)",c:"#16A34A"}, prospect:{bg:"rgba(0,113,227,.10)",c:"#9333EA"}, inactive:{bg:"rgba(0,0,0,.06)",c:"#94A3B8"} }[s] || {bg:"rgba(0,0,0,.06)",c:"#94A3B8"});
  const timeAgo = (d) => { const days = Math.floor((Date.now()-new Date(d))/86400000); return days===0?"Today":days===1?"1d ago":days<7?`${days}d ago`:`${Math.floor(days/7)}w ago`; };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background:"#F8FAFC", minHeight:"100vh" }}>

      {/* ── Metrics bar ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", background:"#fff", borderBottom:"1px solid #E2E8F0" }}>
        {[
          { label:"Total Connections", value:loading?"—":totalConnections, sub:"in network" },
          { label:"Active", value:loading?"—":activeConnections, sub:"current clients", subColor:"#10B981" },
          { label:"Open Roles", value:loading?"—":totalOpenJobs, sub:"across all clients", valColor:"#9333EA" },
          { label:"Prospects", value:loading?"—":prospectConnections, sub:"in pipeline" },
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
        {[{k:"all",l:"All"},{k:"active",l:"Active"},{k:"prospect",l:"Prospect"},{k:"inactive",l:"Inactive"}].map(s => (
          <button key={s.k} onClick={() => { setConnStatusFilter(s.k); setCurrentPage(1); }}
            style={{ padding:"5px 13px", borderRadius:20, fontSize:13, fontWeight:connStatusFilter===s.k?600:500, border:"none", cursor:"pointer", background:connStatusFilter===s.k?"#0F172A":"#fff", color:connStatusFilter===s.k?"#fff":"#64748B", boxShadow:connStatusFilter===s.k?"none":"0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)", transition:"all 120ms" }}>
            {s.l}
          </button>
        ))}

        {/* Search */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,.06)", borderRadius:10, padding:"5px 10px", marginLeft:8 }}>
          <Search style={{ width:13, height:13, color:"#94A3B8" }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search connections…"
            style={{ border:"none", background:"transparent", outline:"none", fontSize:13, color:"#0F172A", width:160 }} />
        </div>

        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button style={{ padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:500, border:"1px solid #E2E8F0", background:"#fff", color:"#64748B", cursor:"pointer" }}>More ▾</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => loadCompanies(true)}><RefreshCcw className="w-4 h-4 mr-2" />Refresh</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowEmailBlast(true)}><MailPlus className="w-4 h-4 mr-2" />Email Blast</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImport(true)}><Upload className="w-4 h-4 mr-2" />Import CSV</DropdownMenuItem>
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkUpdate(true)}>Mass Update ({selectedIds.size})</DropdownMenuItem>}
              {selectedIds.size > 0 && <DropdownMenuItem onClick={() => setShowBulkDelete(true)} className="text-red-600">Delete Selected ({selectedIds.size})</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => { setSelectedViewId(null); setShowViewSettings(true); }}>+ New View</DropdownMenuItem>
              {currentView && <DropdownMenuItem onClick={() => setShowViewSettings(true)}>Edit View</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <PermissionGate entity="Company" action="create">
            <button onClick={() => { setShowForm(true); setFormCompany(null); setSelectedCompany(null); setHighlightedCompany(null); }}
              style={{ padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", background:"#9333EA", color:"#fff", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,113,227,.3)" }}>
              + Add Connection
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding:"20px 24px 40px" }}>
        <div style={{ background:"#fff", borderRadius:16, boxShadow:"0 2px 12px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"1.8fr 120px 130px 90px 90px 80px 36px", gap:0, padding:"9px 20px", borderBottom:"1px solid #E2E8F0", background:"#FAFAFA" }}>
            {["CONNECTION","INDUSTRY","PRIMARY CONTACT","OPEN JOBS","STATUS","ADDED",""].map((h,i) => (
              <div key={i} style={{ fontSize:11, fontWeight:600, letterSpacing:".04em", color:"#94A3B8", display:"flex", alignItems:"center", gap:i===0?8:0 }}>
                {i===0 && <Checkbox checked={allVisibleSelected} onCheckedChange={c=>toggleSelectAllVisible(!!c)} />}
                {h}
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding:"48px", textAlign:"center", color:"#94A3B8" }}>
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color:"#9333EA" }} />
              <div style={{ fontSize:13 }}>Loading connections…</div>
            </div>
          ) : paginatedConn.length === 0 ? (
            <div style={{ padding:"60px", textAlign:"center" }}>
              <Building2 style={{ width:36, height:36, color:"#94A3B8", margin:"0 auto 12px" }} />
              <div style={{ fontSize:15, fontWeight:600, color:"#0F172A", marginBottom:6 }}>No connections found</div>
              <div style={{ fontSize:13, color:"#94A3B8" }}>{searchTerm ? "Try adjusting your search" : "Add your first connection to get started"}</div>
            </div>
          ) : paginatedConn.map((company, idx) => {
            const isSelected = selectedCompany?.id === company.id;
            const sb = connStatusBadge(company.status);
            const primaryContact = company.contacts?.find(c=>c.is_primary) || company.contacts?.[0];
            const openJobsCount = jobCounts.get(company.id) || 0;

            return (
              <div key={company.id} onClick={() => { setSelectedCompany(company); window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity: "Company", id: company.id } })); }}
                style={{ display:"grid", gridTemplateColumns:"1.8fr 120px 130px 90px 90px 80px 36px", gap:0, padding:"10px 20px", borderBottom:idx<paginatedConn.length-1?"1px solid #F2F2F7":"none", alignItems:"center", cursor:"pointer", background:isSelected?"rgba(0,113,227,.05)":"transparent", transition:"background 100ms" }}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background="#F9F9FB"; }}
                onMouseLeave={e => { e.currentTarget.style.background=isSelected?"rgba(0,113,227,.05)":"transparent"; }}>

                {/* Company */}
                <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
                  <Checkbox checked={selectedIds.has(company.id)} onCheckedChange={() => toggleSelect(company.id)} onClick={e=>e.stopPropagation()} />
                  <div style={{ width:32, height:32, borderRadius:8, background:avatarGrad(company.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                    {getInitials(company.name)}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:600, color:"#0F172A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {company.name}
                    </div>
                    <div style={{ fontSize:11.5, color:"#94A3B8" }}>{company.location || "—"}</div>
                  </div>
                </div>
                <div style={{ fontSize:12.5, color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{company.industry || "—"}</div>
                <div style={{ fontSize:12.5, color:"#64748B", minWidth:0 }}>
                  {primaryContact ? <div><div style={{ fontWeight:600, color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{primaryContact.name}</div><div style={{ fontSize:11 }}>{primaryContact.email || "—"}</div></div> : "—"}
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:openJobsCount>0?"#9333EA":"#94A3B8" }}>{openJobsCount > 0 ? openJobsCount : "—"}</div>
                <div><span style={{ fontSize:11.5, fontWeight:600, padding:"3px 10px", borderRadius:20, background:sb.bg, color:sb.c }}>{(company.status||"").replace(/\b\w/g,l=>l.toUpperCase()) || "—"}</span></div>
                <div style={{ fontSize:12, color:"#94A3B8" }}>{company.created_date ? timeAgo(company.created_date) : "—"}</div>
                <div onClick={e=>e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"none", cursor:"pointer", color:"#94A3B8" }} className="hover:bg-black/[.07]">
                        <MoreHorizontal style={{ width:14, height:14 }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={()=>window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity: "Company", id: company.id } }))}><Eye className="w-4 h-4 mr-2"/>View Details</DropdownMenuItem>
                      <PermissionGate entity="Company" action="update">
                        <DropdownMenuItem onClick={()=>{setFormCompany(company);setShowForm(true);}}><Edit className="w-4 h-4 mr-2"/>Edit</DropdownMenuItem>
                      </PermissionGate>
                      <DropdownMenuItem onClick={()=>handleHighlightCompany(company)}><Zap className="w-4 h-4 mr-2"/>Quick Edit</DropdownMenuItem>
                      <PermissionGate entity="Company" action="delete">
                        <DropdownMenuItem className="text-red-600" onClick={()=>{setCompanyToDelete(company);setShowDelete(true);}}><Trash className="w-4 h-4 mr-2"/>Delete</DropdownMenuItem>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More button */}
        {!loading && currentPage < totalConnPages && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:24, marginBottom:20 }}>
            <button onClick={()=>goToPage(currentPage+1)}
              style={{ padding:"8px 24px", borderRadius:20, border:"1px solid #E2E8F0", background:"#fff", color:"#9333EA", cursor:"pointer", fontSize:13, fontWeight:600, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Quick Edit floating bar */}
      {highlightedCompany && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#0F172A", borderRadius:16, padding:"14px 20px", boxShadow:"0 8px 32px rgba(0,0,0,.28)", display:"flex", alignItems:"center", gap:10, zIndex:50, flexWrap:"wrap" }}>
          <div style={{ color:"#fff", fontSize:13, fontWeight:600 }}>{highlightedCompany.name}</div>
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

      {showForm && (
        <CompanyForm
          company={formCompany} // Changed from editingCompany
          onSave={handleAddCompany}
          onCancel={() => { setShowForm(false); setFormCompany(null); }} // Use setFormCompany
        />
      )}

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          entityName="Connections"
          entitySdk={Company}
          onImported={() => { setShowImport(false); loadCompanies(); }}
        />
      )}

      {showEmailBlast && (
        <CompanyEmailBlastModal
          open={showEmailBlast}
          onClose={() => setShowEmailBlast(false)}
          companies={companies}
        />
      )}



      {showDelete && companyToDelete && (
        <DeleteConfirmModal
          open={showDelete}
          title="Delete Connection"
          message={`Are you sure you want to delete ${companyToDelete.name}? This action cannot be undone.`}
          confirmLabel="Delete Connection"
          onConfirm={deleteCompany}
          onCancel={() => { setShowDelete(false); setCompanyToDelete(null); }}
        />
      )}

      {/* bulk modals */}
      <BulkUpdateModal
        open={showBulkUpdate}
        onClose={() => setShowBulkUpdate(false)}
        selectedIds={Array.from(selectedIds)} // Pass as array for now, modal might expect it
        onDone={() => { setSelectedIds(new Set()); loadCompanies(); }}
      />
      <DeleteConfirmModal
        open={showBulkDelete}
        title="Delete Selected"
        message={`Delete ${selectedIds.size} connection(s)? This cannot be undone.`} // Changed .length to .size
        confirmLabel="Delete"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDelete(false)}
        loading={bulkDeleteLoading}
      />

      <ListViewSettingsModal
        open={showViewSettings}
        onClose={() => setShowViewSettings(false)}
        initial={currentView || { name: "", filters: { status: [], has_website: "any" }, visibility: "private", sort: "-created_date", columns: defaultColumns }}
        statusOptions={statusOptions}
        users={users}
        availableColumns={[
          { key: "connection", label: "Connection", locked: true },
          { key: "industry", label: "Industry" },
          { key: "location", label: "Location" },
          { key: "primary_contact", label: "Primary Contact" },
          { key: "last_name", label: "Last Name" },
          { key: "contact_numbers", label: "Contact Numbers" },
          { key: "open_jobs", label: "Open Jobs" },
          { key: "status", label: "Status" },
          { key: "created_by", label: "Created By" },
          { key: "website", label: "Website" },
          { key: "job_stack_access", label: "Jobs Stack Access" }
        ]}
        onSave={saveView}
      />
    </div>
  );
}