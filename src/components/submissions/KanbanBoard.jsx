import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Submission } from "@/entities/Submission";
import { executeAutomationRules } from "@/components/automation/executeAutomation";
import { Plus } from "lucide-react";

const COLUMNS = [
  { id: "submitted",    label: "Submitted",    color: "#3B82F6", bg: "rgba(59,130,246,.08)" },
  { id: "under_review", label: "Screening",    color: "#F59E0B", bg: "rgba(245,158,11,.08)" },
  { id: "interviewing", label: "Interviewing", color: "#8B5CF6", bg: "rgba(139,92,246,.08)" },
  { id: "offered",      label: "Offer",        color: "#10B981", bg: "rgba(16,185,129,.08)" },
  { id: "hired",        label: "Hired",        color: "#10B981", bg: "rgba(48,161,78,.08)"  },
  { id: "rejected",     label: "Rejected",     color: "#EF4444", bg: "rgba(239,68,68,.08)"  },
  { id: "withdrawn",    label: "Withdrawn",    color: "#6B7280", bg: "rgba(107,114,128,.08)"},
];

const statusBadge = {
  submitted:    { bg: "rgba(59,130,246,.12)",   c: "#2563EB" },
  under_review: { bg: "rgba(245,158,11,.12)",   c: "#D97706" },
  interviewing: { bg: "rgba(139,92,246,.12)",   c: "#7C3AED" },
  offered:      { bg: "rgba(16,185,129,.12)",   c: "#059669" },
  hired:        { bg: "rgba(48,161,78,.12)",    c: "#16A34A" },
  rejected:     { bg: "rgba(239,68,68,.12)",    c: "#DC2626" },
  withdrawn:    { bg: "rgba(107,114,128,.12)",  c: "#6B7280" },
};

function avatarGrad(name) {
  const palette = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#EF4444,#DC2626","#0EA5E9,#0284C7","#EC4899,#DB2777"];
  const p = palette[(name?.charCodeAt(0) || 0) % palette.length].split(",");
  return `linear-gradient(135deg,${p[0]},${p[1]})`;
}
function initials(name) {
  return name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
}
function timeAgo(d) {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  return days === 0 ? "Today" : days === 1 ? "1d ago" : days < 7 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
}

function KanbanCard({ submission, candidate, job, company, onClick, drag }) {
  const sb = statusBadge[submission.status] || statusBadge.submitted;
  const candName = candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown";
  const jobTitle = job?.title || "Unknown Role";
  const compName = company?.name || job?.hiring_manager || "";
  const location = job?.location || "";
  const rate = job?.rate || "";

  return (
    <div
      ref={drag.innerRef}
      {...drag.draggableProps}
      {...drag.dragHandleProps}
      onClick={() => onClick?.(submission)}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #E2E8F0",
        padding: "14px 16px",
        marginBottom: 10,
        cursor: "pointer",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        userSelect: "none",
        // MUST come last: hello-pangea injects the drag transform via
        // draggableProps.style — declaring style after the spread was
        // clobbering it, so cards never visually moved.
        ...drag.draggableProps.style,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,.10)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.06)"}
    >
      {/* Job title */}
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 3, lineHeight: 1.3 }}>{jobTitle}</div>

      {/* Company · location · rate */}
      <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 10 }}>
        {[compName, location, rate ? rate : null].filter(Boolean).join(" · ")}
      </div>

      {/* Status badge + AI score if present */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: sb.bg, color: sb.c }}>
          {(submission.status || "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
        </span>
        {submission.match_score != null && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: "rgba(0,113,227,.10)", color: "#9333EA" }}>
            ⚡ {submission.match_score} AI fit
          </span>
        )}
        {submission.submitted_date && (
          <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>
            {timeAgo(submission.submitted_date)}
          </span>
        )}
      </div>

      {/* Avatar + candidate name + count hint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: avatarGrad(candName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
            {initials(candName)}
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>{candName}</span>
        </div>
        {candidate?.current_title && (
          <span style={{ fontSize: 11, color: "#94A3B8" }}>{candidate.current_title}</span>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ submissions = [], candidates = [], jobs = [], companies = [], onSubmissionClick, onRefresh, onAddNew }) {
  const candMap = React.useMemo(() => Object.fromEntries(candidates.map(c => [c.id, c])), [candidates]);
  const jobMap  = React.useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const compMap = React.useMemo(() => Object.fromEntries((companies||[]).map(c => [c.id, c])), [companies]);

  const grouped = React.useMemo(() => {
    const colIds = COLUMNS.map(c => c.id);
    const map = Object.fromEntries(colIds.map(c => [c, []]));
    submissions.forEach(s => {
      const col = colIds.includes(s.status) ? s.status : "submitted";
      map[col].push(s);
    });
    return map;
  }, [submissions]);

  const handleDragEnd = async (result) => {
    if (!result?.destination) return;
    const { draggableId, destination } = result;
    const destStatus = destination.droppableId;
    if (!destStatus) return;
    try {
      const old = submissions.find(s => s.id === draggableId);
      if (!old) return;
      await Submission.update(draggableId, { status: destStatus });
      executeAutomationRules("Submission", draggableId, old, { ...old, status: destStatus }).catch(() => {});
      if (onRefresh) onRefresh();
    } catch (e) {
      console.warn("Kanban drag failed:", e);
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {/* No overflowX here: Layout's main area already scrolls, and
          @hello-pangea/dnd refuses to lift inside NESTED scroll parents
          ("unsupported nested scroll container") — drag was dead. */}
      <div style={{ display: "flex", gap: 14, paddingBottom: 16, alignItems: "flex-start", width: "max-content", minWidth: "100%" }}>
        {COLUMNS.map(col => (
          <Droppable droppableId={col.id} key={col.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                style={{
                  minWidth: 250,
                  width: 260,
                  flexShrink: 0,
                  background: snapshot.isDraggingOver ? col.bg : "#F8FAFC",
                  borderRadius: 14,
                  padding: "12px 12px 6px",
                  border: `1px solid ${snapshot.isDraggingOver ? col.color + "44" : "#E2E8F0"}`,
                  transition: "background 150ms, border 150ms",
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: col.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{col.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: col.color, background: col.bg, padding: "1px 8px", borderRadius: 20 }}>
                    {grouped[col.id]?.length || 0}
                  </span>
                </div>

                {/* Cards */}
                {(grouped[col.id] || []).map((s, i) => (
                  <Draggable draggableId={s.id} index={i} key={s.id}>
                    {(drag) => (
                      <KanbanCard
                        submission={s}
                        candidate={candMap[s.candidate_id]}
                        job={jobMap[s.job_id]}
                        company={compMap[jobMap[s.job_id]?.company_id]}
                        onClick={onSubmissionClick}
                        drag={drag}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                {/* Add role CTA */}
                <button
                  onClick={() => onAddNew?.()}
                  style={{ width: "100%", padding: "8px", borderRadius: 10, border: "1.5px dashed #C7C7CC", background: "transparent", cursor: "pointer", fontSize: 12, color: "#94A3B8", fontWeight: 500, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                  className="hover:border-slate-400 hover:text-slate-500 transition-colors"
                >
                  <Plus style={{ width: 13, height: 13 }} /> Add Application
                </button>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}