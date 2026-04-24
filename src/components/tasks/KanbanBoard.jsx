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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {columns.map((colId) => {
          const col = COL_COLORS[colId] || COL_COLORS.pending;
          return (
            <Droppable droppableId={colId} key={colId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    minHeight: "500px",
                    background: col.bg,
                    borderRadius: 16,
                    padding: 0,
                    border: `1px solid ${col.border}`,
                    transition: "background 100ms",
                    background: snapshot.isDraggingOver ? col.pill : col.bg,
                  }}
                >
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${col.border}`, background: "#fff", borderRadius: "16px 16px 0 0" }}>
                    <div style={{ width: 4, height: 20, background: col.accent, borderRadius: 2 }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", margin: 0 }}>{statusLabels[colId] || colId}</h3>
                    <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, background: col.pill, padding: "3px 10px", borderRadius: 20, color: col.accent }}>
                      {grouped[colId]?.length || 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
                    {(grouped[colId] || []).map((t, i) => (
                      <Draggable draggableId={t.id} index={i} key={t.id}>
                        {(drag, dragSnapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            style={{
                              ...drag.draggableProps.style,
                              opacity: dragSnapshot.isDragging ? 0.5 : 1,
                            }}
                          >
                            <TaskKanbanCard task={t} onClick={() => onCardClick?.(t)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>

                  {/* Add card button */}
                  <div style={{ padding: 14 }}>
                    <button
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 12,
                        border: `2px dashed ${col.border}`,
                        background: "transparent",
                        color: col.accent,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 100ms",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = col.pill; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                      Add Task
                    </button>
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}