import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Plus,
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  LayoutGrid,
  List as ListIcon,
  Settings2,
  MoreHorizontal,
  Eye,
  Trash2,
  Save,
  Loader2,
  X,
  Zap,
  CheckSquare,
  Edit,
  RefreshCcw,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import TaskForm from "../components/tasks/TaskForm";
import PermissionGate from "@/components/common/PermissionGate";
import PageHeader from "@/components/common/PageHeader";
import KanbanBoard from "../components/tasks/KanbanBoard";
import ViewSettingsModal from "../components/tasks/ViewSettingsModal";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePermissions } from "@/components/common/PermissionsContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import { Checkbox } from "@/components/ui/checkbox";
import { addNotification } from "@/components/notifications/NotificationToast";

// Placeholder for SkeletonTable if not imported
const SkeletonTable = ({ rows, cols }) => (
  <Card>
    <CardContent className="p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              {[...Array(cols)].map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className="h-4 bg-slate-200 rounded w-2/3 animate-pulse"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(rows)].map((_, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                {[...Array(cols)].map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <div className="h-4 bg-slate-200 rounded w-full animate-pulse"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);

const TaskCard = ({ task, onClick }) => {
  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-gray-100 text-gray-800",
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.pending;
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 ${
      isOverdue ? 'border-l-red-500' : 'border-l-blue-500'
    }`} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-slate-900 truncate">
              {task.title}
            </h3>
            <p className="text-slate-600 text-sm truncate">{task.assigned_to}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={getStatusColor(task.status)}>
              {task.status?.replace('_', ' ')}
            </Badge>
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            {isOverdue && (
              <Badge className="bg-red-100 text-red-800 text-xs">
                Overdue
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {task.due_date && (
            <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
              <Calendar className="w-4 h-4" />
              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
            </div>
          )}
          {task.related_entity && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="w-4 h-4" />
              <span>Related to: {task.related_entity}</span>
            </div>
          )}
          {task.description && (
            <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-700">
              {task.description.substring(0, 100)}...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const debounceTimeoutRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [formTask, setFormTask] = useState(null);
  const [views, setViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState(null);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [mode, setMode] = useState("board");
  const [showDelete, setShowDelete] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [highlightedTask, setHighlightedTask] = useState(null);
  const [highlightedChanges, setHighlightedChanges] = useState({});
  const [savingHighlighted, setSavingHighlighted] = useState(false);

  const [sortBy, setSortBy] = useState("created_date");
  const [sortOrder, setSortOrder] = useState("desc");

  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const { listFilterFor, me } = usePermissions();

  const loadTasks = useCallback(async (force = false) => {
    if (!force && tasks.length > 0) return;
    setLoading(true);
    try {
      const filter = listFilterFor("Task");
      const tasksData = await (filter ? base44.entities.Task.filter(filter, "-created_date") : base44.entities.Task.list("-created_date"));
      setTasks(tasksData);
    } catch (error) {
      console.error("Error loading tasks:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to load tasks" });
    } finally {
      setLoading(false);
    }
  }, [listFilterFor, tasks.length]);

  useEffect(() => {
    const initialFullLoad = async () => {
      setLoading(true);
      try {
        const usersData = await base44.entities.User.list();
        setUsers(usersData);
        await loadTasks();
      } catch (error) {
        console.error("Error during initial full data load:", error);
        addNotification({ type: "error", title: "Error", message: "Failed initial data load" });
      } finally {
        setLoading(false);
      }
    };
    initialFullLoad();
  }, [loadTasks]);

  useEffect(() => {
    const loadViews = async () => {
      try {
        const list = await base44.entities.TaskView.list();
        const visibleViews = list.filter(v => {
          if (me?.role === "admin" || v.created_by?.endsWith("admin") || (me && v.created_by === me.email && me.role === "admin")) {
            return true;
          }
          if (v.visibility === "team") return true;
          if (me && v.created_by === me.email) return true;
          return false;
        });
        setViews(visibleViews);
        const def = visibleViews.find(v => v.is_default) || visibleViews[0] || null;
        if (def) {
          setSelectedViewId(def.id);
          setMode(def.view_type || "board");
        } else {
          setSelectedViewId(null);
          setMode("board");
        }
      } catch (e) {
        console.error("Error loading task views:", e);
        addNotification({ type: "error", title: "Error", message: "Failed to load task views" });
        setViews([]);
        setSelectedViewId(null);
      }
    };
    loadViews();
  }, [me]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const currentView = views.find(v => v.id === selectedViewId) || null;
  const viewFilters = currentView?.filters || {};
  const viewStatuses = Array.isArray(viewFilters.status) ? viewFilters.status : [];

  let filteredTasks = tasks.filter(task => {
    const matchesSearch = !debouncedSearchTerm.trim() ||
      task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (task.assigned_to || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (task.status || "").toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    const matchesViewStatus = viewStatuses.length === 0 || viewStatuses.includes(task.status);
    return matchesSearch && matchesViewStatus;
  });

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  // The filteredTasks array is sorted in place here if in list mode.
  // This modified array will then be used for pagination below.
  if (mode === "list") {
    filteredTasks.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (!aVal) return sortOrder === "asc" ? -1 : 1;
      if (!bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Use the (potentially sorted) filteredTasks as the base for pagination
  const filteredAndSorted = filteredTasks;

  // Calculate pagination for list view
  const totalPages = Math.ceil(filteredAndSorted.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedTasks = filteredAndSorted.slice(startIndex, endIndex);

  // Reset to page 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredAndSorted.length, sortBy, sortOrder, selectedViewId, mode]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [mode, selectedViewId, tasks.length]);

  const saveView = async (payload) => {
    try {
      if (selectedViewId && views.some(v => v.id === selectedViewId)) {
        const updated = await base44.entities.TaskView.update(selectedViewId, payload);
        setViews(views.map(v => (v.id === updated.id ? updated : v)));
        addNotification({ type: "success", title: "View Updated", message: `'${updated.name}' updated successfully` });
      } else {
        const created = await base44.entities.TaskView.create(payload);
        setViews([created, ...views]);
        setSelectedViewId(created.id);
        addNotification({ type: "success", title: "View Created", message: `'${created.name}' created successfully` });
      }
      setMode(payload.view_type || "board");
      setShowViewSettings(false);
    } catch (e) {
      console.error("Error saving task view:", e);
      addNotification({ type: "error", title: "Error", message: "Failed to save task view" });
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      await base44.entities.Task.create(taskData);
      setShowForm(false);
      await loadTasks(true);
      addNotification({ type: "success", title: "Task Created", message: "New task added successfully!" });
    } catch (error) {
      console.error("Error adding task:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to add task" });
    }
  };

  const handleEditTask = async (taskId, taskData) => {
    try {
      await base44.entities.Task.update(taskId, taskData);
      setShowForm(false);
      setFormTask(null);
      await loadTasks(true);
      addNotification({ type: "success", title: "Task Updated", message: "Task updated successfully!" });
    } catch (error) {
      console.error("Error updating task:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update task" });
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await base44.entities.Task.delete(taskToDelete.id);
      setShowDelete(false);
      setTaskToDelete(null);
      await loadTasks(true);
      addNotification({ type: "success", title: "Task Deleted", message: `'${taskToDelete.title}' deleted successfully!` });
    } catch (error) {
      console.error("Error deleting task:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to delete task" });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id => base44.entities.Task.delete(id)));
      setShowBulkDelete(false);
      setSelectedIds(new Set());
      await loadTasks(true);
      addNotification({ type: "success", title: "Tasks Deleted", message: `${ids.length} tasks deleted successfully!` });
    } catch (error) {
      console.error("Error deleting tasks:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to delete tasks" });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (checked) => {
    if (checked) {
      const all = new Set(paginatedTasks.map(t => t.id)); // Select all visible on current page
      setSelectedIds(all);
    } else {
      setSelectedIds(new Set());
    }
  };

  const allVisibleSelected = paginatedTasks.length > 0 && paginatedTasks.every(t => selectedIds.has(t.id));
  const someVisibleSelected = paginatedTasks.some(t => selectedIds.has(t.id)) && !allVisibleSelected;

  const openTask = (task) => {
    window.location.href = createPageUrl(`TaskDetails?id=${task.id}`);
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const validColumns = ["pending", "in_progress", "completed", "cancelled"];
    if (!validColumns.includes(destination.droppableId)) {
      console.warn("Invalid destination column for drag:", destination.droppableId);
      return;
    }

    const taskToUpdate = tasks.find(t => t.id === draggableId);
    if (!taskToUpdate) return;

    try {
      const newStatus = destination.droppableId;
      await base44.entities.Task.update(draggableId, { status: newStatus });
      await loadTasks(true);
      addNotification({ type: "success", title: "Task Status Updated", message: `Task '${taskToUpdate.title}' moved to ${newStatus.replace('_', ' ')}.` });
    } catch (error) {
      console.error("Error updating task status on drag:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update task status" });
    }
  };

  const defaultColumns = ["pending","in_progress","completed","cancelled"];
  const boardColumns = (currentView?.columns && currentView.columns.length > 0) ? currentView.columns : defaultColumns;

  const tasksByStatus = {
    pending: tasks.filter(t => t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    completed: tasks.filter(t => t.status === 'completed'),
    overdue: tasks.filter(t =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status !== 'completed'
    )
  };

  const handleHighlightTask = (task) => {
    setHighlightedTask(task);
    setHighlightedChanges({});
    setSelectedTask(null);
  };

  const updateHighlightedField = (field, value) => {
    setHighlightedChanges(prev => ({ ...prev, [field]: value }));
  };

  const saveHighlightedChanges = async () => {
    if (!highlightedTask || Object.keys(highlightedChanges).length === 0) return;

    setSavingHighlighted(true);
    try {
      await base44.entities.Task.update(highlightedTask.id, highlightedChanges);
      addNotification({
        type: "success",
        title: "Updated",
        message: `${highlightedTask.title} updated successfully`
      });
      setHighlightedTask(null);
      setHighlightedChanges({});
      await loadTasks(true);
    } catch (error) {
      console.error("Error updating task:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to update task" });
    }
    setSavingHighlighted(false);
  };

  const closeHighlightPanel = () => {
    setHighlightedTask(null);
    setHighlightedChanges({});
  };

  const statusOptions = [
    { value: "pending", label: "Pending", color: "bg-slate-100 text-slate-800 border-slate-300" },
    { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "completed", label: "Completed", color: "bg-green-100 text-green-800 border-green-300" },
    { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  const priorityOptions = [
    { value: "low", label: "Low", color: "bg-slate-100 text-slate-800 border-slate-300" },
    { value: "medium", label: "Medium", color: "bg-blue-100 text-blue-800 border-blue-300" },
    { value: "high", label: "High", color: "bg-orange-100 text-orange-800 border-orange-300" },
    { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-800 border-red-300" }
  ];

  const currentStatus = highlightedChanges.status || highlightedTask?.status || "pending";
  const currentPriority = highlightedChanges.priority || highlightedTask?.priority || "medium";

  const visibleColumns = [
    { key: "title", label: "Title" },
    { key: "assigned_to", label: "Assignee" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "due_date", label: "Due Date" },
    { key: "related_entity", label: "Related" },
  ];

  // ── Derived metrics ──
  const overdueCount = tasksByStatus.overdue.length;
  const completedThisWeek = (() => {
    const cutoff = new Date(Date.now() - 7 * 86400000);
    return tasks.filter(t => t.status === "completed" && new Date(t.updated_date || t.created_date) >= cutoff).length;
  })();

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background: "#F5F5F7", minHeight: "100vh" }}>

      {/* ── Metrics bar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#fff", borderBottom: "1px solid #E5E5EA" }}>
        {[
          { label: "Pending",          value: loading ? "—" : tasksByStatus.pending.length,    sub: "to do",            valColor: "#1D1D1F" },
          { label: "In Progress",      value: loading ? "—" : tasksByStatus.in_progress.length, sub: "active now",      valColor: "#0071E3" },
          { label: "Completed (7d)",   value: loading ? "—" : completedThisWeek,               sub: "this week",        valColor: "#30A14E", subColor: "#30A14E" },
          { label: "Overdue",          value: loading ? "—" : overdueCount,                    sub: "need attention",   valColor: overdueCount > 0 ? "#EF4444" : "#1D1D1F" },
        ].map((m, i) => (
          <div key={i} style={{ padding: "22px 28px", borderRight: i < 3 ? "1px solid #E5E5EA" : "none" }}>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "#86868B", marginBottom: 5 }}>{m.label}</div>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1, color: m.valColor || "#1D1D1F" }}>{m.value}</div>
            <div style={{ fontSize: 11.5, color: m.subColor || "#86868B", marginTop: 6 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "#fff", borderBottom: "1px solid #E5E5EA", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#86868B", marginRight: 2 }}>View</span>
        {[["board","Board"],["list","List"]].map(([v, l]) => (
          <button key={v} onClick={() => setMode(v)}
            style={{ padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: mode === v ? 600 : 500, border: "none", cursor: "pointer", background: mode === v ? "#1D1D1F" : "#fff", color: mode === v ? "#fff" : "#6E6E73", boxShadow: mode === v ? "none" : "0 1px 4px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.06)" }}>
            {l}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: "#E5E5EA", margin: "0 4px" }} />

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,.06)", borderRadius: 10, padding: "5px 10px" }}>
          <Search style={{ width: 13, height: 13, color: "#86868B" }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search tasks…"
            style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#1D1D1F", width: 180 }} />
        </div>

        {/* View selector */}
        <select value={selectedViewId || ""} onChange={e => { const nv = e.target.value || null; setSelectedViewId(nv); const v = views.find(vw => vw.id === nv); setMode(v ? (v.view_type || "board") : "board"); }}
          style={{ fontSize: 12, border: "1px solid #E5E5EA", borderRadius: 8, padding: "5px 10px", background: "#fff", color: "#1D1D1F", cursor: "pointer" }}>
          <option value="">Default View</option>
          {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => loadTasks(true)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: "1px solid #E5E5EA", background: "#fff", color: "#6E6E73", cursor: "pointer" }}>Refresh</button>
          <button onClick={() => { setSelectedViewId(null); setShowViewSettings(true); }} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: "1px solid #E5E5EA", background: "#fff", color: "#6E6E73", cursor: "pointer" }}>+ View</button>
          <PermissionGate entity="Task" action="create">
            <button onClick={() => { setShowForm(true); setFormTask(null); setSelectedTask(null); setHighlightedTask(null); }}
              style={{ padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,113,227,.3)" }}>
              + New Task
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ── Floating quick-edit bar ── */}
      {highlightedTask && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1D1D1F", borderRadius: 16, padding: "14px 20px", boxShadow: "0 8px 32px rgba(0,0,0,.28)", display: "flex", alignItems: "center", gap: 10, zIndex: 50, flexWrap: "wrap" }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{highlightedTask.title}</div>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Status</span>
          {statusOptions.map(o => (
            <button key={o.value} onClick={() => updateHighlightedField("status", o.value)}
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: currentStatus === o.value ? "#0071E3" : "rgba(255,255,255,.12)", color: "#fff" }}>
              {o.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Priority</span>
          {priorityOptions.map(o => (
            <button key={o.value} onClick={() => updateHighlightedField("priority", o.value)}
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: currentPriority === o.value ? "#F59E0B" : "rgba(255,255,255,.12)", color: "#fff" }}>
              {o.label}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,.15)" }} />
          <button onClick={saveHighlightedChanges} disabled={savingHighlighted || Object.keys(highlightedChanges).length === 0}
            style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: "#30A14E", color: "#fff", opacity: Object.keys(highlightedChanges).length === 0 ? .5 : 1 }}>
            {savingHighlighted ? "Saving…" : "Save"}
          </button>
          <button onClick={closeHighlightPanel} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── Content area ── */}
      <div style={{ padding: "20px 24px 60px" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#86868B" }}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#0071E3" }} />
            <div style={{ fontSize: 13 }}>Loading tasks…</div>
          </div>
        ) : mode === "board" ? (
          <KanbanBoard
            columns={boardColumns}
            tasks={filteredTasks}
            onDragEnd={onDragEnd}
            onCardClick={(task) => { window.location.href = createPageUrl(`TaskDetails?id=${task.id}`); }}
          />
        ) : paginatedTasks.length > 0 ? (
          <>
            <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)", overflow: "hidden" }}>
              {selectedIds.size > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", borderBottom: "1px solid #E5E5EA", background: "rgba(0,113,227,.04)" }}>
                  <span style={{ fontSize: 13, color: "#0071E3", fontWeight: 600 }}>{selectedIds.size} selected</span>
                  <PermissionGate entity="Task" action="delete">
                    <button onClick={() => setShowBulkDelete(true)} style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", background: "#EF4444", color: "#fff", cursor: "pointer" }}>
                      Delete Selected
                    </button>
                  </PermissionGate>
                </div>
              )}
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1.6fr 1fr 90px 90px 100px 80px 36px", padding: "9px 20px", borderBottom: "1px solid #E5E5EA", background: "#FAFAFA" }}>
                {["", "TITLE", "ASSIGNEE", "PRIORITY", "STATUS", "DUE DATE", "RELATED", ""].map((h, i) => (
                  <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".04em", color: "#86868B" }}>
                    {i === 0 ? <Checkbox checked={allVisibleSelected} onCheckedChange={c => toggleSelectAllVisible(!!c)} /> : h}
                  </div>
                ))}
              </div>

              {paginatedTasks.map((t, idx) => {
                const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed";
                const priBadge = { low:{bg:"rgba(107,114,128,.10)",c:"#6B7280"}, medium:{bg:"rgba(245,158,11,.10)",c:"#D97706"}, high:{bg:"rgba(249,115,22,.10)",c:"#EA580C"}, urgent:{bg:"rgba(239,68,68,.12)",c:"#DC2626"} }[t.priority] || {bg:"rgba(0,0,0,.06)",c:"#86868B"};
                const staBadge = { pending:{bg:"rgba(107,114,128,.10)",c:"#6B7280"}, in_progress:{bg:"rgba(59,130,246,.10)",c:"#2563EB"}, completed:{bg:"rgba(48,161,78,.10)",c:"#16A34A"}, cancelled:{bg:"rgba(239,68,68,.10)",c:"#DC2626"} }[t.status] || {bg:"rgba(0,0,0,.06)",c:"#86868B"};
                const ini = (t.assigned_to || "?").slice(0,1).toUpperCase();

                return (
                  <div key={t.id} onClick={() => setSelectedTask(t)}
                    style={{ display: "grid", gridTemplateColumns: "40px 1.6fr 1fr 90px 90px 100px 80px 36px", padding: "10px 20px", borderBottom: idx < paginatedTasks.length - 1 ? "1px solid #F2F2F7" : "none", alignItems: "center", cursor: "pointer", background: highlightedTask?.id === t.id ? "rgba(0,113,227,.04)" : "transparent", transition: "background 100ms" }}
                    onMouseEnter={e => { if (highlightedTask?.id !== t.id) e.currentTarget.style.background = "#F9F9FB"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = highlightedTask?.id === t.id ? "rgba(0,113,227,.04)" : "transparent"; }}>
                    <div onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(t.id)} onCheckedChange={() => toggleSelect(t.id)} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1D1D1F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                      {t.description && <div style={{ fontSize: 11.5, color: "#86868B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description.slice(0, 60)}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#0071E3,#6366F1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ini}</div>
                      <span style={{ fontSize: 12, color: "#1D1D1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.assigned_to?.split("@")[0] || "—"}</span>
                    </div>
                    <div><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: priBadge.bg, color: priBadge.c }}>{t.priority}</span></div>
                    <div><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: staBadge.bg, color: staBadge.c }}>{(t.status||"").replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase())}</span></div>
                    <div style={{ fontSize: 12, color: isOverdue ? "#EF4444" : "#86868B", fontWeight: isOverdue ? 600 : 400 }}>{t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}{isOverdue ? " ⚠" : ""}</div>
                    <div style={{ fontSize: 11.5, color: "#86868B" }}>{t.related_entity || "—"}</div>
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#86868B" }} className="hover:bg-black/[.07]">
                            <MoreHorizontal style={{ width: 14, height: 14 }} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link to={createPageUrl(`TaskDetails?id=${t.id}`)}><Eye className="w-4 h-4 mr-2"/>View</Link></DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleHighlightTask(t)}><Zap className="w-4 h-4 mr-2"/>Quick Edit</DropdownMenuItem>
                          <PermissionGate entity="Task" action="delete">
                            <DropdownMenuItem className="text-red-600" onClick={() => { setTaskToDelete(t); setShowDelete(true); }}><Trash2 className="w-4 h-4 mr-2"/>Delete</DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, fontSize: 13, color: "#86868B" }}>
                <span>Showing {startIndex + 1}–{Math.min(startIndex + rowsPerPage, filteredAndSorted.length)} of {filteredAndSorted.length}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #E5E5EA", background: "#fff", color: currentPage === 1 ? "#AEAEB2" : "#1D1D1F", cursor: currentPage === 1 ? "default" : "pointer", fontSize: 13 }}>← Prev</button>
                  <span style={{ fontSize: 12, alignSelf: "center" }}>Page {currentPage} of {totalPages}</span>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #E5E5EA", background: "#fff", color: currentPage >= totalPages ? "#AEAEB2" : "#1D1D1F", cursor: currentPage >= totalPages ? "default" : "pointer", fontSize: 13 }}>Next →</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 60, textAlign: "center" }}>
            <CheckSquare style={{ width: 36, height: 36, color: "#AEAEB2", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1D1D1F", marginBottom: 6 }}>{searchTerm ? "No results found" : "No tasks yet"}</div>
            <div style={{ fontSize: 13, color: "#86868B", marginBottom: 16 }}>{searchTerm ? "Try adjusting your search" : "Get started by creating your first task"}</div>
            <PermissionGate entity="Task" action="create">
              <button onClick={() => { setShowForm(true); setFormTask(null); }} style={{ padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600, border: "none", background: "#0071E3", color: "#fff", cursor: "pointer" }}>+ New Task</button>
            </PermissionGate>
          </div>
        )}
      </div>{/* end content */}

      {showForm && (
        <TaskForm
          users={users}
          task={formTask}
          onSave={formTask ? handleEditTask : handleAddTask}
          onCancel={() => { setShowForm(false); setFormTask(null); }}
        />
      )}

      <ViewSettingsModal
        open={showViewSettings}
        onClose={() => setShowViewSettings(false)}
        initial={currentView || { name: "", view_type: mode, columns: defaultColumns, filters: { status: [] }, visibility: "private", sort: "-created_date" }}
        onSave={saveView}
      />

      {showDelete && taskToDelete && (
        <DeleteConfirmModal
          open={showDelete}
          title="Delete Task"
          message={`Are you sure you want to delete "${taskToDelete.title}"? This action cannot be undone.`}
          confirmLabel="Delete Task"
          onConfirm={handleDeleteTask}
          onCancel={() => { setShowDelete(false); setTaskToDelete(null); }}
        />
      )}

      {showBulkDelete && selectedIds.size > 0 && (
        <DeleteConfirmModal
          open={showBulkDelete}
          title="Delete Selected Tasks"
          message={`Are you sure you want to delete ${selectedIds.size} selected task(s)? This action cannot be undone.`}
          confirmLabel="Delete Tasks"
          onConfirm={handleBulkDelete}
          onCancel={() => setShowBulkDelete(false)}
        />
      )}
    </div>
  );
}