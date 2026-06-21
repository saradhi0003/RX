import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Save, Loader2 } from "lucide-react";
import { Job } from "@/entities/Job";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function JobsBulkUpdateModal({ open, onClose, selectedIds, onComplete }) {
  const [updating, setUpdating] = useState(false);
  const [updates, setUpdates] = useState({
    status: "",
    priority: "",
    remote_type: "",
    employment_type: "",
    due_date: ""
  });

  if (!open) return null;

  const handleUpdate = async () => {
    if (!selectedIds || selectedIds.length === 0) {
      addNotification({ type: "warning", title: "No selection", message: "Please select jobs to update" });
      return;
    }

    // Filter out empty values
    const payload = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "") {
        payload[key] = value;
      }
    });

    if (Object.keys(payload).length === 0) {
      addNotification({ type: "warning", title: "No changes", message: "Please select at least one field to update" });
      return;
    }

    setUpdating(true);
    try {
      const promises = Array.from(selectedIds).map(id => Job.update(id, payload));
      await Promise.all(promises);
      
      addNotification({ 
        type: "success", 
        title: "Bulk update complete", 
        message: `Updated ${selectedIds.length} job(s)` 
      });
      
      onComplete?.();
      onClose();
    } catch (error) {
      console.error("Bulk update failed:", error);
      addNotification({ 
        type: "error", 
        title: "Update failed", 
        message: "Could not update all jobs. Please try again." 
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bulk Update {selectedIds?.size || 0} Jobs</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Leave fields empty to keep their current values. Only filled fields will be updated.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={updates.status} onValueChange={(v) => setUpdates({...updates, status: v})}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={updates.priority} onValueChange={(v) => setUpdates({...updates, priority: v})}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="remote_type">Remote Type</Label>
              <Select value={updates.remote_type} onValueChange={(v) => setUpdates({...updates, remote_type: v})}>
                <SelectTrigger id="remote_type">
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="employment_type">Employment Type</Label>
              <Select value={updates.employment_type} onValueChange={(v) => setUpdates({...updates, employment_type: v})}>
                <SelectTrigger id="employment_type">
                  <SelectValue placeholder="Keep current" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Keep current</SelectItem>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="contract_to_hire">Contract to Hire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input 
                id="due_date"
                type="date" 
                value={updates.due_date} 
                onChange={(e) => setUpdates({...updates, due_date: e.target.value})}
                placeholder="Keep current"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updating} className="gap-2">
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update {selectedIds?.size || 0} Jobs
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}