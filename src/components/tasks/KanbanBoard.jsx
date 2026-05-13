import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskKanbanCard from "./TaskKanbanCard";
import { Plus } from "lucide-react";

const COL_COLORS = {
  pending:      { accent: "#6B7280", bg: "#F3F4F6", border: "#D1D5DB", pill: "rgba(107,114,128,.12)" },
  in_progress:  { accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", pill: "rgba(37,99,235,.12)" },
  completed:    { accent: "#16A34A", bg: "#F0FDF4", border: "#BBFBAA", pill: "rgba(22,163,74,.12)" },
  cancelled:    { accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA", pill: "rgba(220,38,38,.12)" },
};

export default function KanbanBoard({ columns = [], tasks = [], onDragEnd, onCardClick }) {
  const grouped = React.useMemo(() => {
    const map = Object.fromEntries(columns.map(c => [c, []]));
    tasks.forEach(t => {
      const col = columns.includes(t.status) ? t.status : columns[0];
      map[col].push(t);
    });
    return map;
  }, [columns, tasks]);

  const statusLabels = {
    pending: "Pending",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 16, alignItems: "flex-start" }}>
        {columns.map((colId) => {
          const col = COL_COLORS[colId] || COL_COLORS.pending;
          return (
            <Droppable droppableId={colId} key={colId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    minWidth: 280,
                    width: 280,
                    flexShrink: 0,
                    minHeight: "500px",
                    background: snapshot.isDraggingOver ? col.pill : col.bg,
                    borderRadius: 16,
                    padding: "12px 12px 6px",
                    border: `1px solid ${snapshot.isDraggingOver ? col.border : col.border}`,
                    transition: "background 100ms",
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 4, height: 18, background: col.accent, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{statusLabels[colId] || colId}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: col.accent, background: col.pill, padding: "1px 8px", borderRadius: 20 }}>
                      {grouped[colId]?.length || 0}
                    </span>
                  </div>

                  {/* Cards */}
                  {(grouped[colId] || []).map((t, i) => (
                    <Draggable draggableId={t.id} index={i} key={t.id}>
                      {(drag) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          {...drag.dragHandleProps}
                          style={{
                            marginBottom: 10,
                          }}
                        >
                          <TaskKanbanCard task={t} onClick={() => onCardClick?.(t)} />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {/* Add card button */}
                  <button
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 10,
                      border: "1.5px dashed #C7C7CC",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "#94A3B8",
                      fontWeight: 500,
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      transition: "all 100ms"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94A3B8"; e.currentTarget.style.color = "#64748B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#C7C7CC"; e.currentTarget.style.color = "#94A3B8"; }}
                  >
                    <Plus style={{ width: 13, height: 13 }} />
                    Add Task
                  </button>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}