import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, ArrowRight, X } from "lucide-react";
import { Submission } from "@/entities/Submission";
import { Task } from "@/entities/Task";
import { Timesheet } from "@/entities/Timesheet";
import { LeaveRequest } from "@/entities/LeaveRequest";
import { Application } from "@/entities/Application";
import { Recruiter } from "@/entities/Recruiter";

export default function TransferOwnershipModal({
  open,
  onClose,
  recruiter,        // recruiter to delete
  recruiters = [],  // all recruiters
  users = [],       // all users
  onTransferred     // callback after success
}) {
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [counts, setCounts] = useState({ submissions: 0, tasks: 0, timesheets: 0, leaves: 0, applications: 0 });
  const [processing, setProcessing] = useState(false);
  const [include, setInclude] = useState({ submissions: true, tasks: true, timesheets: true, leaves: true, applications: true });

  const otherRecruiters = useMemo(() => recruiters.filter(r => r.id !== recruiter?.id), [recruiters, recruiter]);
  const defaultRec = otherRecruiters[0]?.id || null;
  const [targetRecruiterId, setTargetRecruiterId] = useState(defaultRec);
  const adminUser = users.find(u => u.role === "admin");
  const [targetUserEmail, setTargetUserEmail] = useState(adminUser?.email || otherRecruiters[0]?.email || "");

  useEffect(() => {
    if (!open || !recruiter) return;
    setTargetRecruiterId(otherRecruiters[0]?.id || null);
    setTargetUserEmail(adminUser?.email || otherRecruiters[0]?.email || "");
    const load = async () => {
      setLoadingCounts(true);
      const [subs, tasks, ts, lv, apps] = await Promise.all([
        Submission.filter({ recruiter_id: recruiter.id }),
        Task.filter({ assigned_to: recruiter.email }),
        Timesheet.filter({ user_id: recruiter.email }),
        LeaveRequest.filter({ user_id: recruiter.email }),
        Application.filter({ submitted_by: recruiter.email })
      ]);
      setCounts({
        submissions: subs.length,
        tasks: tasks.length,
        timesheets: ts.length,
        leaves: lv.length,
        applications: apps.length
      });
      setLoadingCounts(false);
    };
    load();
   
  }, [open, recruiter?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !recruiter) return null;

  const doTransferAndDelete = async () => {
    setProcessing(true);
    // Transfer each selected group
    if (include.submissions && targetRecruiterId) {
      const subs = await Submission.filter({ recruiter_id: recruiter.id });
      for (const s of subs) {
        await Submission.update(s.id, { recruiter_id: targetRecruiterId });
      }
    }
    if (include.tasks && targetUserEmail) {
      const tasks = await Task.filter({ assigned_to: recruiter.email });
      for (const t of tasks) {
        await Task.update(t.id, { assigned_to: targetUserEmail });
      }
    }
    if (include.timesheets && targetUserEmail) {
      const ts = await Timesheet.filter({ user_id: recruiter.email });
      for (const t of ts) {
        await Timesheet.update(t.id, { user_id: targetUserEmail });
      }
    }
    if (include.leaves && targetUserEmail) {
      const lv = await LeaveRequest.filter({ user_id: recruiter.email });
      for (const l of lv) {
        await LeaveRequest.update(l.id, { user_id: targetUserEmail });
      }
    }
    if (include.applications && targetUserEmail) {
      const apps = await Application.filter({ submitted_by: recruiter.email });
      for (const a of apps) {
        await Application.update(a.id, { submitted_by: targetUserEmail });
      }
    }
    // Delete the recruiter
    await Recruiter.delete(recruiter.id);
    setProcessing(false);
    onTransferred?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl" onClick={(e)=>e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg">Delete Recruiter and Transfer Records</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-slate-700">
            You are deleting <span className="font-semibold">{recruiter.first_name} {recruiter.last_name}</span>. Choose where to transfer their records.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Target Recruiter (for Submissions)</Label>
              <Select value={targetRecruiterId || ""} onValueChange={(v) => setTargetRecruiterId(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select recruiter" />
                </SelectTrigger>
                <SelectContent>
                  {otherRecruiters.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target User Email (Tasks, Timesheets, Leave, Applications)</Label>
              <Select value={targetUserEmail} onValueChange={(v)=>setTargetUserEmail(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.email}>{u.full_name || u.email} • {u.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Tables to transfer</Label>
            {loadingCounts ? (
              <div className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Counting…</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={include.submissions} onCheckedChange={(v)=>setInclude({...include, submissions: !!v})} />
                  Submissions <span className="ml-2 text-slate-500">({counts.submissions})</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={include.tasks} onCheckedChange={(v)=>setInclude({...include, tasks: !!v})} />
                  Tasks <span className="ml-2 text-slate-500">({counts.tasks})</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={include.timesheets} onCheckedChange={(v)=>setInclude({...include, timesheets: !!v})} />
                  Timesheets <span className="ml-2 text-slate-500">({counts.timesheets})</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={include.leaves} onCheckedChange={(v)=>setInclude({...include, leaves: !!v})} />
                  Leave Requests <span className="ml-2 text-slate-500">({counts.leaves})</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={include.applications} onCheckedChange={(v)=>setInclude({...include, applications: !!v})} />
                  Applications <span className="ml-2 text-slate-500">({counts.applications})</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={doTransferAndDelete} disabled={processing || (!targetRecruiterId && include.submissions)} className="gap-2">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Transfer & Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}