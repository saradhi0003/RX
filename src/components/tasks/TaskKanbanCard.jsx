import React from "react";
import { Calendar, User } from "lucide-react";

const PRIORITY_COLORS = {
  low:    { bg: "rgba(107,114,128,.08)", c: "#6B7280" },
  medium: { bg: "rgba(245,158,11,.08)", c: "#D97706" },
  high:   { bg: "rgba(249,115,22,.08)", c: "#EA580C" },
  urgent: { bg: "rgba(239,68,68,.08)", c: "#DC2626" },
};

const STATUS_COLORS = {
  pending:     { bg: "rgba(107,114,128,.08)", c: "#6B7280" },
  in_progress: { bg: "rgba(37,99,235,.08)", c: "#2563EB" },
  completed:   { bg: "rgba(22,163,74,.08)", c: "#16A34A" },
  cancelled:   { bg: "rgba(220,38,38,.08)", c: "#DC2626" },
};

export default function TaskKanbanCard({ task, onClick }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";
  const priBadge = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const staBadge = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
  const ini = (task.assigned_to || "?").slice(0, 1).toUpperCase();

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #F2F2F7",
        padding: 14,
        cursor: "pointer",
        transition: "all 100ms",
        boxShadow: "0 1px 3px rgba(0,0,0,.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.1)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.05)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Title */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {task.title}
      </div>

      {/* Status badge */}
      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: staBadge.bg, color: staBadge.c, display: "inline-block", marginBottom: 10 }}>
        {(task.status || "").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
      </span>

      {/* Divider */}
      <div style={{ height: 1, background: "#F2F2F7", margin: "10px 0" }} />

      {/* Assignee */}
      {task.assigned_to && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#9333EA,#6366F1)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {ini}
          </div>
          <span style={{ fontSize: 12, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.assigned_to.split("@")[0]}
          </span>
        </div>
      )}

      {/* Due date + Priority */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {task.due_date && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: isOverdue ? "#DC2626" : "#94A3B8", fontWeight: isOverdue ? 600 : 400 }}>
            <Calendar style={{ width: 12, height: 12 }} />
            {new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            {isOverdue && " ⚠"}
          </div>
        )}
        {task.priority && (
          <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 20, background: priBadge.bg, color: priBadge.c }}>
            {task.priority}
          </span>
        )}
      </div>

      {/* Related entity */}
      {task.related_entity && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#94A3B8", background: "rgba(0,0,0,.04)", padding: "4px 8px", borderRadius: 6, display: "inline-block" }}>
          {task.related_entity}
        </div>
      )}
    </div>
  );
}