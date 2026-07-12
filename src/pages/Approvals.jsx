import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCcw, Check, X, Calendar, Clock, RotateCcw, Sparkles, Loader2, AlertTriangle, TrendingUp, Users } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { LeaveRequest } from "@/entities/LeaveRequest";
import { Timesheet } from "@/entities/Timesheet";
import { User } from "@/entities/User";
import { sendAppEmail } from "@/components/utils/email";
import { usePermissions } from "@/components/common/PermissionsContext";
import { InvokeLLM } from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";
import { useTableSort } from "@/hooks/useTableSort";

function weekKey(isoDate) {
  const d = new Date(isoDate);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  const end = new Date(d); end.setDate(d.getDate() + 6);
  return { key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, start: d, end };
}

export default function Approvals() {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [leavesPending, setLeavesPending] = useState([]);
  const [leavesApproved, setLeavesApproved] = useState([]);
  const [timesheetsPending, setTimesheetsPending] = useState([]);
  const [timesheetsApproved, setTimesheetsApproved] = useState([]);
  
  // AI Insights state
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsights, setAIInsights] = useState(null);
  const [analyzingAI, setAnalyzingAI] = useState(false);

  // Timesheet rows carry Date objects under `start`; sort the Week column by it.
  const weekAccessors = useMemo(() => ({ week: (g) => g.start, hours: (g) => g.hours }), []);
  const leavesPendingSort = useTableSort(leavesPending, { defaultKey: "created_date", defaultOrder: "desc" });
  const leavesApprovedSort = useTableSort(leavesApproved, { defaultKey: "created_date", defaultOrder: "desc" });
  const timesheetsPendingSort = useTableSort(timesheetsPending, { defaultKey: "week", defaultOrder: "desc", accessors: weekAccessors });
  const timesheetsApprovedSort = useTableSort(timesheetsApproved, { defaultKey: "week", defaultOrder: "desc", accessors: weekAccessors });

  const load = async () => {
    setLoading(true);
    const u = await User.me().catch(() => null);
    setMe(u);
    const [le, leAll, ts, tsAll] = await Promise.allSettled([
      LeaveRequest.filter({ status: "pending" }, "-created_date", 200),
      LeaveRequest.filter({ status: "approved" }, "-approved_date", 300),
      Timesheet.filter({ status: "submitted" }, "-date", 800),
      Timesheet.filter({ status: "approved" }, "-date", 800),
    ]);
    const leavesP = le.status === "fulfilled" ? le.value : [];
    const leavesA = leAll.status === "fulfilled" ? leAll.value : [];
    const tsP = ts.status === "fulfilled" ? ts.value : [];
    const tsA = tsAll.status === "fulfilled" ? tsAll.value : [];

    // Group pending timesheets by user + week
    const groupsMap = {};
    tsP.forEach(t => {
      const { key, start, end } = weekKey(t.date);
      const gk = `${t.user_id}__${key}`;
      if (!groupsMap[gk]) groupsMap[gk] = { user_id: t.user_id, week: key, start, end, entries: [], hours: 0 };
      groupsMap[gk].entries.push(t);
      groupsMap[gk].hours += Number(t.hours || 0);
    });
    setTimesheetsPending(Object.values(groupsMap).sort((a,b) => b.start - a.start));

    // Group approved timesheets by user + week
    const apprMap = {};
    tsA.forEach(t => {
      const { key, start, end } = weekKey(t.date);
      const gk = `${t.user_id}__${key}`;
      if (!apprMap[gk]) apprMap[gk] = { user_id: t.user_id, week: key, start, end, entries: [], hours: 0 };
      apprMap[gk].entries.push(t);
      apprMap[gk].hours += Number(t.hours || 0);
    });
    setTimesheetsApproved(Object.values(apprMap).sort((a,b) => b.start - a.start));

    setLeavesPending(leavesP);
    setLeavesApproved(leavesA);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decideLeave = async (lr, status) => {
    const payload = {
      status,
      approver_id: me?.email || "",
      approved_date: new Date().toISOString()
    };
    await LeaveRequest.update(lr.id, payload);
    try {
      await sendAppEmail({
        to: lr.user_id,
        subject: `Your leave request was ${status.replace("_"," ")}`,
        body: `Hello,\n\nYour leave request (${lr.type}) from ${lr.start_date} to ${lr.end_date} was ${status.replace("_"," ")}.\n\nRegards,\nAdmin`
      });
    } catch (_) {
      /* email notification failures should not block approval */
    }
    addNotification({ type: "success", title: "Updated", message: `Leave request ${status.replace("_"," ")}` });
    load();
  };

  const decideTimesheetGroup = async (group, status) => {
    await Promise.all(group.entries.map(ts => Timesheet.update(ts.id, { status })));
    try {
      await sendAppEmail({
        to: group.user_id,
        subject: `Your weekly timesheet was ${status.replace("_"," ")}`,
        body: `Hello,\n\nYour timesheet for week starting ${group.week} (total ${group.hours} hours) was ${status.replace("_"," ")}.\n\nRegards,\nAdmin`
      });
    } catch (_) {
      /* email notification failures should not block approval */
    }
    addNotification({ type: "success", title: "Updated", message: `Timesheet ${status.replace("_"," ")}` });
    load();
  };

  const batchApproveLeaves = async () => {
    if (leavesPending.length === 0) return;
    for (const lr of leavesPending) {
      await decideLeave(lr, "approved");
    }
    addNotification({ type: "success", title: "Approved", message: `Approved ${leavesPending.length} leave requests` });
  };

  const batchApproveTimesheets = async () => {
    if (timesheetsPending.length === 0) return;
    for (const group of timesheetsPending) {
      await decideTimesheetGroup(group, "approved");
    }
    addNotification({ type: "success", title: "Approved", message: `Approved ${timesheetsPending.length} timesheet groups` });
  };

  const runAIAnalysis = async () => {
    setAnalyzingAI(true);
    try {
      // Prepare data summary
      const allTimesheets = [...timesheetsPending.flatMap(g => g.entries), ...timesheetsApproved.flatMap(g => g.entries)];
      const allLeaves = [...leavesPending, ...leavesApproved];

      const dataSummary = {
        timesheet_stats: {
          total_pending_groups: timesheetsPending.length,
          total_pending_hours: timesheetsPending.reduce((sum, g) => sum + g.hours, 0),
          total_approved_groups: timesheetsApproved.length,
          total_approved_hours: timesheetsApproved.reduce((sum, g) => sum + g.hours, 0),
          users_with_pending: Array.from(new Set(timesheetsPending.map(g => g.user_id))).length,
          average_hours_per_week: timesheetsPending.length > 0 
            ? (timesheetsPending.reduce((sum, g) => sum + g.hours, 0) / timesheetsPending.length).toFixed(1)
            : 0
        },
        leave_stats: {
          total_pending: leavesPending.length,
          total_approved: leavesApproved.length,
          by_type: leavesPending.reduce((acc, l) => {
            acc[l.type] = (acc[l.type] || 0) + 1;
            return acc;
          }, {}),
          users_on_leave: Array.from(new Set(leavesPending.map(l => l.user_id))).length
        },
        patterns: {
          most_common_hours: allTimesheets.reduce((acc, t) => {
            const h = Number(t.hours || 0);
            acc[h] = (acc[h] || 0) + 1;
            return acc;
          }, {}),
          busiest_days: allTimesheets.reduce((acc, t) => {
            const day = new Date(t.date).toLocaleDateString('en-US', { weekday: 'long' });
            acc[day] = (acc[day] || 0) + 1;
            return acc;
          }, {})
        }
      };

      const response = await InvokeLLM({
        prompt: `You are an expert HR analyst. Analyze the following approval data and provide strategic insights:

**Data Summary:**
${JSON.stringify(dataSummary, null, 2)}

Provide a comprehensive analysis including:

1. **Workload Analysis:**
   - Are employees overworked or underutilized?
   - Any concerning patterns in hours logged?
   - Recommendations for workload balance

2. **Leave Patterns:**
   - Any unusual leave trends?
   - Potential staffing concerns?
   - Recommendations for leave policy

3. **Approval Insights:**
   - Any red flags in pending approvals?
   - Recommendations for faster approval process
   - Risk assessment

4. **Productivity Insights:**
   - Team productivity indicators
   - Suggestions for improvement

5. **Action Items:**
   - Prioritized recommendations for HR/management

Be specific, data-driven, and actionable.`,
        response_json_schema: {
          type: "object",
          properties: {
            workload_analysis: {
              type: "object",
              properties: {
                overall_assessment: { type: "string", enum: ["healthy", "overworked", "underutilized", "concerning"] },
                concerns: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            leave_patterns: {
              type: "object",
              properties: {
                trends: { type: "array", items: { type: "string" } },
                concerns: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            approval_insights: {
              type: "object",
              properties: {
                red_flags: { type: "array", items: { type: "string" } },
                efficiency_score: { type: "number", minimum: 0, maximum: 100 },
                recommendations: { type: "string" }
              }
            },
            productivity_insights: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 100 },
                strengths: { type: "array", items: { type: "string" } },
                areas_for_improvement: { type: "array", items: { type: "string" } }
              }
            },
            action_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  action: { type: "string" },
                  expected_impact: { type: "string" }
                }
              }
            },
            executive_summary: { type: "string" }
          },
          required: ["workload_analysis", "leave_patterns", "approval_insights", "action_items", "executive_summary"]
        }
      });

      setAIInsights(response);
      setShowAIInsights(true);
      addNotification({ type: "success", title: "Analysis Complete", message: "AI insights generated" });
    } catch (error) {
      console.error("Error running AI analysis:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to generate insights" });
    }
    setAnalyzingAI(false);
  };

  const getAssessmentBadge = (assessment) => {
    const colors = {
      healthy: "bg-green-100 text-green-800",
      overworked: "bg-red-100 text-red-800",
      underutilized: "bg-yellow-100 text-yellow-800",
      concerning: "bg-orange-100 text-orange-800"
    };
    return colors[assessment] || colors.concerning;
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-blue-100 text-blue-800"
    };
    return colors[priority] || colors.medium;
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-slate-700">You don't have permission to view this page.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Review and manage leave requests and weekly timesheets"
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={load}>
              <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={runAIAnalysis}
              disabled={analyzingAI}
            >
              {analyzingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI Insights
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{leavesPending.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Timesheets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{timesheetsPending.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {timesheetsPending.reduce((sum, g) => sum + g.hours, 0).toFixed(1)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Users Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-600">
              {Array.from(new Set([...leavesPending.map(l => l.user_id), ...timesheetsPending.map(t => t.user_id)])).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {showAIInsights && aiInsights && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                AI Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{aiInsights.executive_summary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Workload Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Workload Analysis</span>
                  <Badge className={getAssessmentBadge(aiInsights.workload_analysis.overall_assessment)}>
                    {aiInsights.workload_analysis.overall_assessment.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiInsights.workload_analysis.concerns && aiInsights.workload_analysis.concerns.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-orange-700 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Concerns
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                      {aiInsights.workload_analysis.concerns.map((concern, idx) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">{aiInsights.workload_analysis.recommendations}</p>
                </div>
              </CardContent>
            </Card>

            {/* Productivity Insights */}
            {aiInsights.productivity_insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Productivity Score</span>
                    <div className="text-2xl font-bold text-blue-600">
                      {aiInsights.productivity_insights.score}/100
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {aiInsights.productivity_insights.strengths && aiInsights.productivity_insights.strengths.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-green-700">Strengths</h4>
                      <ul className="space-y-1 text-sm">
                        {aiInsights.productivity_insights.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsights.productivity_insights.areas_for_improvement && aiInsights.productivity_insights.areas_for_improvement.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-orange-700">Areas for Improvement</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                        {aiInsights.productivity_insights.areas_for_improvement.map((area, idx) => (
                          <li key={idx}>{area}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Leave Patterns & Approval Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave Patterns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiInsights.leave_patterns.trends && aiInsights.leave_patterns.trends.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm">Trends</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                      {aiInsights.leave_patterns.trends.map((trend, idx) => (
                        <li key={idx}>{trend}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiInsights.leave_patterns.concerns && aiInsights.leave_patterns.concerns.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm text-orange-700">Concerns</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-orange-600">
                      {aiInsights.leave_patterns.concerns.map((concern, idx) => (
                        <li key={idx}>{concern}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">{aiInsights.leave_patterns.recommendations}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Approval Efficiency</span>
                  <div className="text-2xl font-bold text-purple-600">
                    {aiInsights.approval_insights.efficiency_score}/100
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiInsights.approval_insights.red_flags && aiInsights.approval_insights.red_flags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-red-700 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      Red Flags
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                      {aiInsights.approval_insights.red_flags.map((flag, idx) => (
                        <li key={idx}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">{aiInsights.approval_insights.recommendations}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Items */}
          {aiInsights.action_items && aiInsights.action_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiInsights.action_items.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-slate-900">{item.action}</h4>
                        <Badge className={getPriorityBadge(item.priority)}>
                          {item.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        <strong>Expected Impact:</strong> {item.expected_impact}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Leave Requests</CardTitle>
            {leavesPending.length > 0 && (
              <Button size="sm" onClick={batchApproveLeaves} className="gap-1">
                <Check className="w-4 h-4" /> Approve All
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTableProvider tableId="approvals-leaves-pending" sort={leavesPendingSort}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead columnKey="user_id">Requester</SortableHead>
                    <SortableHead columnKey="type">Type</SortableHead>
                    <SortableHead columnKey="start_date">Start</SortableHead>
                    <SortableHead columnKey="end_date">End</SortableHead>
                    <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leavesPendingSort.sorted.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="truncate">{l.user_id}</TableCell>
                      <TableCell className="capitalize">{l.type}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => decideLeave(l, "approved")}><Check className="w-3 h-3" /></Button>
                          <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => decideLeave(l, "declined")}><X className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => decideLeave(l, "revision_requested")}><RotateCcw className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!loading && leavesPending.length === 0) && (
                    <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">No pending leaves.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </DataTableProvider>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Timesheets (Weekly)</CardTitle>
            {timesheetsPending.length > 0 && (
              <Button size="sm" onClick={batchApproveTimesheets} className="gap-1">
                <Check className="w-4 h-4" /> Approve All
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <DataTableProvider tableId="approvals-timesheets-pending" sort={timesheetsPendingSort}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead columnKey="user_id">User</SortableHead>
                    <SortableHead columnKey="week">Week</SortableHead>
                    <SortableHead columnKey="hours">Hours</SortableHead>
                    <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheetsPendingSort.sorted.map(g => (
                    <TableRow key={`${g.user_id}-${g.week}`}>
                      <TableCell className="truncate">{g.user_id}</TableCell>
                      <TableCell>{g.start.toLocaleDateString()} - {g.end.toLocaleDateString()}</TableCell>
                      <TableCell>{g.hours.toFixed(1)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => decideTimesheetGroup(g, "approved")}><Check className="w-3 h-3" /></Button>
                          <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => decideTimesheetGroup(g, "rejected")}><X className="w-3 h-3" /></Button>
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => decideTimesheetGroup(g, "needs_revision")}><RotateCcw className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!loading && timesheetsPending.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">No pending timesheets.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </DataTableProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Past Approved Lists (collapsed by default) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Past Approved Leaves</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-64">
              <DataTableProvider tableId="approvals-leaves-approved" sort={leavesApprovedSort}>
              <Table>
                <TableHeader><TableRow><SortableHead columnKey="user_id">User</SortableHead><SortableHead columnKey="type">Type</SortableHead><SortableHead columnKey="start_date">Start</SortableHead><SortableHead columnKey="end_date">End</SortableHead></TableRow></TableHeader>
                <TableBody>
                  {leavesApprovedSort.sorted.slice(0, 10).map(l => (
                    <TableRow key={`a-${l.id}`}>
                      <TableCell className="truncate">{l.user_id}</TableCell>
                      <TableCell className="capitalize">{l.type}</TableCell>
                      <TableCell>{l.start_date}</TableCell>
                      <TableCell>{l.end_date}</TableCell>
                    </TableRow>
                  ))}
                  {(!loading && leavesApproved.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-6">None.</TableCell></TableRow>}
                </TableBody>
              </Table>
              </DataTableProvider>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Past Approved Timesheets</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-64">
              <DataTableProvider tableId="approvals-timesheets-approved" sort={timesheetsApprovedSort}>
              <Table>
                <TableHeader><TableRow><SortableHead columnKey="user_id">User</SortableHead><SortableHead columnKey="week">Week</SortableHead><SortableHead columnKey="hours">Hours</SortableHead></TableRow></TableHeader>
                <TableBody>
                  {timesheetsApprovedSort.sorted.slice(0, 10).map(g => (
                    <TableRow key={`appr-${g.user_id}-${g.week}`}>
                      <TableCell className="truncate">{g.user_id}</TableCell>
                      <TableCell>{g.start.toLocaleDateString()} - {g.end.toLocaleDateString()}</TableCell>
                      <TableCell>{g.hours.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                  {(!loading && timesheetsApproved.length === 0) && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-6">None.</TableCell></TableRow>}
                </TableBody>
              </Table>
              </DataTableProvider>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
