import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users, Briefcase, Building2, BarChart3, Settings, User, LogOut,
  Search, Bell, Send, CheckSquare, BookOpen, BrainCircuit, FileText,
  Mail, Clock, CheckCircle, Wallet, Receipt, Zap, AlertTriangle,
  Loader2, Brain, MailPlus, MoreHorizontal, Inbox, Activity, MailCheck, MessageCircle,
  Sparkles, Home, ChevronRight, Video, Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { lazy, Suspense } from "react";
import { PermissionsProvider } from "@/components/common/PermissionsContext";
import { usePermissions } from "@/components/common/PermissionsContext";
import { User as UserEntity } from "@/entities/User";
import { Candidate, Job, Application, Task } from "@/entities/all";
import { AuditLog } from "@/entities/AuditLog";
import { Role } from "@/entities/Role";
import AccessBlocker from "@/components/common/AccessBlocker";
import { getRolesCached, invalidateRolesCache } from "@/components/utils/rolesCache";
import { getUserCached, invalidateUserCache, getQuickStatsCached, getCachedUser } from "@/lib/appCache";
import NotificationToast from "@/components/notifications/NotificationToast";
import RightPreviewPanel from "@/components/common/RightPreviewPanel";
import CandidatePreviewLoader from "@/components/previews/CandidatePreviewLoader";
import JobPreviewLoader from "@/components/previews/JobPreviewLoader";
import CompanyPreviewLoader from "@/components/previews/CompanyPreviewLoader";
import ApplicationPreview from "@/components/previews/ApplicationPreview";
import TaskPreview from "@/components/previews/TaskPreview";
import PlaybookPreview from "@/components/previews/PlaybookPreview";

// Lazy-load heavy layout tools
const Assistant = lazy(() => import("@/components/ai/Assistant"));
const CommandPalette = lazy(() => import("@/components/common/CommandPalette"));
const QuickActions = lazy(() => import("@/components/common/QuickActions"));
const KeyboardShortcuts = lazy(() => import("@/components/common/KeyboardShortcuts"));
const AIQuickActions = lazy(() => import("@/components/common/AIQuickActions"));

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

// ── HubSpot-style nav groups ────────────────────────────────────────────────
// Each group is one icon on the 56px rail. Hover → flyout panel with its items.
const navGroups = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    items: [
      { title: "Dashboard", url: createPageUrl("Dashboard"), icon: BarChart3, badge: "Live", badgeColor: "blue" },
      { title: "My Work", url: createPageUrl("MyWork"), icon: Clock },
    ],
  },
  {
    id: "recruiting",
    label: "Recruiting",
    icon: Users,
    items: [
      { title: "Candidates", url: createPageUrl("Candidates"), icon: Users },
      { title: "Jobs", url: createPageUrl("Jobs"), icon: Briefcase },
      { title: "Connections", url: createPageUrl("Companies"), icon: Building2 },
      { title: "Applications", url: createPageUrl("Submissions"), icon: Send },
      { title: "Bookings", url: createPageUrl("Bookings"), icon: CalendarIcon, badge: "New", badgeColor: "blue" },
      { title: "Video Call", url: createPageUrl("VideoCall"), icon: Video },
      { title: "Tasks", url: createPageUrl("Tasks"), icon: CheckSquare },
      { title: "Duplicates", url: createPageUrl("DuplicateManager"), icon: AlertTriangle },
    ],
  },
  {
    id: "ai",
    label: "AI & Intelligence",
    icon: Sparkles,
    items: [
      { title: "AI Recruiter", url: "/AIRecruiter", icon: BrainCircuit, badge: "Beta", badgeColor: "blue" },
      { title: "AI Agents", url: createPageUrl("AIAgents"), icon: Brain, badge: "3", badgeColor: "blue" },
      { title: "Resume Studio", url: createPageUrl("ResumeStudio"), icon: BrainCircuit },
      { title: "Automation", url: createPageUrl("AutomationRules"), icon: Zap },
      { title: "Approval Queue", url: createPageUrl("ApprovalQueue"), icon: MailCheck },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Zap,
    items: [
      { title: "Playbooks", url: createPageUrl("Playbooks"), icon: BookOpen },
    ],
  },
  {
    id: "comms",
    label: "Communication",
    icon: Inbox,
    items: [
      { title: "Email Inbox", url: createPageUrl("EmailInbox"), icon: Mail },
      { title: "Channel Inbox", url: createPageUrl("ChannelInbox"), icon: Inbox, gate: "admin" },
      { title: "WhatsApp Setup", url: createPageUrl("WhatsappSetup"), icon: MessageCircle, gate: "admin" },
      { title: "Email Settings", url: createPageUrl("EmailSettings"), icon: Mail },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: Wallet,
    gate: "accounts",
    items: [
      { title: "Invoices", url: createPageUrl("Invoices"), icon: Receipt, gate: "Invoice" },
      { title: "Expenses", url: createPageUrl("Expenses"), icon: Wallet, gate: "Expense" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Settings,
    gate: "admin",
    items: [
      { title: "Access Control", url: createPageUrl("AccessControl?hide_badge=true"), icon: Settings, matchUrl: createPageUrl("AccessControl") },
      { title: "Approvals", url: createPageUrl("Approvals"), icon: CheckCircle },
      { title: "Job Stack", url: createPageUrl("JobStack"), icon: Briefcase },
      { title: "Email Blast", url: createPageUrl("EmailBlast"), icon: MailPlus },
      { title: "BRD", url: createPageUrl("BRD"), icon: FileText },
      { title: "System Health", url: createPageUrl("SystemHealth"), icon: Activity },
    ],
  },
];

// Which group "owns" the current path? Used to highlight the rail icon.
function activeGroupId(pathname) {
  for (const g of navGroups) {
    for (const it of g.items) {
      const match = it.matchUrl || it.url;
      if (pathname === match) return g.id;
    }
  }
  return null;
}

// Filter items by permission gate within a group
function visibleItems(group, { isAdmin, can }) {
  if (group.gate === "admin" && !isAdmin) return [];
  return group.items.filter(it => {
    if (!it.gate) return true;
    if (it.gate === "admin") return isAdmin;
    return can(it.gate, "view");
  });
}

// Rail icon button (56px column)
function RailButton({ group, isActive, isHover, onMouseEnter, onMouseLeave, onClick }) {
  const Icon = group.icon;
  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      aria-label={group.label}
      title={group.label}
      style={{ position: 'relative' }}
      className={`flex items-center justify-center w-10 h-10 rounded-[10px] transition-colors duration-150 ${
        isActive
          ? 'bg-[rgba(147,51,234,.10)] text-[#9333EA]'
          : isHover
            ? 'bg-slate-100 text-slate-700'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {isActive && (
        <span style={{
          position: 'absolute', left: -10, top: 8, bottom: 8, width: 3,
          background: 'linear-gradient(180deg,#9333EA 0%,#2563EB 100%)',
          borderRadius: 2,
        }} />
      )}
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}

// Flyout sub-nav item
function FlyoutItem({ item, active, onNavigate }) {
  const Icon = item.icon || ChevronRight;
  const badgeCls = item.badgeColor === 'blue' ? 'bg-purple-50 text-[#9333EA]'
    : item.badgeColor === 'green' ? 'bg-emerald-50 text-emerald-600'
    : item.badgeColor === 'orange' ? 'bg-orange-50 text-orange-500'
    : 'bg-slate-50 text-slate-500';
  return (
    <Link
      to={item.url}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-130 select-none ${
        active
          ? 'bg-[rgba(147,51,234,.08)] text-[#9333EA] font-semibold'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-[15px] h-[15px] flex-shrink-0 ${active ? 'text-[#9333EA]' : 'text-slate-400'}`} />
      <span className="flex-1 truncate">{item.title}</span>
      {item.badge !== undefined && (
        <span className={`text-[10.5px] font-semibold px-[7px] py-px rounded-full ${badgeCls}`}>{item.badge}</span>
      )}
    </Link>
  );
}

// Build a breadcrumb (group label / page title) from current path.
function getBreadcrumb(pathname) {
  for (const g of navGroups) {
    for (const it of g.items) {
      const match = it.matchUrl || it.url;
      if (pathname === match) return { group: g.label, page: it.title };
    }
  }
  return { group: null, page: null };
}

// Rail + flyout. Calls usePermissions (must be a child of PermissionsProvider).
function SidebarRail({ isAdmin, activeGid, hoveredGid, hoveredGroupObj, scheduleOpenGroup, scheduleCloseFlyout, cancelClose, currentPath }) {
  const { can } = usePermissions();
  const renderableGroups = navGroups
    .map(g => ({ group: g, items: visibleItems(g, { isAdmin, can }) }))
    .filter(({ items }) => items.length > 0);

  const flyoutItems = hoveredGroupObj
    ? visibleItems(hoveredGroupObj, { isAdmin, can })
    : [];

  return (
    <>
      <aside className="rx-rail" onMouseLeave={scheduleCloseFlyout}>
        {/* Logo */}
        <div
          style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg,#9333EA 0%,#2563EB 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: '-.04em',
            margin: '10px 0 6px',
            boxShadow: '0 4px 14px -4px rgba(147,51,234,.45)',
          }}
          title="Recruiter X"
        >RX</div>

        <div className="rx-rail-scroll">
          {renderableGroups.map(({ group }, idx) => {
            // Visual divider before Operations and Accounts
            const showDivider = group.id === 'operations' || group.id === 'accounts';
            return (
              <React.Fragment key={group.id}>
                {showDivider && <div className="rx-rail-divider" />}
                <RailButton
                  group={group}
                  isActive={activeGid === group.id}
                  isHover={hoveredGid === group.id}
                  onMouseEnter={() => scheduleOpenGroup(group.id)}
                  onMouseLeave={scheduleCloseFlyout}
                />
              </React.Fragment>
            );
          })}
        </div>
      </aside>

      {/* Flyout panel anchored to the right of the rail */}
      <div
        className={`rx-flyout ${hoveredGid ? 'open' : ''}`}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleCloseFlyout}
      >
        {hoveredGroupObj && (
          <>
            <div className="rx-flyout-header">
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#9333EA', textTransform: 'uppercase' }}>
                  {hoveredGroupObj.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>
                  {hoveredGroupObj.label}
                </div>
              </div>
            </div>
            <div className="rx-flyout-body">
              {flyoutItems.map(it => (
                <FlyoutItem
                  key={it.url}
                  item={it}
                  active={(it.matchUrl || it.url) === currentPath}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Seed from cache synchronously — no spinner on navigation if user already loaded
  const [me, setMe] = React.useState(() => getCachedUser() || null);
  const [myRole, setMyRole] = React.useState(null);
  const [quickStats, setQuickStats] = React.useState({ activeJobs: 0, newCandidates: 0, thisMonthPlacements: 0 });
  const [qsLoading, setQsLoading] = React.useState(true);
  const [checkingAccess, setCheckingAccess] = React.useState(() => !getCachedUser());

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
        try { localStorage.setItem("sidebar_collapsed", JSON.stringify(next)); } catch { /* localStorage may be unavailable */ }
      }
      return next;
    });
  }, [sidebarPinned]);

  const togglePin = React.useCallback(() => {
    setSidebarPinned(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar_pinned", JSON.stringify(next)); } catch { /* localStorage may be unavailable */ }
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
    let activityTimeout = null;
    
    const handleActivity = () => {
      if (activityTimeout) clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => resetLogoutTimer(), 100);
    };

    events.forEach(event => window.addEventListener(event, handleActivity));
    resetLogoutTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (activityTimeout) clearTimeout(activityTimeout);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
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

  // Load quick stats using unified cross-navigation cache
  React.useEffect(() => {
    if (skipQuickStats) { setQsLoading(false); return; }

    const loadQuickStats = async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      const stats = await getQuickStatsCached(async () => {
        const [jobsData, candidatesData, applicationsData] = await Promise.all([
          Job.filter({ status: 'open' }, '', 50).catch(() => []),
          Candidate.filter({ status: 'active' }, '-created_date', 30).catch(() => []),
          Application.filter({ status: 'hired' }, '-created_date', 20).catch(() => [])
        ]);
        const activeJobs = (jobsData || []).length;
        const newCandidates = (candidatesData || []).filter(c => new Date(c.created_date) >= sevenDaysAgo).length;
        const thisMonthPlacements = (applicationsData || []).filter(app => {
          const d = new Date(app.created_date);
          return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }).length;
        return { activeJobs, newCandidates, thisMonthPlacements };
      });

      setQuickStats(stats);
      setQsLoading(false);
    };

    loadQuickStats();
  }, [skipQuickStats]);

  React.useEffect(() => {
    const t = setTimeout(() => setRenderAssistant(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // ENHANCED: User access check with immediate logout for inactive users
  React.useEffect(() => {
    const loadUser = async () => {
      const now = Date.now();
      if (userGuard.current.inFlight || now - userGuard.current.ts < 120000) {
        setCheckingAccess(false);
        return;
      }
      
      userGuard.current.inFlight = true;
      userGuard.current.ts = now;
      setCheckingAccess(true);

      try {
        const { user: u, role: foundRole } = await getUserCached();
        
        // CRITICAL: Check if user should be blocked BEFORE setting state
        if (u) {
          const admin = (u.role === "admin") || ((foundRole?.name || "").toLowerCase() === "admin");

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
          setMyRole(foundRole || null);
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
      sessionStorage.setItem("audit_logged", "1");
      // Fire-and-forget, non-blocking
      AuditLog.create({
        user_id: me.id || null,
        user_email: me.email,
        action: "login",
        entity_type: "system",
        new_data: { user_agent: navigator.userAgent || "", app: "Recruiter X" },
      }).catch(() => {});
    };
    logOnce();
  }, [me]);

  // Removed global entity monkey-patching—handle task automation in service mutations instead

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
        try { localStorage.setItem("roles_cache_bust", String(Date.now())); } catch { /* localStorage may be unavailable */ }
      } catch (e) {
        console.warn("Recruiter permission patch failed:", e);
      }
    };
    if (isAdmin && me) {
      patch();
    }
  }, [isAdmin, me]);

  // ── Flyout hover state (declared BEFORE any early return so hook order is stable) ──
  const [hoveredGroup, setHoveredGroup] = React.useState(null);
  const openTimer = React.useRef(null);
  const closeTimer = React.useRef(null);

  const scheduleOpenGroup = React.useCallback((groupId) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setHoveredGroup(groupId), 80);
  }, []);
  const scheduleCloseFlyout = React.useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoveredGroup(null), 180);
  }, []);
  const cancelClose = React.useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  React.useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  React.useEffect(() => { setHoveredGroup(null); }, [location.pathname]);

  // Show loading while checking access
  if (checkingAccess && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: '#9333EA' }} />
          <p style={{ color: '#64748B', fontSize: 13 }}>Verifying access…</p>
        </div>
      </div>
    );
  }

  const initials = me?.full_name
    ? me.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : (me?.email ? me.email[0].toUpperCase() : 'U');

  const activeGid = activeGroupId(location.pathname);
  const hoveredGroupObj = navGroups.find(g => g.id === hoveredGroup) || null;
  const breadcrumb = getBreadcrumb(location.pathname);

  return (
    <PermissionsProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC', fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" }}>
        <style>{`
          /* Thin icon rail (HubSpot pattern) */
          .rx-rail { width:56px; height:100vh; background:#FFFFFF; border-right:1px solid #E2E8F0; display:flex; flex-direction:column; align-items:center; flex-shrink:0; z-index:30; position:relative; }
          .rx-rail-scroll { flex:1; width:100%; overflow-y:auto; overflow-x:hidden; padding:6px 0; display:flex; flex-direction:column; align-items:center; gap:2px; scrollbar-width:none; }
          .rx-rail-scroll::-webkit-scrollbar { display:none; }
          .rx-rail-divider { width:28px; height:1px; background:#E2E8F0; margin:6px 0; }

          /* Flyout panel anchored to the right of the rail */
          .rx-flyout { position:fixed; top:0; left:56px; height:100vh; width:240px; background:#FFFFFF; border-right:1px solid #E2E8F0; box-shadow: 6px 0 24px -12px rgba(15, 23, 42, 0.12); display:flex; flex-direction:column; z-index:29; opacity:0; transform: translateX(-6px); pointer-events:none; transition: opacity 140ms ease, transform 140ms ease; }
          .rx-flyout.open { opacity:1; transform:translateX(0); pointer-events:auto; }
          .rx-flyout-header { height:52px; padding:0 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #E2E8F0; flex-shrink:0; }
          .rx-flyout-body { flex:1; overflow-y:auto; padding:8px; scrollbar-width:none; }
          .rx-flyout-body::-webkit-scrollbar { display:none; }

          .rx-topbar { height:52px; background:#FFFFFF; border-bottom:1px solid #E2E8F0; display:flex; align-items:center; padding:0 16px 0 20px; gap:12px; flex-shrink:0; }

          @keyframes rx-page-in { from { opacity:0; } to { opacity:1; } }
          .rx-page-in { animation: rx-page-in 120ms ease both; }
        `}</style>

        {/* ── RAIL + FLYOUT ── */}
        <SidebarRail
          isAdmin={isAdmin}
          activeGid={activeGid}
          hoveredGid={hoveredGroup}
          hoveredGroupObj={hoveredGroupObj}
          scheduleOpenGroup={scheduleOpenGroup}
          scheduleCloseFlyout={scheduleCloseFlyout}
          cancelClose={cancelClose}
          currentPath={location.pathname}
        />

        {/* ── MAIN ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Topbar with breadcrumb */}
          <header className="rx-topbar">
            <nav aria-label="Breadcrumb" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#64748B', fontWeight:500, flexShrink:0, minWidth:0 }}>
              {breadcrumb.group ? (
                <>
                  <span style={{ whiteSpace:'nowrap' }}>{breadcrumb.group}</span>
                  <ChevronRight style={{ width:14, height:14, color:'#CBD5E1', flexShrink:0 }} />
                  <span style={{ color:'#0F172A', fontWeight:600, whiteSpace:'nowrap' }}>{breadcrumb.page}</span>
                </>
              ) : (
                <span style={{ color:'#0F172A', fontWeight:600 }}>Recruiter X</span>
              )}
            </nav>

            <div
              onClick={() => setCommandPaletteOpen(true)}
              style={{ flex:1, maxWidth:380, display:'flex', alignItems:'center', gap:7, background:'#F1F5F9', borderRadius:10, padding:'6px 11px', cursor:'text' }}
              className="hover:bg-slate-200 transition-colors"
            >
              <Search style={{ width:13, height:13, color:'#64748B', flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13, color:'#64748B' }}>Search candidates, jobs, companies…</span>
              <kbd style={{ fontFamily:"'SF Mono','Menlo',monospace", fontSize:10, color:'#94A3B8', background:'#fff', border:'1px solid #E2E8F0', borderRadius:5, padding:'1px 5px' }}>⌘K</kbd>
            </div>

            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <button
                onClick={() => setAiQuickActionsOpen(true)}
                style={{ display:'flex', alignItems:'center', gap:5, background:'linear-gradient(135deg,#9333EA 0%,#2563EB 100%)', color:'#fff', border:'none', borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:600, cursor:'pointer', letterSpacing:'-.01em', boxShadow:'0 4px 14px -4px rgba(147,51,234,.45)' }}
                className="hover:opacity-90 transition-opacity"
              >
                <Zap style={{ width:12, height:12 }} />
                AI Actions
              </button>
              <button
                onClick={() => {}}
                style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'none', cursor:'pointer', position:'relative', color:'#64748B' }}
                className="hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell style={{ width:16, height:16 }} />
                <div style={{ position:'absolute', top:7, right:7, width:7, height:7, background:'#EF4444', borderRadius:'50%', border:'1.5px solid #fff' }} />
              </button>
              <div style={{ width:1, height:18, background:'#E2E8F0' }} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 8px 4px 4px', borderRadius:999, border:'1px solid #E2E8F0', background:'#fff', cursor:'pointer' }}
                    className="hover:bg-slate-50 transition-colors"
                    aria-label="Account menu"
                  >
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#9333EA 0%,#2563EB 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0, boxShadow:'0 4px 14px -4px rgba(147,51,234,.45)' }}>
                      {initials}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', maxWidth:140 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#0F172A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140 }}>{me?.full_name || me?.email || 'User'}</span>
                      <span style={{ fontSize:10, color:'#94A3B8' }}>{myRole?.name || (me?.role === 'admin' ? 'Administrator' : 'User')}</span>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem><User className="w-4 h-4 mr-2" />Profile Settings</DropdownMenuItem>
                  <DropdownMenuItem><Settings className="w-4 h-4 mr-2" />Company Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={async () => { try { await UserEntity.logout(); } finally { window.localStorage.clear(); navigate("/login"); } }}><LogOut className="w-4 h-4 mr-2" />Sign Out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-auto" style={{ background:'#F8FAFC' }}>
            <div className="rx-page-in">
              {isBlocked ? (
                <AccessBlocker user={me} />
              ) : (
                <>
                  {children}
                  {renderAssistant && currentPageName !== "AccessControl" && currentPageName !== "MyWork" && (
                    <Suspense fallback={null}>
                      <Assistant currentPageName={currentPageName} />
                    </Suspense>
                  )}
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

      <Suspense fallback={null}>
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        <QuickActions onAction={handleQuickAction} />
        <AIQuickActions open={aiQuickActionsOpen} onClose={() => setAiQuickActionsOpen(false)} />
        <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </Suspense>
      <NotificationToast />
    </PermissionsProvider>
  );
}
