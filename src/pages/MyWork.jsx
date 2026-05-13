import React, { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/common/PageHeader";
import { Calendar, Clock, Plus, TrendingUp, Loader2, CheckCircle2 } from "lucide-react";
import { LeaveRequest } from "@/entities/LeaveRequest";
import { Timesheet } from "@/entities/Timesheet";
import { Job } from "@/entities/Job";
import { User } from "@/entities/User";
import LeaveForm from "@/components/recruiters/LeaveForm";
import { Badge } from "@/components/ui/badge";
import RangeTimesheet from "@/components/recruiters/RangeTimesheet";
import { Role } from "@/entities/Role";
import { sendAppEmail } from "@/components/utils/email";
import { getRolesCached } from "@/components/utils/rolesCache";
import { addNotification } from "@/components/notifications/NotificationToast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MyWork() {
  const [me, setMe] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [myTimesheets, setMyTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [adminEmails, setAdminEmails] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Quick timesheet entry state
  const [quickDate, setQuickDate] = useState("");
  const [quickHours, setQuickHours] = useState("");
  const [quickJobId, setQuickJobId] = useState("");
  const [quickNotes, setQuickNotes] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const u = await User.me().catch(() => null);
      setMe(u);
      if (!u) return;

      const [leRes, tsRes, jsRes] = await Promise.allSettled([
        LeaveRequest.filter({ user_id: u.email }, "-created_date", 50),
        Timesheet.filter({ user_id: u.email }, "-date", 100),
        Job.list()
      ]);
      if (leRes.status === "fulfilled") setMyLeaves(leRes.value); else setMyLeaves([]);
      if (tsRes.status === "fulfilled") setMyTimesheets(tsRes.value); else setMyTimesheets([]);
      if (jsRes.status === "fulfilled") setJobs(jsRes.value); else setJobs([]);

      try {
        const users = await User.list();
        let emails = users.filter(x => x.role === "admin").map(x => x.email);
        const roles = await getRolesCached();
        const adminRole = roles.find(r => (r.name || "").toLowerCase() === "admin");
        if (adminRole) {
          emails = [
            ...emails,
            ...users.filter(x => x.role_id === adminRole.id).map(x => x.email)
          ];
        }
        setAdminEmails(Array.from(new Set(emails)));
      } catch {
        setAdminEmails([]);
      }
    };
    load();
  }, []);

  const notifyAdmins = async (subject, body) => {
    if (!adminEmails.length) return;
    try {
      await sendAppEmail({ to: adminEmails[0], subject, body });
    } catch (_) {
      /* Optional recruiter data should not block the page */
    }
  };

  const submitLeave = async (payload) => {
    await LeaveRequest.create({ ...payload, user_id: me?.email || "anonymous" });
    setShowLeaveForm(false);
    const le = await LeaveRequest.filter({ user_id: me?.email }, "-created_date", 50);
    setMyLeaves(le);

    await notifyAdmins(
      "New leave request submitted",
      `${me?.full_name || me?.email} has submitted a leave request from ${payload.start_date} to ${payload.end_date} (${payload.type}).`
    );
    addNotification({ type: "success", title: "Submitted", message: "Leave request submitted for approval" });
  };

  const leaveRanges = useMemo(() => {
    return myLeaves
      .filter(l => l.status !== "declined")
      .map(l => ({ start: l.start_date, end: l.end_date }));
  }, [myLeaves]);

  const submitWeeklyTimesheet = async (entries) => {
    const filtered = entries.filter(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0);
      const onLeave = leaveRanges.some(r => {
        const s = new Date(r.start); s.setHours(0,0,0,0);
        const eD = new Date(r.end); eD.setHours(0,0,0,0);
        return d >= s && d <= eD;
      });
      return !onLeave;
    });
    
    if (filtered.length !== entries.length) {
      addNotification({
        type: "warning",
        title: "Some days removed",
        message: "Leave dates were removed from submission."
      });
    }

    if (filtered.length === 0) {
      addNotification({
        type: "error",
        title: "Nothing to submit",
        message: "No valid timesheet entries after removing leave dates."
      });
      return;
    }

    const lockedStatuses = new Set(["submitted", "approved"]);
    const isLocked = (dateStr) =>
      myTimesheets.some(t => t.date === dateStr && lockedStatuses.has(String(t.status || "").toLowerCase()));
    const duplicates = filtered.filter(e => isLocked(e.date));
    const allowed = filtered.filter(e => !isLocked(e.date));

    if (duplicates.length > 0) {
      addNotification({
        type: "warning",
        title: "Skipping already submitted days",
        message: `Skipped ${duplicates.length} day(s) that are already submitted or approved.`
      });
    }
    if (allowed.length === 0) {
      addNotification({
        type: "error",
        title: "Nothing to submit",
        message: "All selected dates were already submitted/approved."
      });
      return;
    }

    for (const e of allowed) {
      await Timesheet.create({
        user_id: me?.email || "anonymous",
        date: e.date,
        hours: e.hours,
        status: "submitted",
        notes: ""
      });
    }
    const ts = await Timesheet.filter({ user_id: me?.email }, "-date", 100);
    setMyTimesheets(ts);

    const first = allowed[0]?.date;
    const last = allowed[allowed.length - 1]?.date;
    addNotification({
      type: "success",
      title: "Timesheets submitted",
      message: `Submitted ${allowed.length} day(s) for approval.`
    });
    await notifyAdmins(
      "Timesheet submitted for approval",
      `${me?.full_name || me?.email} submitted a weekly timesheet (${first || "-"} to ${last || "-"}). Total hours: ${allowed.reduce((s, x) => s + x.hours, 0)}`
    );
  };

  const handleQuickTimesheet = async () => {
    if (!quickDate || !quickHours) {
      addNotification({ type: "error", title: "Error", message: "Date and hours are required" });
      return;
    }

    // Check if on leave
    const d = new Date(quickDate); d.setHours(0,0,0,0);
    const onLeave = leaveRanges.some(r => {
      const s = new Date(r.start); s.setHours(0,0,0,0);
      const e = new Date(r.end); e.setHours(0,0,0,0);
      return d >= s && d <= e;
    });

    if (onLeave) {
      addNotification({ type: "error", title: "Error", message: "Cannot log time on leave dates" });
      return;
    }

    setQuickLoading(true);
    try {
      await Timesheet.create({
        user_id: me?.email,
        date: quickDate,
        hours: Number(quickHours),
        job_id: quickJobId || null,
        notes: quickNotes,
        status: "draft"
      });

      const ts = await Timesheet.filter({ user_id: me?.email }, "-date", 100);
      setMyTimesheets(ts);

      // Clear form
      setQuickDate("");
      setQuickHours("");
      setQuickJobId("");
      setQuickNotes("");

      addNotification({ type: "success", title: "Saved", message: "Time entry saved as draft" });
    } catch (error) {
      console.error("Error saving timesheet:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to save time entry" });
    }
    setQuickLoading(false);
  };

  const isInLast12Months = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const lastYear = new Date(now); lastYear.setFullYear(now.getFullYear() - 1);
    return d >= lastYear && d <= now;
  };

  const yearLeaves = myLeaves.filter(l => isInLast12Months(l.start_date) || isInLast12Months(l.end_date));
  const monthTimesheets = myTimesheets.filter(t => {
    const d = new Date(t.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  })();

  const isSameWeek = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const s = new Date(weekStart);
    const e = new Date(weekStart); e.setDate(s.getDate() + 6);
    d.setHours(0,0,0,0);
    s.setHours(0,0,0,0);
    e.setHours(0,0,0,0);
    return d >= s && d <= e;
  };

  const weekHours = myTimesheets.filter(t => isSameWeek(t.date)).reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
  const monthApprovedHours = myTimesheets.filter(t => monthTimesheets.includes(t) && t.status === "approved").reduce((s,t)=>s+(Number(t.hours)||0),0);
  const monthPendingLeaves = yearLeaves.filter(l => l.status === "pending" && (new Date(l.start_date).getMonth() === new Date().getMonth() || new Date(l.end_date).getMonth() === new Date().getMonth())).length;

  const draftTimesheets = myTimesheets.filter(t => t.status === "draft");
  const submittedTimesheets = myTimesheets.filter(t => t.status === "submitted");
  // Force cache bust
  const _cacheBust = Date.now();

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif", background: "#F8FAFC", minHeight: "100vh" }}>
      <div style={{ padding: "20px 24px" }}>
      <PageHeader
        title="My Work"
        subtitle="Manage your time, leave requests, and approvals"
      />

      {!me ? (
        <Card><CardContent className="p-6 text-slate-600">Sign in to view your work.</CardContent></Card>
      ) : (
        <>
          {/* Metrics bar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", background: "#fff", borderBottom: "1px solid #E2E8F0", borderRadius: "12px", marginBottom: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
            {[
              { label: "Week Hours",      value: weekHours.toFixed(1),       sub: "logged time",        color: "#2563EB" },
              { label: "Month Approved",  value: monthApprovedHours.toFixed(1), sub: "hours approved",   color: "#16A34A" },
              { label: "Pending Leave",   value: monthPendingLeaves,         sub: "awaiting approval",  color: "#D97706" },
              { label: "Draft Entries",   value: draftTimesheets.length,     sub: "not submitted",      color: "#8B5CF6" },
            ].map((m, i) => (
              <div key={i} style={{ padding: "22px 28px", borderRight: i < 3 ? "1px solid #E2E8F0" : "none" }}>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "#94A3B8", marginBottom: 5 }}>{m.label}</div>
                <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-.04em", lineHeight: 1, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 6 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="quick-entry">Quick Entry</TabsTrigger>
              <TabsTrigger value="weekly">Weekly Submit</TabsTrigger>
              <TabsTrigger value="leave">Leave Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Timesheets */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Recent Timesheets</span>
                      <Button size="sm" onClick={() => setActiveTab("quick-entry")}>
                        <Plus className="w-4 h-4 mr-1" /> Quick Add
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {monthTimesheets.slice(0, 5).map(t => {
                        const job = jobs.find(j => j.id === t.job_id);
                        const statusColor = {
                          draft: "bg-gray-100 text-gray-800",
                          submitted: "bg-blue-100 text-blue-800",
                          approved: "bg-green-100 text-green-800",
                          rejected: "bg-red-100 text-red-800"
                        }[t.status] || "bg-gray-100 text-gray-800";

                        return (
                          <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{new Date(t.date).toLocaleDateString()}</span>
                                <Badge className={statusColor}>{t.status}</Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                {t.hours}h {job ? `- ${job.title}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {monthTimesheets.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          No timesheets this month
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Leave Requests */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>Leave Requests</span>
                      <Button size="sm" onClick={() => setActiveTab("leave")}>
                        <Plus className="w-4 h-4 mr-1" /> Apply
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {yearLeaves.slice(0, 5).map(l => {
                        const statusColor = {
                          pending: "bg-yellow-100 text-yellow-800",
                          approved: "bg-green-100 text-green-800",
                          declined: "bg-red-100 text-red-800",
                          revision_requested: "bg-orange-100 text-orange-800"
                        }[l.status] || "bg-gray-100 text-gray-800";

                        return (
                          <div key={l.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="capitalize font-medium">{l.type}</span>
                                <Badge className={statusColor}>{l.status.replace("_", " ")}</Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {yearLeaves.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          No leave requests
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="quick-entry" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Time Entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Date</label>
                        <Input 
                          type="date" 
                          value={quickDate}
                          onChange={(e) => setQuickDate(e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Hours</label>
                        <Input 
                          type="number" 
                          step="0.25"
                          min="0"
                          max="24"
                          value={quickHours}
                          onChange={(e) => setQuickHours(e.target.value)}
                          placeholder="8"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Job (Optional)</label>
                      <Select value={quickJobId} onValueChange={setQuickJobId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select job" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>None</SelectItem>
                          {jobs.map(j => (
                            <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Notes (Optional)</label>
                      <Input 
                        value={quickNotes}
                        onChange={(e) => setQuickNotes(e.target.value)}
                        placeholder="What did you work on?"
                      />
                    </div>

                    <Button 
                      onClick={handleQuickTimesheet}
                      disabled={quickLoading || !quickDate || !quickHours}
                      className="w-full"
                    >
                      {quickLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Save as Draft
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-slate-500 text-center">
                      Entry will be saved as draft. Submit from the Weekly Submit tab.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Draft Entries Preview */}
              {draftTimesheets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Draft Entries ({draftTimesheets.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {draftTimesheets.slice(0, 10).map(t => {
                        const job = jobs.find(j => j.id === t.job_id);
                        return (
                          <div key={t.id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <span className="font-medium">{new Date(t.date).toLocaleDateString()}</span>
                              <span className="text-slate-600 ml-2">{t.hours}h</span>
                              {job && <span className="text-slate-500 text-sm ml-2">- {job.title}</span>}
                            </div>
                            <Badge variant="outline">Draft</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="weekly" className="space-y-4">
              <RangeTimesheet 
                onSubmit={submitWeeklyTimesheet} 
                leaveRanges={leaveRanges} 
                existingTimesheets={myTimesheets} 
              />
            </TabsContent>

            <TabsContent value="leave" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Apply for Leave</span>
                    <Button onClick={() => setShowLeaveForm(true)}>
                      <Plus className="w-4 h-4 mr-1" /> New Request
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {yearLeaves.map(l => {
                      const statusColor = {
                        pending: "bg-yellow-100 text-yellow-800",
                        approved: "bg-green-100 text-green-800",
                        declined: "bg-red-100 text-red-800",
                        revision_requested: "bg-orange-100 text-orange-800"
                      }[l.status] || "bg-gray-100 text-gray-800";

                      return (
                        <div key={l.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="capitalize font-medium text-lg">{l.type}</span>
                                <Badge className={statusColor}>{l.status.replace("_", " ")}</Badge>
                              </div>
                              <p className="text-sm text-slate-600">
                                {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {l.reason && (
                            <p className="text-sm text-slate-700 mt-2">
                              <strong>Reason:</strong> {l.reason}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {yearLeaves.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        No leave requests in the last 12 months
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {showLeaveForm && (
        <LeaveForm onSave={submitLeave} onCancel={()=>setShowLeaveForm(false)} />
      )}
      </div>
    </div>
  );
}
