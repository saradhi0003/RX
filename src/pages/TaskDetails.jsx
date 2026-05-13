
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Link as LinkIcon, User as UserIcon, Briefcase, Building2 } from "lucide-react";
import StatusPath from "@/components/common/StatusPath";
import RelatedQuickLinks from "@/components/common/RelatedQuickLinks";
import DataListModal from "@/components/common/DataListModal";
import { Task, Candidate, Job, Company, Submission, Application } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Save, Edit } from "lucide-react";
import TaskForm from "@/components/tasks/TaskForm";

export default function TaskDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const [task, setTask] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [relatedRec, setRelatedRec] = React.useState(null);
  const [modal, setModal] = React.useState({ open: false, title: "", columns: [], rows: [] });
  const [updating, setUpdating] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const t = await Task.get(id);
    setTask(t);
    let rel = null;
    if (t?.related_entity && t.related_id) {
      try {
        if (t.related_entity === "candidate") rel = await Candidate.get(t.related_id);
        else if (t.related_entity === "job") rel = await Job.get(t.related_id);
        else if (t.related_entity === "company") rel = await Company.get(t.related_id);
      } catch (_) {
        /* Related record lookup is best-effort */
      }
    }
    setRelatedRec(rel);
    setLoading(false);
  }, [id]);

  React.useEffect(() => { if (id) load(); }, [id, load]);

  const statusItems = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];
  const changeStatus = async (val) => {
    if (!task || task.status === val) return;
    setUpdating(true);
    await Task.update(task.id, { status: val });
    await load();
    setUpdating(false);
  };

  const saveRecord = async () => {
    if (!task) return;
    setSaving(true);
    await Task.update(task.id, { status: task.status, description: task.description, priority: task.priority, due_date: task.due_date });
    await load();
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-8 w-56 bg-slate-200 rounded mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded" />)}
        </div>
      </div>
    );
  }
  if (!task) return <div className="p-6">Record not found.</div>;

  const statusColor = {
    pending: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  }[task.status] || "bg-gray-100 text-gray-800";

  const related = [];
  if (task.related_entity === "candidate") related.push({ id: "candidate", key: "candidate", label: "Candidate", count: 1 });
  if (task.related_entity === "job") related.push({ id: "job", key: "job", label: "Job", count: 1 });
  if (task.related_entity === "company") related.push({ id: "company", key: "company", label: "Company", count: 1 });

  const openSummary = () => {
    if (!relatedRec) return;
    if (task.related_entity === "candidate") {
      setModal({
        open: true, title: "Candidate",
        columns: [
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "location", label: "Location" },
        ],
        rows: [{ name: `${relatedRec.first_name} ${relatedRec.last_name}`, email: relatedRec.email || "—", location: relatedRec.location || "—" }],
      });
    } else if (task.related_entity === "job") {
      setModal({
        open: true, title: "Job",
        columns: [
          { key: "title", label: "Title" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status" },
        ],
        rows: [{ title: relatedRec.title, location: relatedRec.location || "—", status: relatedRec.status }],
      });
    } else if (task.related_entity === "company") {
      setModal({
        open: true, title: "Company",
        columns: [
          { key: "name", label: "Name" },
          { key: "industry", label: "Industry" },
          { key: "location", label: "Location" },
        ],
        rows: [{ name: relatedRec.name, industry: relatedRec.industry || "—", location: relatedRec.location || "—" }],
      });
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
                <Badge className={statusColor + " capitalize"}>{task.status?.replace("_"," ")}</Badge>
              </div>
              <div className="text-sm text-slate-600 flex flex-wrap gap-4 mt-1">
                {task.due_date && <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> Due {new Date(task.due_date).toLocaleDateString()}</span>}
                {task.assigned_to && <span className="inline-flex items-center gap-1"><UserIcon className="w-4 h-4" /> {task.assigned_to}</span>}
                {task.related_entity && <span className="inline-flex items-center gap-1"><LinkIcon className="w-4 h-4" /> {task.related_entity}</span>}
              </div>
            </div>
            <div className="w-full md:w-auto">
              <StatusPath items={statusItems} value={task.status} onChange={changeStatus} loading={updating} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={saveRecord} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setShowEdit(true)}>
              <Edit className="w-4 h-4" /> Edit
            </Button>
          </div>
        </CardContent>
      </Card>

      {related.length > 0 && <RelatedQuickLinks items={related} onItemClick={openSummary} />}

      <div className="flex gap-4 overflow-x-auto md:overflow-visible md:grid md:grid-cols-3 md:gap-6">
        <Card className="min-w-[85%] md:min-w-0">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-slate-500">Priority</span><div className="font-medium capitalize">{task.priority || "—"}</div></div>
              <div><span className="text-slate-500">Related</span><div className="font-medium capitalize">{task.related_entity || "—"}</div></div>
            </div>
            <div>
              <div className="text-slate-500">Description</div>
              <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700 min-h-[100px] whitespace-pre-wrap">{task.description || "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-[85%] md:min-w-0">
          <CardHeader><CardTitle>Completion Notes</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700 min-h-[100px] whitespace-pre-wrap">{task.completion_notes || "—"}</div>
          </CardContent>
        </Card>

        <Card className="min-w-[85%] md:min-w-0">
          <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
          <CardContent className="text-sm text-slate-700">
            {Array.isArray(task.tags) && task.tags.length > 0 ? task.tags.join(", ") : "—"}
          </CardContent>
        </Card>
      </div>

      <DataListModal
        open={modal.open}
        title={modal.title}
        columns={modal.columns}
        rows={modal.rows}
        onClose={() => setModal({ open: false, title: "", columns: [], rows: [] })}
      />

      {showEdit && (
        <TaskForm
          task={task}
          onSave={async (data) => { await Task.update(task.id, data); setShowEdit(false); await load(); }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
