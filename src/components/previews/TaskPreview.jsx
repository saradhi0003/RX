import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Tag, User, Link as LinkIcon, ArrowUpRight } from "lucide-react";
import { Task } from "@/entities/Task";
import { createPageUrl } from "@/utils";

export default function TaskPreview({ id }) {
  const [task, setTask] = React.useState(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    setTask(null);
    setMissing(false);
    Task.get(id)
      .then((t) => { if (mounted) setTask(t); })
      .catch(() => { if (mounted) setMissing(true); });
    return () => { mounted = false; };
  }, [id]);

  if (missing) return <div className="text-sm text-slate-600 py-6 text-center">This task could not be loaded.</div>;
  if (!task) return <div className="flex items-center justify-center h-24 text-slate-600"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading task…</div>;

  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-slate-900">{task.title}</h2>
          <Link to={createPageUrl(`TaskDetails?id=${task.id}`)} data-no-preview="true" title="Open full details" className="shrink-0">
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="capitalize">{(task.status || "").replace(/_/g, " ")}</Badge>
          {task.priority && <Badge className="bg-amber-100 text-amber-800 capitalize">{task.priority}</Badge>}
        </div>
        {task.description && <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>}
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2 text-sm">
        {task.due_date && (
          <div className={`flex items-center gap-2 ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>
            <Calendar className="w-4 h-4 text-slate-400" /> Due: {new Date(task.due_date).toLocaleDateString()}{overdue ? " (overdue)" : ""}
          </div>
        )}
        {task.assigned_to && <div className="flex items-center gap-2 text-slate-700 break-all"><User className="w-4 h-4 text-slate-400 shrink-0" /> {task.assigned_to}</div>}
        {task.related_entity && <div className="flex items-center gap-2 text-slate-700"><LinkIcon className="w-4 h-4 text-slate-400" /> Related: {task.related_entity}</div>}
        {Array.isArray(task.tags) && task.tags.length > 0 && (
          <div className="flex items-center gap-2 text-slate-700">
            <Tag className="w-4 h-4 text-slate-400" />
            <div className="flex flex-wrap gap-1">{task.tags.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}
