import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  Users,
  Briefcase,
  Building2,
  Send,
  CheckSquare,
  BookOpen,
  Settings,
  Zap,
  Mail,
  BarChart3,
  Clock,
  Receipt,
  Wallet
} from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import { Company } from "@/entities/Company";
import { Job } from "@/entities/Job";
const NAVIGATION_ITEMS = [
  { title: "Dashboard", url: "Dashboard", icon: BarChart3, keywords: ["home", "overview"] },
  { title: "Candidates", url: "Candidates", icon: Users, keywords: ["talent", "people"] },
  { title: "Jobs", url: "Jobs", icon: Briefcase, keywords: ["positions", "roles", "openings"] },
  { title: "Companies", url: "Companies", icon: Building2, keywords: ["clients", "connections"] },
  { title: "Applications", url: "Submissions", icon: Send, keywords: ["submissions", "pipeline"] },
  { title: "Tasks", url: "Tasks", icon: CheckSquare, keywords: ["todo", "work"] },
  { title: "Playbooks", url: "Playbooks", icon: BookOpen, keywords: ["guides", "docs"] },
  { title: "My Work", url: "MyWork", icon: Clock, keywords: ["personal"] },
  { title: "Automation Rules", url: "AutomationRules", icon: Zap, keywords: ["automation", "rules", "workflows"] },
  { title: "Email Settings", url: "EmailSettings", icon: Mail, keywords: ["email", "integration"] },
  { title: "Invoices", url: "Invoices", icon: Receipt, keywords: ["billing", "payments"] },
  { title: "Expenses", url: "Expenses", icon: Wallet, keywords: ["costs", "spending"] },
  { title: "Access Control", url: "AccessControl", icon: Settings, keywords: ["permissions", "roles", "users"] }
];

export default function CommandPalette({ open, onClose }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIndex(0);
      loadRecentSearches();
      searchAll("");
    }
  }, [open]);

  const loadRecentSearches = () => {
    try {
      const recent = JSON.parse(localStorage.getItem("recent_searches") || "[]");
      setRecentSearches(recent.slice(0, 5));
    } catch (e) {
      setRecentSearches([]);
    }
  };

  const saveRecentSearch = (item) => {
    try {
      const recent = JSON.parse(localStorage.getItem("recent_searches") || "[]");
      const filtered = recent.filter(r => r.id !== item.id);
      filtered.unshift(item);
      localStorage.setItem("recent_searches", JSON.stringify(filtered.slice(0, 10)));
    } catch (e) {}
  };

  const searchAll = useCallback(async (query) => {
    const q = query.toLowerCase().trim();
    
    // Search navigation
    const navResults = NAVIGATION_ITEMS.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.keywords?.some(k => k.includes(q))
    ).map(item => ({ ...item, type: "navigation" }));

    if (!q) {
      setResults([...navResults.slice(0, 8)]);
      return;
    }

    try {
      // Search candidates, jobs, companies
      const [candidates, jobs, companies] = await Promise.all([
        Candidate.list("-updated_date", 10),
        Job.list("-updated_date", 10),
        Company.list("-updated_date", 10)
      ]);

      const candidateResults = candidates
        .filter(c => 
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.skills?.some(s => s.toLowerCase().includes(q))
        )
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.current_title || c.email,
          url: `CandidateDetails?id=${c.id}`,
          icon: Users,
          type: "candidate"
        }));

      const jobResults = jobs
        .filter(j => 
          j.title?.toLowerCase().includes(q) ||
          j.location?.toLowerCase().includes(q)
        )
        .slice(0, 5)
        .map(j => ({
          id: j.id,
          title: j.title,
          subtitle: j.location || j.status,
          url: `JobDetails?id=${j.id}`,
          icon: Briefcase,
          type: "job"
        }));

      const companyResults = companies
        .filter(c => 
          c.name?.toLowerCase().includes(q) ||
          c.industry?.toLowerCase().includes(q)
        )
        .slice(0, 5)
        .map(c => ({
          id: c.id,
          title: c.name,
          subtitle: c.industry || c.location,
          url: `CompanyDetails?id=${c.id}`,
          icon: Building2,
          type: "company"
        }));

      setResults([
        ...navResults.slice(0, 3),
        ...candidateResults,
        ...jobResults,
        ...companyResults
      ]);
    } catch (e) {
      console.error("Search error:", e);
      setResults(navResults);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchAll(search), 200);
    return () => clearTimeout(timer);
  }, [search, searchAll]);

  const handleSelect = (item) => {
    saveRecentSearch(item);
    navigate(createPageUrl(item.url));
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for anything..."
            className="flex-1 outline-none text-lg"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-slate-100 rounded">Esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!search && recentSearches.length > 0 && (
            <div className="p-2 border-b">
              <div className="text-xs text-slate-500 px-3 py-2">Recent</div>
              {recentSearches.map((item, i) => {
                const Icon = item.icon || Search;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left"
                  >
                    <Icon className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-sm text-slate-500 truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {results.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No results found</p>
            </div>
          ) : (
            <div className="p-2">
              {results.map((item, i) => {
                const Icon = item.icon || Search;
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      i === selectedIndex ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-5 h-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-sm text-slate-500 truncate">{item.subtitle}</div>
                      )}
                    </div>
                    {item.type && (
                      <span className="text-xs text-slate-400 capitalize">{item.type}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white rounded">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-white rounded">⏎</kbd>
              Select
            </span>
          </div>
          <span>Press <kbd className="px-2 py-1 bg-white rounded">⌘K</kbd> to open</span>
        </div>
      </div>
    </div>
  );
}