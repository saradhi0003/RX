import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, Briefcase, Building2, BarChart3, Settings, User, LogOut,
  Search, Bell, Send, CheckSquare, BookOpen, BrainCircuit, FileText,
  Mail, Clock, CheckCircle, Wallet, Receipt, Zap, AlertTriangle,
  Loader2, Brain, MailPlus, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Assistant from "@/components/ai/Assistant";
import { PermissionsProvider } from "@/components/common/PermissionsContext";
import { usePermissions } from "@/components/common/PermissionsContext";
import { User as UserEntity } from "@/entities/User";
import { Candidate, Job, Application, Task } from "@/entities/all";
import { AuditLog } from "@/entities/AuditLog";
import { Role } from "@/entities/Role";
import AccessBlocker from "@/components/common/AccessBlocker";
import { getRolesCached, invalidateRolesCache } from "@/components/utils/rolesCache";
import NotificationToast from "@/components/notifications/NotificationToast";
import RightPreviewPanel from "@/components/common/RightPreviewPanel";
import CandidatePreviewLoader from "@/components/previews/CandidatePreviewLoader";
import JobPreviewLoader from "@/components/previews/JobPreviewLoader";
import CompanyPreviewLoader from "@/components/previews/CompanyPreviewLoader";
import ApplicationPreview from "@/components/previews/ApplicationPreview";
import TaskPreview from "@/components/previews/TaskPreview";
import PlaybookPreview from "@/components/previews/PlaybookPreview";
import CommandPalette from "@/components/common/CommandPalette";
import QuickActions from "@/components/common/QuickActions"; // Added QuickActions import
import KeyboardShortcuts from "@/components/common/KeyboardShortcuts"; // Added KeyboardShortcuts import
import AIQuickActions from "@/components/common/AIQuickActions";

// Add Email Settings to main navigation
// Remove Pipeline Analytics from admin navigation since it's merged into Dashboard
const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: BarChart3,
  },
  {
    title: "Resume & Skills Studio",
    url: createPageUrl("ResumeStudio"),
    icon: BrainCircuit,
  },
  {
    title: "Candidates",
    url: createPageUrl("Candidates"),
    icon: Users,
  },
  {
    title: "Jobs",
    url: createPageUrl("Jobs"),
    icon: Briefcase,
  },
  {
    title: "Connections",
    url: createPageUrl("Companies"),
    icon: Building2,
  },
  {
    title: "Applications",
    url: createPageUrl("Submissions"),
    icon: Send,
  },
  {
    title: "Tasks",
    url: createPageUrl("Tasks"),
    icon: CheckSquare,
  },
  {
    title: "Goals",
    url: createPageUrl("Goals"),
    icon: CheckCircle,
  },
  {
    title: "Duplicate Manager",
    url: createPageUrl("DuplicateManager"),
    icon: AlertTriangle,
  },
  {
    title: "Playbooks",
    url: createPageUrl("Playbooks"),
    icon: BookOpen,
  },
  {
    title: "My Work",
    url: createPageUrl("MyWork"),
    icon: Clock,
  },
  {
    title: "Email Settings",
    url: createPageUrl("EmailSettings"),
    icon: Mail,
  }
];

// Nav item for new design
function NavItem({ to, icon: Icon, label, badge, badgeColor, active }) {
  const badgeCls = badgeColor === 'blue' ? 'bg-blue-50 text-[#0071E3]'
    : badgeColor === 'green' ? 'bg-green-50 text-green-600'
    : badgeColor === 'orange' ? 'bg-orange-50 text-orange-500'
    : 'bg-[#F5F5F7] text-[#6E6E73]';
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2.5 py-[7px] rounded-[10px] text-[13.5px] font-medium transition-all duration-130 select-none group ${
        active
          ? 'bg-[rgba(0,113,227,.08)] text-[#0071E3] font-semibold'
          : 'text-[#6E6E73] hover:bg-black/5 hover:text-[#1D1D1F]'
      }`}
    >
      <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${active ? 'text-[#0071E3]' : 'text-[#86868B] group-hover:text-[#6E6E73]'}`} />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className={`text-[11px] font-semibold px-[7px] py-px rounded-[10px] ml-auto ${badgeCls}`}>{badge}</span>
      )}
    </Link>
  );
}

// Permission-aware Accounts section
function AccountsNav({ location }) {
  const { can } = usePermissions();
  const showInvoices = can("Invoice", "view");
  const showExpenses = can("Expense", "view");
  if (!showInvoices && !showExpenses) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-[.01em] px-2.5 py-[10px] pt-3">Accounts</div>
      {showInvoices && <NavItem to={createPageUrl("Invoices")} icon={Receipt} label="Invoices" active={location.pathname === createPageUrl("Invoices")} />}
      {showExpenses && <NavItem to={createPageUrl("Expenses")} icon={Wallet} label="Expenses" active={location.pathname === createPageUrl("Expenses")} />}
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [me, setMe] = React.useState(null);
  const [myRole, setMyRole] = React.useState(null);
  const [quickStats, setQuickStats] = React.useState({ activeJobs: 0, newCandidates: 0, thisMonthPlacements: 0 });
  const [qsLoading, setQsLoading] = React.useState(true);
  const [checkingAccess, setCheckingAccess] = React.useState(true);

  const [preview, setPreview] = React.useState({ open: false, entity: null, id: null });
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false); // New state for keyboard shortcuts
  const [aiQuickActionsOpen, setAiQuickActionsOpen] = React.useState(false);

  const openPreview = React.useCallback((entity, id) => {
    if (!entity || !id) return;
    setPreview({ open: true, entity, id });
  }, []);

  const closePreview = React.useCallback(() => setPreview(prev => ({ ...prev, open: false })), []);

  React.useEffect(() => {
    const onOpen = (e) => {
      const { entity, id } = e.detail || {};
      if (entity && id) openPreview(entity, id);
    };
    window.addEventListener("preview:open", onOpen);
    const onClose = () => closePreview();
    window.addEventListener("preview:close", onClose);
    return () => {
      window.removeEventListener("preview:open", onOpen);
      window.removeEventListener("preview:close", onClose);
    };
  }, [openPreview, closePreview]);

  React.useEffect(() => {
    closePreview();
  }, [location.pathname, closePreview]);

  React.useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

      const isEditIntent = (anchorEl, urlObj) => {
        if (!anchorEl) return false;
        const ds = anchorEl.dataset || {};
        const text = (anchorEl.textContent || "").toLowerCase();
        const aria = (anchorEl.getAttribute && (anchorEl.getAttribute("aria-label") || "") || "").toLowerCase();

        const urlHasEdit =
          (urlObj?.searchParams?.get("edit") || "").toString() === "true" ||
          (urlObj?.searchParams?.get("mode") || "").toString() === "edit" ||
          (urlObj?.hash || "").toLowerCase().includes("edit") ||
          (urlObj?.search || "").toLowerCase().includes("edit");

        const dataHints =
          ds.noPreview === "true" ||
          ds.intent === "edit" ||
          (anchorEl.getAttribute && anchorEl.getAttribute("data-no-preview") === "true") ||
          (anchorEl.getAttribute && anchorEl.getAttribute("data-intent") === "edit");

        const textHints = text.includes("edit") || aria.includes("edit");

        let cur = anchorEl;
        let ancestorHints = false;
        while (cur && cur !== document.body) {
          const da = cur.getAttribute ? (cur.getAttribute("data-action") || "").toLowerCase() : "";
          const di = cur.getAttribute ? (cur.getAttribute("data-intent") || "").toLowerCase() : "";
          const np = cur.getAttribute ? cur.getAttribute("data-no-preview") : null;
          const ar = cur.getAttribute ? (cur.getAttribute("aria-label") || "").toLowerCase() : "";
          if (da === "edit" || di === "edit" || np === "true" || ar.includes("edit")) { ancestorHints = true; break; }
          cur = cur.parentElement;
        }

        return urlHasEdit || dataHints || textHints || ancestorHints;
      };

      let el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === "A" && el.href) {
          try {
            const href = el.getAttribute("href") || el.href;
            const url = new URL(href, window.location.origin);
            const path = url.pathname.replace(/^\//, "").toLowerCase();
            const id = new URLSearchParams(url.search).get("id");

            if (isEditIntent(el, url)) return;

            const map = {
              candidatedetails: "Candidate",
              jobdetails: "Job",
              companydetails: "Company",
              applicationdetails: "Application",
              taskdetails: "Task",
              playbookdetails: "Playbook",
              skillmatrix: "SkillMatrix", // Ensure SkillMatrix is handled if it can have details preview
            };
            const key = Object.keys(map).find(k => path.startsWith(k));
            if (key && id) {
              e.preventDefault();
              openPreview(map[key], id);
              return;
            }
          } catch {
            // ignore invalid hrefs
          }
        }
        el = el.parentElement;
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [openPreview]);

  const qsGuard = React.useRef({ ts: 0, inFlight: false });
  const userGuard = React.useRef({ ts: 0, inFlight: false });
  const [renderAssistant, setRenderAssistant] = React.useState(false);
  const logoutTimer = React.useRef(null);

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("sidebar_collapsed") || "false"); } catch { return false; }
  });
  const [sidebarPinned, setSidebarPinned] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("sidebar_pinned") || "true"); } catch { return true; }
  });

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      if (sidebarPinned) {
        try { localStorage.setItem("sidebar_collapsed", JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, [sidebarPinned]);

  const togglePin = React.useCallback(() => {
    setSidebarPinned(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar_pinned", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!sidebarPinned) setSidebarCollapsed(true);
  }, [location.pathname, sidebarPinned]);

  const resetLogoutTimer = React.useCallback(() => {
    if (logoutTimer.current) {
      clearTimeout(logoutTimer.current);
    }
    logoutTimer.current = setTimeout(async () => {
      try {
        await UserEntity.logout();
        window.location.reload();
      } catch (error) {
        console.error("Auto-logout failed:", error);
      }
    }, 3 * 60 * 60 * 1000);
  }, []);

  React.useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    
    const handleActivity = () => {
      resetLogoutTimer();
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetLogoutTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (logoutTimer.current) {
        clearTimeout(logoutTimer.current);
      }
    };
  }, [resetLogoutTimer]);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // Cmd+J or Ctrl+J to open AI Quick Actions
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setAiQuickActionsOpen(true);
      }
      
      // ? to toggle keyboard shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target;
        // Don't trigger if typing in input/textarea
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setShortcutsOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for custom event to open AI Quick Actions
  React.useEffect(() => {
    const handleOpenAI = () => setAiQuickActionsOpen(true);
    window.addEventListener('openAIQuickActions', handleOpenAI);
    return () => window.removeEventListener('openAIQuickActions', handleOpenAI);
  }, []);

  const handleQuickAction = React.useCallback((actionId) => {
    const actionMap = {
      add_candidate: "Candidates",
      add_job: "Jobs",
      add_company: "Companies",
      add_submission: "Submissions",
      add_task: "Tasks"
    };
    
    const page = actionMap[actionId];
    if (page) {
      navigate(createPageUrl(page));
      // Trigger add action after navigation
      setTimeout(() => {
        const event = new CustomEvent('quickAction', { detail: { action: 'add' } });
        window.dispatchEvent(event);
      }, 100);
    }
  }, [navigate]); // Added navigate to dependencies

  const skipQuickStats = React.useMemo(() => {
    const qp = new URLSearchParams(location.search);
    return qp.get("hide_badge") === "true";
  }, [location.search]);

  // Load quick stats for sidebar
  React.useEffect(() => {
    if (skipQuickStats) {
      setQsLoading(false);
      return;
    }

    const loadQuickStats = async () => {
      const now = Date.now();
      if (qsGuard.current.inFlight || now - qsGuard.current.ts < 30000) {
        setQsLoading(false);
        return;
      }

      qsGuard.current.inFlight = true;
      qsGuard.current.ts = now;

      try {
        const [jobsData, candidatesData, applicationsData] = await Promise.all([
          Job.list().catch(() => []),
          Candidate.list().catch(() => []),
          Application.list().catch(() => [])
        ]);

        const activeJobs = (jobsData || []).filter(job => job.status === 'open').length;
        
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const newCandidates = (candidatesData || []).filter(c => {
          const createdDate = new Date(c.created_date);
          return createdDate >= sevenDaysAgo;
        }).length;

        const thisMonthPlacements = (applicationsData || []).filter(app => {
          if (app.status !== 'hired') return false;
          const placementDate = new Date(app.created_date);
          return placementDate.getMonth() === today.getMonth() &&
                 placementDate.getFullYear() === today.getFullYear();
        }).length;

        setQuickStats({ activeJobs, newCandidates, thisMonthPlacements });
      } catch (error) {
        console.error("Error loading quick stats:", error);
      } finally {
        setQsLoading(false);
        qsGuard.current.inFlight = false;
      }
    };

    loadQuickStats();
  }, [skipQuickStats]);

  React.useEffect(() => {
    const t = setTimeout(() => setRenderAssistant(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // ENHANCED: User access check with immediate logout for inactive users
  React.useEffect(() => {
    const loadUser = async () => {
      const now = Date.now();
      if (userGuard.current.inFlight || now - userGuard.current.ts < 30000) {
        setCheckingAccess(false);
        return;
      }
      
      userGuard.current.inFlight = true;
      userGuard.current.ts = now;
      setCheckingAccess(true);

      try {
        const u = await UserEntity.me().catch(() => null);
        
        // CRITICAL: Check if user should be blocked BEFORE setting state
        if (u) {
          let admin = (u.role === "admin");
          if (u.role_id) {
            const roles = await getRolesCached().catch(() => []);
            const r = roles.find((it) => it.id === u.role_id);
            admin = admin || ((r?.name || "").toLowerCase() === "admin");
          }

          // Check if user is blocked (locked or inactive non-admin)
          const isBlockedUser = (u.is_locked === true) || 
                          (!admin && u.status && u.status !== "active");

          if (isBlockedUser) {
            // User is blocked - logout immediately
            console.warn("Access denied: User is", u.is_locked ? "locked" : `status ${u.status}`);
            
            // Store reason for display after logout
            try {
              sessionStorage.setItem("access_denied_reason", JSON.stringify({
                is_locked: u.is_locked,
                status: u.status,
                email: u.email,
                full_name: u.full_name
              }));
            } catch (e) {
              console.error("Failed to store access denied reason:", e);
            }

            // Force logout
            try {
              await UserEntity.logout();
            } catch (e) {
              console.error("Logout failed:", e);
            }
            
            // Redirect to login with error message
            window.location.href = "/?error=access_denied";
            return;
          }

          // User is allowed - proceed normally
          setMe(u);
          if (u?.role_id) {
            const roles = await getRolesCached().catch(() => []);
            const found = roles.find((r) => r.id === u.role_id);
            setMyRole(found || null);
          }
        } else {
          setMe(null);
          setMyRole(null);
        }
      } catch (error) {
        console.warn("Layout user load failed:", error);
        setMe(null);
        setMyRole(null);
      } finally {
        userGuard.current.inFlight = false;
        setCheckingAccess(false);
      }
    };
    loadUser();
  }, []);

  // Check for access denied on mount (from sessionStorage)
  React.useEffect(() => {
    try {
      const reason = sessionStorage.getItem("access_denied_reason");
      if (reason) {
        const parsed = JSON.parse(reason);
        sessionStorage.removeItem("access_denied_reason");
        
        // Show error message
        const message = parsed.is_locked 
          ? "Your account has been locked. Please contact an administrator."
          : `Your account is ${parsed.status}. Please contact an administrator to activate your account.`;
        
        alert(message);
      }
    } catch (e) {
      console.error("Failed to check access denied reason:", e);
    }
  }, []);

  React.useEffect(() => {
    const logOnce = async () => {
      if (!me) return;
      if (sessionStorage.getItem("audit_logged") === "1") return;
      
      try {
        let ip = "unknown";
        try {
          const res = await fetch("https://api.ipify.org?format=json");
          const j = await res.json();
          if (j?.ip) ip = j.ip;
        } catch (_) {}
        
        await AuditLog.create({
          user_email: me.email,
          action: "login",
          ip,
          user_agent: navigator.userAgent || "",
          app: "Recruiter X"
        });
        sessionStorage.setItem("audit_logged", "1");
      } catch (e) {
        console.warn("Audit log failed:", e);
      }
    };
    logOnce();
  }, [me]);

  React.useEffect(() => {
    if (window.__automationPatched) return;
    window.__automationPatched = true;

    const completeRelatedTasks = async (related_entity, related_id, note) => {
      if (!related_id) return;
      try {
        const list = await Task.filter({ related_entity, related_id });
        const open = (list || []).filter(t => t.status !== "completed");
        for (const t of open) {
          await Task.update(t.id, { status: "completed", completion_notes: note });
        }
      } catch (e) {
        console.warn("Auto-complete tasks failed:", e);
      }
    };

    const _candUpdate = Candidate.update.bind(Candidate);
    Candidate.update = async (id, payload) => {
      const res = await _candUpdate(id, payload);
      const newStatus = (payload && payload.status) ?? res?.status;
      if (["inactive", "do_not_contact"].includes(String(newStatus || "").toLowerCase())) {
        await completeRelatedTasks("candidate", id, `Auto-completed after candidate set to ${newStatus}`);
      }
      return res;
    };

    const _appUpdate = Application.update.bind(Application);
    Application.update = async (id, payload) => {
      const res = await _appUpdate(id, payload);
      const s = (payload && payload.status) ?? res?.status;
      const status = String(s || "").toLowerCase();
      if (["rejected", "withdrawn", "on_hold"].includes(status)) {
        await Promise.all([
          completeRelatedTasks("submission", id, `Auto-completed after application ${status}`),
          completeRelatedTasks("candidate", res?.candidate_id, `Auto-completed after application ${status}`),
          completeRelatedTasks("job", res?.job_id, `Auto-completed after application ${status}`)
        ]);
      }
      return res;
    };
  }, []);

  const isAdmin = (me?.role === "admin") || ((myRole?.name || "").toLowerCase() === "admin");
  const isBlocked = !!me && ((me.is_locked === true) || (!isAdmin && me.status && me.status !== "active"));

  React.useEffect(() => {
    const patch = async () => {
      if (!isAdmin) return;
      if (window.__recruiterPermPatched) return;
      window.__recruiterPermPatched = true;
      try {
        const roles = await getRolesCached().catch(() => []);
        const rec = roles.find(r => (r.name || "").toLowerCase().includes("recruiter"));
        if (!rec) return;
        const perms = { ...(rec.permissions || {}) };
        const row = perms["Candidate"] || {};
        if (!(row?.update && row?.view)) {
          perms["Candidate"] = {
            view: true,
            create: row?.create ?? false,
            update: true,
            delete: row?.delete ?? false,
            scope: row?.scope || "own"
          };
        }
        const ts = perms["Timesheet"] || {};
        perms["Timesheet"] = {
          view: true,
          create: true,
          update: true,
          delete: ts?.delete ?? false,
          scope: ts?.scope || "own"
        };
        await Role.update(rec.id, { permissions: perms });
        invalidateRolesCache();
        try { localStorage.setItem("roles_cache_bust", String(Date.now())); } catch {}
      } catch (e) {
        console.warn("Recruiter permission patch failed:", e);
      }
    };
    if (isAdmin && me) {
      patch();
    }
  }, [isAdmin, me]);

  // Show loading while checking access
  if (checkingAccess && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: '#0071E3' }} />
          <p style={{ color: '#6E6E73', fontSize: 13 }}>Verifying access…</p>
        </div>
      </div>
    );
  }

  const initials = me?.full_name
    ? me.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : (me?.email ? me.email[0].toUpperCase() : 'U');

  return (
    <PermissionsProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: '#F5F5F7', fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" }}>
        <style>{`
          .rx-sidebar { width:240px; height:100vh; background:rgba(255,255,255,.85); backdrop-filter:blur(24px) saturate(180%); border-right:1px solid #E5E5EA; display:flex; flex-direction:column; flex-shrink:0; z-index:20; }
          .rx-topbar { height:52px; background:rgba(255,255,255,.85); backdrop-filter:blur(24px) saturate(180%); border-bottom:1px solid #E5E5EA; display:flex; align-items:center; padding:0 22px; gap:12px; flex-shrink:0; }
          .rx-nav-scroll { flex:1; overflow-y:auto; overflow-x:hidden; padding:8px; scrollbar-width:none; }
          .rx-nav-scroll::-webkit-scrollbar { display:none; }
          @keyframes rx-page-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
          .rx-page-in { animation: rx-page-in 280ms cubic-bezier(.25,.46,.45,.94) both; }
          @media (max-width:1023px) {
            .rx-sidebar { position:fixed; left:0; top:0; transform:translateX(-100%); transition:transform .22s ease; }
            .rx-sidebar.open { transform:translateX(0); }
          }
        `}</style>

        {/* ── SIDEBAR ── */}
        <aside className="rx-sidebar">
          {/* Logo */}
          <div style={{ height:52, display:'flex', alignItems:'center', gap:9, padding:'0 18px', borderBottom:'1px solid #E5E5EA', flexShrink:0 }}>
            <div style={{ width:28, height:28, background:'#1D1D1F', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', letterSpacing:'-.04em', flexShrink:0 }}>RX</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1D1D1F', letterSpacing:'-.022em' }}>Recruiter<span style={{ color:'#0071E3' }}> X</span></div>
          </div>

          {/* Nav */}
          <nav className="rx-nav-scroll">
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.01em', color:'#86868B', padding:'10px 10px 4px', textTransform:'uppercase' }}>Workspace</div>
            <NavItem to={createPageUrl("Dashboard")} icon={BarChart3} label="Dashboard" active={location.pathname === createPageUrl("Dashboard")} badge="Live" badgeColor="blue" />
            <NavItem to={createPageUrl("Candidates")} icon={Users} label="Candidates" active={location.pathname === createPageUrl("Candidates")} />
            <NavItem to={createPageUrl("Jobs")} icon={Briefcase} label="Jobs" active={location.pathname === createPageUrl("Jobs")} />
            <NavItem to={createPageUrl("Companies")} icon={Building2} label="Connections" active={location.pathname === createPageUrl("Companies")} />
            <NavItem to={createPageUrl("Submissions")} icon={Send} label="Applications" active={location.pathname === createPageUrl("Submissions")} />
            <NavItem to={createPageUrl("Tasks")} icon={CheckSquare} label="Tasks" active={location.pathname === createPageUrl("Tasks")} />
            <NavItem to={createPageUrl("ResumeStudio")} icon={BrainCircuit} label="Resume Studio" active={location.pathname === createPageUrl("ResumeStudio")} />
            <NavItem to={createPageUrl("MyWork")} icon={Clock} label="My Work" active={location.pathname === createPageUrl("MyWork")} />
            <NavItem to={createPageUrl("Playbooks")} icon={BookOpen} label="Playbooks" active={location.pathname === createPageUrl("Playbooks")} />
            <NavItem to={createPageUrl("Goals")} icon={CheckCircle} label="Goals" active={location.pathname === createPageUrl("Goals")} />
            <NavItem to={createPageUrl("DuplicateManager")} icon={AlertTriangle} label="Duplicates" active={location.pathname === createPageUrl("DuplicateManager")} />
            <NavItem to={createPageUrl("EmailSettings")} icon={Mail} label="Email Settings" active={location.pathname === createPageUrl("EmailSettings")} />

            <div style={{ height:1, background:'#E5E5EA', margin:'5px 10px' }} />
            <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.01em', color:'#86868B', padding:'10px 10px 4px', textTransform:'uppercase' }}>Intelligence</div>
            <NavItem to={createPageUrl("AIAgents")} icon={Brain} label="AI Agents" active={location.pathname === createPageUrl("AIAgents")} badge="3" badgeColor="blue" />
            <NavItem to={createPageUrl("AutomationRules")} icon={Zap} label="Automation" active={location.pathname === createPageUrl("AutomationRules")} />
            <NavItem to={createPageUrl("EmailInbox")} icon={Mail} label="Email Inbox" active={location.pathname === createPageUrl("EmailInbox")} />

            {isAdmin && (
              <>
                <div style={{ height:1, background:'#E5E5EA', margin:'5px 10px' }} />
                <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.01em', color:'#86868B', padding:'10px 10px 4px', textTransform:'uppercase' }}>Admin</div>
                <NavItem to={createPageUrl("AccessControl?hide_badge=true")} icon={Settings} label="Access Control" active={location.pathname === createPageUrl("AccessControl")} />
                <NavItem to={createPageUrl("Approvals")} icon={CheckCircle} label="Approvals" active={location.pathname === createPageUrl("Approvals")} />
                <NavItem to={createPageUrl("JobStack")} icon={Briefcase} label="Job Stack" active={location.pathname === createPageUrl("JobStack")} />
                <NavItem to={createPageUrl("EmailBlast")} icon={MailPlus} label="Email Blast" active={location.pathname === createPageUrl("EmailBlast")} />
                <NavItem to={createPageUrl("BRD")} icon={FileText} label="BRD" active={location.pathname === createPageUrl("BRD")} />
              </>
            )}

            <AccountsNav location={location} />
          </nav>

          {/* Quick Stats */}
          {!skipQuickStats && (
            <div style={{ padding:'8px 18px', borderTop:'1px solid #E5E5EA' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 0' }}>
                <span style={{ fontSize:12, color:'#86868B' }}>Active Roles</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#0071E3' }}>
                  {qsLoading ? '—' : quickStats.activeJobs}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 0' }}>
                <span style={{ fontSize:12, color:'#86868B' }}>New Candidates</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#30A14E' }}>
                  {qsLoading ? '—' : quickStats.newCandidates}
                </span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 0' }}>
                <span style={{ fontSize:12, color:'#86868B' }}>Placed (Month)</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#1D1D1F' }}>
                  {qsLoading ? '—' : quickStats.thisMonthPlacements}
                </span>
              </div>
            </div>
          )}

          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div style={{ padding:'9px 12px', borderTop:'1px solid #E5E5EA', display:'flex', alignItems:'center', gap:9, cursor:'pointer' }}
                className="hover:bg-black/[.03] transition-colors">
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(145deg,#0071E3,#30A14E)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13.5, fontWeight:600, color:'#1D1D1F', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{me?.full_name || me?.email || 'User'}</div>
                  <div style={{ fontSize:11, color:'#86868B' }}>{myRole?.name || (me?.role === 'admin' ? 'Administrator' : 'User')}</div>
                </div>
                <MoreHorizontal style={{ width:14, height:14, color:'#AEAEB2', flexShrink:0 }} />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem><User className="w-4 h-4 mr-2" />Profile Settings</DropdownMenuItem>
              <DropdownMenuItem><Settings className="w-4 h-4 mr-2" />Company Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600"><LogOut className="w-4 h-4 mr-2" />Sign Out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </aside>

        {/* ── MAIN ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Topbar */}
          <header className="rx-topbar">
            <div style={{ fontSize:17, fontWeight:700, color:'#1D1D1F', letterSpacing:'-.022em', flexShrink:0 }}>
              {navigationItems.find(n => location.pathname === n.url)?.title ||
               (location.pathname.includes('Dashboard') ? 'Dashboard' :
                location.pathname.includes('Candidates') ? 'Candidates' :
                location.pathname.includes('Jobs') ? 'Jobs' :
                location.pathname.includes('Companies') ? 'Connections' :
                location.pathname.includes('Submissions') ? 'Applications' :
                location.pathname.includes('Tasks') ? 'Tasks' :
                location.pathname.includes('ResumeStudio') ? 'Resume Studio' :
                location.pathname.includes('MyWork') ? 'My Work' :
                location.pathname.includes('Playbooks') ? 'Playbooks' :
                location.pathname.includes('Goals') ? 'Goals' :
                location.pathname.includes('AIAgents') ? 'AI Agents' :
                location.pathname.includes('AutomationRules') ? 'Automation' :
                location.pathname.includes('EmailInbox') ? 'Email Inbox' :
                location.pathname.includes('AccessControl') ? 'Access Control' :
                location.pathname.includes('Approvals') ? 'Approvals' :
                location.pathname.includes('JobStack') ? 'Job Stack' :
                location.pathname.includes('EmailBlast') ? 'Email Blast' :
                location.pathname.includes('BRD') ? 'BRD' :
                location.pathname.includes('Invoices') ? 'Invoices' :
                location.pathname.includes('Expenses') ? 'Expenses' :
                location.pathname.includes('DuplicateManager') ? 'Duplicate Manager' :
                'Recruiter X')}
            </div>

            <div
              onClick={() => setCommandPaletteOpen(true)}
              style={{ flex:1, maxWidth:340, display:'flex', alignItems:'center', gap:7, background:'rgba(0,0,0,.06)', borderRadius:10, padding:'6px 11px', cursor:'text' }}
              className="hover:bg-black/[.09] transition-colors"
            >
              <Search style={{ width:13, height:13, color:'#86868B', flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13, color:'#86868B' }}>Search candidates, jobs, companies…</span>
              <kbd style={{ fontFamily:"'SF Mono','Menlo',monospace", fontSize:10, color:'#AEAEB2', background:'#fff', border:'1px solid rgba(0,0,0,.08)', borderRadius:5, padding:'1px 5px' }}>⌘K</kbd>
            </div>

            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <button
                onClick={() => setAiQuickActionsOpen(true)}
                style={{ display:'flex', alignItems:'center', gap:5, background:'#0071E3', color:'#fff', border:'none', borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:'-.01em' }}
                className="hover:bg-[#0077ED] transition-colors"
              >
                <Zap style={{ width:12, height:12 }} />
                AI Actions
              </button>
              <button
                onClick={() => {}}
                style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'none', cursor:'pointer', position:'relative', color:'#6E6E73' }}
                className="hover:bg-black/[.07] transition-colors"
              >
                <Bell style={{ width:16, height:16 }} />
                <div style={{ position:'absolute', top:7, right:6, width:7, height:7, background:'#FF3B30', borderRadius:'50%', border:'1.5px solid #fff' }} />
              </button>
              <div style={{ width:1, height:18, background:'#E5E5EA' }} />
              <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(145deg,#0071E3,#30A14E)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', cursor:'pointer', flexShrink:0 }}>
                {initials}
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-auto" style={{ background:'#F5F5F7' }}>
            <div className="rx-page-in">
              {isBlocked ? (
                <AccessBlocker user={me} />
              ) : (
                <>
                  {children}
                  {renderAssistant && currentPageName !== "AccessControl" && currentPageName !== "MyWork" && <Assistant currentPageName={currentPageName} />}
                </>
              )}
            </div>
          </div>
        </div>

        <RightPreviewPanel open={preview.open} title={`${preview.entity || ""} Details`} onClose={closePreview}>
          {!preview.open ? null : (
            preview.entity === "Candidate" ? <CandidatePreviewLoader id={preview.id} /> :
            preview.entity === "Job" ? <JobPreviewLoader id={preview.id} /> :
            preview.entity === "Company" ? <CompanyPreviewLoader id={preview.id} /> :
            preview.entity === "Application" ? <ApplicationPreview id={preview.id} /> :
            preview.entity === "Task" ? <TaskPreview id={preview.id} /> :
            preview.entity === "Playbook" ? <PlaybookPreview id={preview.id} /> :
            <div className="text-sm text-slate-600">Unsupported preview.</div>
          )}
        </RightPreviewPanel>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <QuickActions onAction={handleQuickAction} />
      <AIQuickActions open={aiQuickActionsOpen} onClose={() => setAiQuickActionsOpen(false)} />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <NotificationToast />
    </PermissionsProvider>
  );
}