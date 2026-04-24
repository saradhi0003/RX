import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Target, Calendar as CalendarIcon, Edit2, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import PageHeader from "@/components/common/PageHeader";
import DeleteConfirmModal from "@/components/common/DeleteConfirmModal";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, goalId: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [goalsData, recruitersData] = await Promise.all([
        base44.entities.Goal.list(),
        base44.entities.Recruiter.list()
      ]);
      setGoals(goalsData || []);
      setRecruiters(recruitersData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      addNotification({ type: "error", message: "Failed to load goals" });
    } finally {
      setLoading(false);
    }
  };

  const filteredGoals = goals.filter(goal => {
    const matchesSearch = !searchTerm || 
      goal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      goal.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || goal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    try {
      await base44.entities.Goal.delete(deleteModal.goalId);
      await loadData();
      addNotification({ type: "success", message: "Goal deleted successfully" });
      setDeleteModal({ open: false, goalId: null });
    } catch (error) {
      console.error("Error deleting goal:", error);
      addNotification({ type: "error", message: "Failed to delete goal" });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: "bg-slate-100 text-slate-700",
      active: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      on_hold: "bg-yellow-100 text-yellow-700",
      cancelled: "bg-red-100 text-red-700"
    };
    return colors[status] || colors.draft;
  };

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background: "#F5F5F7", minHeight: "100vh" }}>
      <div style={{ padding: "20px 24px", background: "#fff", borderBottom: "1px solid #E5E5EA" }}>
      <PageHeader
        title="Goals"
        subtitle="Track and manage team goals"
        right={
          <Button onClick={() => { setEditingGoal(null); setFormOpen(true); }} style={{ background: "#0071E3", color: "#fff", border: "none", borderRadius: 20, fontWeight: 600, fontSize: 13, padding: "7px 18px" }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Goal
          </Button>
        }
      />
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search goals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No goals found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Goal</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Recruiter</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Start Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">End Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Progress</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGoals.map((goal) => {
                  const recruiter = recruiters.find(r => r.id === goal.recruiter_id);
                  return (
                    <tr key={goal.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{goal.title}</div>
                        {goal.description && (
                          <div className="text-sm text-slate-500 line-clamp-1">{goal.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {recruiter ? `${recruiter.first_name} ${recruiter.last_name}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {goal.start_date ? format(new Date(goal.start_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {goal.end_date ? format(new Date(goal.end_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(goal.status)}>
                          {goal.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${goal.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 w-10 text-right">{goal.progress || 0}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(goal)}
                            className="h-8 w-8"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteModal({ open: true, goalId: goal.id })}
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GoalForm
       open={formOpen}
       onClose={() => { setFormOpen(false); setEditingGoal(null); }}
       goal={editingGoal}
       recruiters={recruiters}
       onSave={loadData}
      />

      <DeleteConfirmModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, goalId: null })}
        onConfirm={handleDelete}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? This action cannot be undone."
      />
      </div>
      );
      }

function GoalForm({ open, onClose, goal, recruiters, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    recruiter_id: "",
    start_date: "",
    end_date: "",
    status: "draft",
    progress: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setFormData({
        title: goal.title || "",
        description: goal.description || "",
        recruiter_id: goal.recruiter_id || "",
        start_date: goal.start_date || "",
        end_date: goal.end_date || "",
        status: goal.status || "draft",
        progress: goal.progress || 0
      });
    } else {
      setFormData({
        title: "",
        description: "",
        recruiter_id: "",
        start_date: "",
        end_date: "",
        status: "draft",
        progress: 0
      });
    }
  }, [goal, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.recruiter_id || !formData.start_date || !formData.end_date) {
      addNotification({ type: "error", message: "Please fill in all required fields" });
      return;
    }

    try {
      setSaving(true);
      if (goal) {
        await base44.entities.Goal.update(goal.id, formData);
        addNotification({ type: "success", message: "Goal updated successfully" });
      } else {
        await base44.entities.Goal.create(formData);
        addNotification({ type: "success", message: "Goal created successfully" });
      }
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving goal:", error);
      addNotification({ type: "error", message: "Failed to save goal" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit Goal" : "Create New Goal"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter goal title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of the goal..."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recruiter <span className="text-red-500">*</span>
            </label>
            <Select value={formData.recruiter_id} onValueChange={(value) => setFormData({ ...formData, recruiter_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select recruiter" />
              </SelectTrigger>
              <SelectContent>
                {recruiters.map((recruiter) => (
                  <SelectItem key={recruiter.id} value={recruiter.id}>
                    {recruiter.first_name} {recruiter.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Progress (%)
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {goal ? "Update Goal" : "Create Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}