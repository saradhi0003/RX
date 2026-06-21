
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Clock, AlertCircle } from "lucide-react";
import { User } from "@/entities/User"; // Added import for User entity

export default function TimesheetForm({ onSave, onCancel, jobs = [], defaultValues, leaveRanges = [] }) {
  const initial = defaultValues || { date: "", hours: "", job_id: "", notes: "", status: "submitted" };
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState(null); // Added state for current user

  // Load current user so we can set user_id on save (required by RLS)
  useEffect(() => {
    User.me().then(setMe).catch(() => setMe(null));
  }, []);

  // Replace isOnLeave with a memoized callback to satisfy hook deps
  const isOnLeave = useCallback((iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    d.setHours(0,0,0,0); // Normalize to start of day
    return leaveRanges.some(r => {
      const s = new Date(r.start); s.setHours(0,0,0,0);
      const e = new Date(r.end); e.setHours(0,0,0,0);
      return d >= s && d <= e;
    });
  }, [leaveRanges]);

  // Compute min/max date for current month to allow backdating within month
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const now = new Date();
  const minDate = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const maxDate = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  useEffect(() => {
    if (data.date) {
      if (isOnLeave(data.date)) {
        setError("You cannot log time on a date you have applied leave for.");
      } else {
        setError("");
      }
    } else {
      setError(""); // Clear error if date is empty
    }
  }, [data.date, isOnLeave]);

  const submit = async (e) => {
    e.preventDefault();
    if (isOnLeave(data.date)) {
      setError("You cannot log time on a date you have applied leave for.");
      return;
    }
    
    // Clear any previous error before submitting if the date is now valid
    setError("");

    setSaving(true);
    try {
      const ok = await onSave({
        ...data,
        hours: data.hours ? Number(data.hours) : 0,
        // Ensure user_id is set so non-admin recruiters can save per RLS
        // If data.user_id is already present (e.g., editing an existing entry), use it.
        // Otherwise, if `me` is loaded, use `me.email` (for new entries).
        user_id: data.user_id || me?.email
      });
      if (ok) {
        // Clear fields for next entry, keep modal open
        setData({ ...initial, date: "", hours: "", job_id: "", notes: "", status: "submitted" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle>Log Time</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={data.date}
                  min={minDate} // Added min date
                  max={maxDate} // Added max date
                  onChange={(e)=>setData({...data, date: e.target.value})}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">You can enter past dates within the current month.</p> {/* Added helper text */}
              </div>
              <div>
                <Label htmlFor="hours">Hours</Label>
                <Input id="hours" type="number" step="0.25" min="0" max="24" value={data.hours} onChange={(e)=>setData({...data, hours: e.target.value})} required />
              </div>
            </div>

            <div>
              <Label htmlFor="job">Job (optional)</Label>
              <Select value={data.job_id || ""} onValueChange={(v)=>setData({...data, job_id: v})}>
                <SelectTrigger id="job"><SelectValue placeholder="Select job" /></SelectTrigger>
                <SelectContent>
                  {/* The value for 'None' should typically be null or an empty string, depending on backend expectation for optional foreign keys. */}
                  {/* Using an empty string for the value to align with default Select behavior for no selection */}
                  <SelectItem value={null}>None</SelectItem> 
                  {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={data.notes} onChange={(e)=>setData({...data, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={saving || !!error}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
