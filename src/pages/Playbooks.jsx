import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Playbook } from "@/entities/Playbook";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  Star, 
  TrendingUp,
  Clock,
  Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import PlaybookSmartSearch from "@/components/playbooks/PlaybookSmartSearch";
import PlaybookForm from "@/components/playbooks/PlaybookForm";

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    setLoading(true);
    try {
      const data = await Playbook.filter({ is_active: true }, "-updated_date");
      setPlaybooks(data || []);
    } catch (error) {
      console.error("Error loading playbooks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingPlaybook) {
        await Playbook.update(editingPlaybook.id, data);
      } else {
        await Playbook.create(data);
      }
      await loadPlaybooks();
      setShowForm(false);
      setEditingPlaybook(null);
    } catch (error) {
      console.error("Error saving playbook:", error);
      alert("Failed to save playbook");
    }
  };

  const filteredPlaybooks = playbooks.filter(pb => {
    if (filterCategory === "all") return true;
    return pb.category === filterCategory;
  });

  const sortedPlaybooks = [...filteredPlaybooks].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return (b.usage_count || 0) - (a.usage_count || 0);
      case "rating":
        return (b.effectiveness_rating || 0) - (a.effectiveness_rating || 0);
      case "recent":
      default:
        return new Date(b.updated_date) - new Date(a.updated_date);
    }
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "onboarding", label: "Onboarding" },
    { value: "recruiting", label: "Recruiting" },
    { value: "client_management", label: "Client Management" },
    { value: "procedures", label: "Procedures" },
    { value: "templates", label: "Templates" },
    { value: "best_practices", label: "Best Practices" },
    { value: "interview_guides", label: "Interview Guides" },
    { value: "compliance", label: "Compliance" }
  ];

  const getCategoryColor = (category) => {
    const colors = {
      onboarding: "bg-blue-100 text-blue-800",
      recruiting: "bg-purple-100 text-purple-800",
      client_management: "bg-green-100 text-green-800",
      procedures: "bg-orange-100 text-orange-800",
      templates: "bg-pink-100 text-pink-800",
      best_practices: "bg-yellow-100 text-yellow-800",
      interview_guides: "bg-indigo-100 text-indigo-800",
      compliance: "bg-red-100 text-red-800"
    };
    return colors[category] || "bg-slate-100 text-slate-800";
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-slate-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      <div style={{ padding: "20px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0" }}>
        <Breadcrumbs items={[{ label: "Playbooks" }]} />

        <PageHeader
          title="Knowledge Base & Playbooks"
          subtitle="Document and share best practices, processes, and workflows"
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setShowSearch(!showSearch)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 500,
                  border: "1px solid #E2E8F0",
                  background: "#fff",
                  color: "#64748B",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 100ms"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748B"; }}
              >
                <Search style={{ width: 14, height: 14 }} />
                Smart Search
              </button>
              <button
                onClick={() => {
                  setEditingPlaybook(null);
                  setShowForm(true);
                }}
                style={{
                  padding: "7px 18px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "#9333EA",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(0,113,227,.3)",
                  transition: "all 100ms"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#A855F7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#9333EA"; }}
              >
                <Plus style={{ width: 14, height: 14 }} />
                New Playbook
              </button>
            </div>
          }
        />

        {/* Smart Search */}
        {showSearch && (
          <PlaybookSmartSearch />
        )}

        {/* Filters and Sort */}
        <div style={{ padding: "14px 18px", background: "#fff", borderRadius: 16, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter style={{ width: 14, height: 14, color: "#94A3B8" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".01em" }}>Filter:</span>
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilterCategory(cat.value)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 20,
                    fontSize: 13,
                    fontWeight: filterCategory === cat.value ? 600 : 500,
                    border: "none",
                    background: filterCategory === cat.value ? "#0F172A" : "#fff",
                    color: filterCategory === cat.value ? "#fff" : "#64748B",
                    cursor: "pointer",
                    boxShadow: filterCategory === cat.value ? "none" : "0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)",
                    transition: "all 100ms"
                  }}
                  onMouseEnter={(e) => { if (filterCategory !== cat.value) { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; } }}
                  onMouseLeave={(e) => { if (filterCategory !== cat.value) { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748B"; } }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".01em" }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  fontSize: 13,
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: "5px 10px",
                  background: "#fff",
                  color: "#0F172A",
                  cursor: "pointer",
                  fontWeight: 500
                }}
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

      {/* Playbooks Grid */}
      <div style={{ padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {sortedPlaybooks.map((playbook) => (
            <div
              key={playbook.id}
              style={{
                background: "#fff",
                borderRadius: 16,
                border: "1px solid #E2E8F0",
                padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.05)",
                transition: "box-shadow 120ms, border 120ms",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,.10),0 0 0 .5px rgba(0,0,0,.05)";
                e.currentTarget.style.borderColor = "#BFDBFE";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.05)";
                e.currentTarget.style.borderColor = "#E2E8F0";
              }}
            >
              {/* Header with category and rating */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,113,227,.10)", color: "#9333EA", textTransform: "uppercase", letterSpacing: ".01em" }}>
                  {playbook.category.replace(/_/g, " ")}
                </span>
                {playbook.effectiveness_rating && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#F59E0B" }}>
                    <Star style={{ width: 14, height: 14, fill: "#F59E0B" }} />
                    {playbook.effectiveness_rating.toFixed(1)}
                  </div>
                )}
              </div>

              {/* Title */}
              <Link
                to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)}
                style={{ textDecoration: "none" }}
              >
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 8, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {playbook.title}
                </h3>
              </Link>

              {/* Description */}
              {playbook.description && (
                <p style={{ fontSize: 13, color: "#64748B", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>
                  {playbook.description}
                </p>
              )}

              {/* Tags */}
              {playbook.tags && playbook.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {playbook.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                      {tag}
                    </span>
                  ))}
                  {playbook.tags.length > 3 && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#F8FAFC", color: "#94A3B8", border: "1px solid #E2E8F0" }}>
                      +{playbook.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Meta info */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#94A3B8", paddingTop: 10, borderTop: "1px solid #F2F2F7" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Eye style={{ width: 13, height: 13 }} />
                  {playbook.usage_count || 0}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock style={{ width: 13, height: 13 }} />
                  v{playbook.version || "1.0"}
                </span>
                {playbook.steps && (
                  <span>{playbook.steps.length} steps</span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Link to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)} style={{ flex: 1, textDecoration: "none" }}>
                  <button style={{ width: "100%", padding: "6px 12px", borderRadius: 12, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 100ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; }}>
                    <BookOpen style={{ width: 13, height: 13 }} />
                    View
                  </button>
                </Link>
                <button
                  onClick={() => {
                    setEditingPlaybook(playbook);
                    setShowForm(true);
                  }}
                  style={{ flex: 1, padding: "6px 12px", borderRadius: 12, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 100ms" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#0F172A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#64748B"; }}
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {sortedPlaybooks.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.05)" }}>
            <BookOpen style={{ width: 48, height: 48, color: "#94A3B8", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
              {filterCategory === "all" 
                ? "No playbooks yet" 
                : `No playbooks in ${filterCategory.replace(/_/g, " ")}`}
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20 }}>
              Create your first playbook to document your recruitment processes
            </p>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: "8px 20px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                border: "none",
                background: "#9333EA",
                color: "#fff",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(0,113,227,.3)"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#A855F7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#9333EA"; }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              Create Playbook
            </button>
          </div>
        )}
      </div>

      {/* Playbook Form Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 800, maxHeight: "90vh", overflow: "auto", borderRadius: 20, background: "#fff" }}>
            <PlaybookForm
              playbook={editingPlaybook}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingPlaybook(null);
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}