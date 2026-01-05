import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom"; // Added useNavigate
import { createPageUrl } from "@/utils";
import {
  Users,
  Briefcase,
  Building2,
  BarChart3,
  Settings,
  User,
  LogOut,
  Search,
  Bell,
  Send,
  CheckSquare,
  BookOpen,
  BrainCircuit,
  FileText,
  Mail,
  Clock,
  CheckCircle,
  Wallet,
  Receipt,
  Pin,
  PinOff,
  ChevronsLeft,
  ChevronsRight,
  Zap, // Added Zap icon for Automation Rules
  AlertTriangle, // Added AlertTriangle icon for Duplicate Manager
  Loader2, // Added Loader2 for loading state
  Brain, // Added Brain icon for AI Agents
  MailPlus, // Added MailPlus icon for Email Blast
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import JobPreview from "@/components/previews/JobPreview";
import CompanyPreview from "@/components/previews/CompanyPreview";
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

// Permission-aware Accounts section for the sidebar
function AccountsNav({ location, collapsed }) {
  const { can } = usePermissions();
  const showInvoices = can("Invoice", "view");
  const showExpenses = can("Expense", "view");
  if (!showInvoices && !showExpenses) return null;

  return (
    <SidebarGroup className="mt-2">
      <SidebarGroupLabel className={`sidebar-group-label text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 ${collapsed ? "hidden" : ""}`}>
        Accounts
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="space-y-1">
          {showInvoices && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={`transition-all duration-200 rounded-lg ${
                  location.pathname === createPageUrl("Invoices")
                    ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                } ${collapsed ? "justify-center px-2" : ""}`}
              >
                <Link
                  to={createPageUrl("Invoices")}
                  title={collapsed ? "Invoices" : undefined}
                  className={`flex items-center gap-3 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"}`}
                >
                  <Receipt className="w-5 h-5" />
                  <span className={`font-medium sidebar-label ${collapsed ? "hidden" : "inline"}`}>Invoices</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {showExpenses && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={`transition-all duration-200 rounded-lg ${
                  location.pathname === createPageUrl("Expenses")
                    ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                } ${collapsed ? "justify-center px-2" : ""}`}
              >
                <Link
                  to={createPageUrl("Expenses")}
                  title={collapsed ? "Expenses" : undefined}
                  className={`flex items-center gap-3 ${collapsed ? "px-0 py-2.5" : "px-3 py-2.5"}`}
                >
                  <Wallet className="w-5 h-5" />
                  <span className={`font-medium sidebar-label ${collapsed ? "hidden" : "inline"}`}>Expenses</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionsProvider>
      <SidebarProvider>
        <div
          className="min-h-screen flex w-full gap-4 lg:gap-6"
          style={{
            backgroundImage: `
              radial-gradient(1100px 660px at 90% -10%, rgba(0,132,255,0.12), rgba(0,132,255,0) 60%),
              radial-gradient(900px 600px at -10% 110%, rgba(108,0,255,0.10), rgba(108,0,255,0) 60%),
              linear-gradient(135deg, rgba(0,201,255,0.05) 0%, rgba(0,132,255,0.05) 40%, rgba(108,0,255,0.05) 100%)
            `,
            backgroundColor: "#F9FBFF",
            backgroundAttachment: "fixed"
          }}
        >
          <style>{`
            :root {
              --brand-cyan: #00C9FF;
              --brand-blue: #0084FF;
              --brand-purple: #6C00FF;
              --radius-xl: 14px;
              --shadow-card: 0 12px 28px rgba(2, 6, 23, 0.06);
              --ring: 0 0 0 3px rgba(0,132,255,0.20);

              --clay-bg: #f5f7fb;
              --clay-surface: #ffffffee;
              --clay-shadow: 12px 12px 24px rgba(15, 23, 42, 0.12);
              --clay-highlight: -8px -8px 20px rgba(255, 255, 255, 0.9);
              --clay-inset: inset 0 1px 1px rgba(255,255,255,0.6);
              --clay-radius: 18px;
            }

            .clay-surface {
              background: var(--clay-surface);
              border-radius: var(--clay-radius);
              box-shadow: var(--clay-shadow), var(--clay-highlight), var(--clay-inset);
              border: 1px solid rgba(15, 23, 42, 0.06);
              backdrop-filter: blur(6px);
            }

            .clay-button {
              border-radius: 14px;
              background: linear-gradient(180deg, #ffffff, #f4f6fb);
              box-shadow: 6px 6px 14px rgba(2, 6, 23, 0.10), -4px -4px 12px rgba(255,255,255,0.85);
              border: 1px solid rgba(15, 23, 42, 0.06);
              transition: transform .12s ease, box-shadow .2s ease;
            }
            .clay-button:hover {
              transform: translateY(-1px);
              box-shadow: 10px 10px 18px rgba(2, 6, 23, 0.12), -6px -6px 14px rgba(255,255,255,0.9);
            }
            .clay-button:active {
              transform: translateY(0);
              box-shadow: inset 0 2px 6px rgba(2,6,23,0.12);
            }

            .app-sidebar {
              transition: width .2s ease, padding .2s ease;
              will-change: width;
            }
            .app-sidebar[data-collapsed="true"] { width: 72px; }
            .app-sidebar[data-collapsed="false"] { width: 280px; }

            .sidebar-label { transition: opacity .15s ease; }
            [data-collapsed="true"] .sidebar-label { opacity: 0; display: none; }

            [data-collapsed="true"] .sidebar-group-label { display: none; }

            [data-collapsed="true"] .sidebar-icon-center { justify-content: center !important; }

            @media (max-width: 1023px) {
              .app-sidebar {
                position: fixed;
                left: 0;
                top: 0;
                height: 100vh;
                z-index: 1000;
                transform: translateX(-100%);
                width: min(320px, 80vw);
              }
              .app-sidebar[data-collapsed="false"] {
                transform: translateX(0);
              }
              .sidebar-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(15,23,42,.35);
                backdrop-filter: blur(2px);
              }
            }
          `}</style>

          {typeof window !== "undefined" &&
            window.innerWidth < 1024 &&
            !sidebarCollapsed && (
              <div className="sidebar-backdrop" onClick={() => setSidebarCollapsed(true)} />
            )
          }

          <Sidebar
            className={`app-sidebar border-r border-slate-200 ${sidebarCollapsed ? "px-2" : ""} clay-surface`}
            data-collapsed={sidebarCollapsed ? "true" : "false"}
          >
            <SidebarHeader className={`border-b border-slate-100 ${sidebarCollapsed ? "px-2 py-4" : "p-6"}`}>
              <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between"} gap-3`}>
                <div className="flex items-center gap-3">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b3b1fb7f6f404f0a2709aa/0f7c64ed2_IMG_8954.jpg"
                    alt="Talent Stack"
                    className="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200"
                  />
                  {!sidebarCollapsed && (
                    <div>
                      <h2 className="font-bold text-slate-900 text-lg">Recruiter X</h2>
                      <p className="text-xs text-slate-500">Recruitment Platform</p>
                    </div>
                  )}
                </div>
              </div>
            </SidebarHeader>

            <SidebarContent className={`${sidebarCollapsed ? "px-2" : "p-4"}`}>
              <div className={`flex ${sidebarCollapsed ? "justify-center" : "justify-end"} ${sidebarCollapsed ? "px-0 pt-2" : "px-2 pt-2"} mb-1`}>
                <div className="inline-flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="clay-button h-7 w-7"
                    onClick={toggleSidebar}
                    title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    aria-label="Toggle sidebar"
                    aria-pressed={!sidebarCollapsed}
                  >
                    {sidebarCollapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
                  </Button>
                  {!sidebarCollapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`clay-button h-7 w-7 ${sidebarPinned ? "text-blue-700" : "text-slate-600"}`}
                      onClick={togglePin}
                      title={sidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                      aria-label={sidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
                      aria-pressed={sidebarPinned}
                    >
                      {sidebarPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              <SidebarGroup>
                <SidebarGroupLabel className={`sidebar-group-label text-xs font-semibold text-slate-500 uppercase tracking-wider ${sidebarCollapsed ? "hidden" : "px-3 py-2"}`}>
                  Main Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1">
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg ${
                            location.pathname === item.url
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={item.url}
                            title={sidebarCollapsed ? item.title : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {isAdmin && (
                <SidebarGroup className="mt-6">
                  <SidebarGroupLabel className={`sidebar-group-label text-xs font-semibold text-slate-500 uppercase tracking-wider ${sidebarCollapsed ? "hidden" : "px-3 py-2"}`}>
                    Admin Controls
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("AccessControl")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("AccessControl?hide_badge=true")}
                            title={sidebarCollapsed ? "Access Control" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <Settings className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Access Control</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("Approvals")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("Approvals")}
                            title={sidebarCollapsed ? "Approvals" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Approvals</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("JobStack")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("JobStack")}
                            title={sidebarCollapsed ? "Job Stack (Public)" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <Briefcase className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Job Stack (Public)</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("AIAgents")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("AIAgents")}
                            title={sidebarCollapsed ? "AI Agents" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <Brain className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>AI Agents</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("EmailBlast")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("EmailBlast")}
                            title={sidebarCollapsed ? "Email Blast" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <MailPlus className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Email Blast</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("AutomationRules")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("AutomationRules")}
                            title={sidebarCollapsed ? "Automation Rules" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <Zap className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Automation Rules</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("BRD")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("BRD")}
                            title={sidebarCollapsed ? "BRD" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <FileText className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>BRD</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>

                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          className={`transition-all duration-200 rounded-lg ${
                            location.pathname === createPageUrl("EmailInbox")
                              ? 'bg-blue-50 text-blue-700 shadow-sm border-r-2 border-blue-600'
                              : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                          } ${sidebarCollapsed ? "justify-center px-2" : ""}`}
                        >
                          <Link
                            to={createPageUrl("EmailInbox")}
                            title={sidebarCollapsed ? "Email Inbox" : undefined}
                            className={`flex items-center ${sidebarCollapsed ? "sidebar-icon-center gap-0 px-0 py-2.5" : "gap-3 px-3 py-2.5"}`}
                          >
                            <Mail className="w-5 h-5" />
                            <span className={`font-medium sidebar-label ${sidebarCollapsed ? "hidden" : "inline"}`}>Email Inbox</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              <AccountsNav location={location} collapsed={sidebarCollapsed} />

              {!skipQuickStats && (
                <SidebarGroup className="mt-8">
                  <SidebarGroupLabel className={`sidebar-group-label text-xs font-semibold text-slate-500 uppercase tracking-wider ${sidebarCollapsed ? "hidden" : "px-3 py-2"}`}>
                    Quick Stats
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <div className={`px-3 py-2 space-y-3 ${sidebarCollapsed ? "hidden" : ""}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Active Jobs</span>
                        <span className="font-semibold text-slate-900">
                          {qsLoading ? <span className="inline-block w-6 h-4 bg-slate-200 rounded animate-pulse" /> : quickStats.activeJobs}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">New Candidates</span>
                        <span className="font-semibold text-blue-600">
                          {qsLoading ? <span className="inline-block w-6 h-4 bg-slate-200 rounded animate-pulse" /> : quickStats.newCandidates}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">This Month</span>
                        <span className="font-semibold text-green-600">
                          {qsLoading ? <span className="inline-block w-16 h-4 bg-slate-200 rounded animate-pulse" /> : `${quickStats.thisMonthPlacements} Placed`}
                        </span>
                      </div>
                    </div>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>

            <SidebarFooter className={`border-t border-slate-100 ${sidebarCollapsed ? "px-2 py-3" : "p-4"}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={`w-full justify-start gap-3 p-3 h-auto ${sidebarCollapsed ? "justify-center" : ""}`}>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">
                        {me?.full_name ? me.full_name.charAt(0).toUpperCase() : (me?.email ? me.email.charAt(0).toUpperCase() : 'U')}
                      </AvatarFallback>
                    </Avatar>
                    {!sidebarCollapsed && (
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{me?.full_name || me?.email || 'User Account'}</p>
                        <p className="text-xs text-slate-500 truncate">{myRole?.name || 'User'}</p>
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <User className="w-4 h-4 mr-2" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Company Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col min-w-0">
            <header className="clay-surface border-b border-slate-200 px-6 py-4 flex items-center gap-4">
              <SidebarTrigger className="md:hidden hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />

              <div className="flex-1 max-w-md">
                <div 
                  className="relative cursor-pointer"
                  onClick={() => setCommandPaletteOpen(true)}
                >
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <div className="pl-10 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-white hover:border-slate-300 transition-colors">
                    Search anything...
                  </div>
                  <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-white border border-slate-200 rounded">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="relative clay-button">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </Button>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              <div className="relative min-h-full">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b3b1fb7f6f404f0a2709aa/fcbc8527f_IMG_8954.jpg"
                    alt="Talent Stack background logo"
                    className="w-[520px] max-w-[70vw] opacity-[0.05]"
                  />
                </div>
                <div className="relative z-10 px-4 md:px-6 lg:pr-6 lg:pl-0 pb-6">
                  {isBlocked ? (
                    <AccessBlocker user={me} />
                  ) : (
                    <>
                      {children}
                      {renderAssistant && currentPageName !== "AccessControl" && <Assistant currentPageName={currentPageName} />}
                    </>
                  )}
                </div>
              </div>
            </div>
          </main>

          <RightPreviewPanel
            open={preview.open}
            title={`${preview.entity || ""} Details`}
            onClose={closePreview}
          >
            {!preview.open ? null : (
              preview.entity === "Candidate" ? <CandidatePreviewLoader id={preview.id} /> :
              preview.entity === "Job" ? <JobPreview id={preview.id} /> :
              preview.entity === "Company" ? <CompanyPreview id={preview.id} /> :
              preview.entity === "Application" ? <ApplicationPreview id={preview.id} /> :
              preview.entity === "Task" ? <TaskPreview id={preview.id} /> :
              preview.entity === "Playbook" ? <PlaybookPreview id={preview.id} /> :
              <div className="text-sm text-slate-600">Unsupported preview.</div>
            )}
          </RightPreviewPanel>
        </div>
        
        <CommandPalette 
          open={commandPaletteOpen} 
          onClose={() => setCommandPaletteOpen(false)} 
        />
        <QuickActions onAction={handleQuickAction} />
        <AIQuickActions 
          open={aiQuickActionsOpen} 
          onClose={() => setAiQuickActionsOpen(false)} 
        />
        <KeyboardShortcuts 
          open={shortcutsOpen} 
          onClose={() => setShortcutsOpen(false)} 
        />
        <NotificationToast />
      </SidebarProvider>
    </PermissionsProvider>
  );
}