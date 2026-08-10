
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Save, GripVertical, Trash2 } from "lucide-react";

// "Application" is deliberately absent: migration 026 made `submissions` the
// one canonical pipeline table and `applications` is permanently empty, so a
// widget built against it would always render 0. WidgetRenderer still maps the
// name, so dashboards saved before this keep rendering instead of crashing.
const ENTITIES = ["Candidate","Job","Company","Submission","Task"];
const WIDGET_TYPES = ["kpi","bar","pie","line","stacked"];

const uid = () => Math.random().toString(36).slice(2,10);

export default function BuilderModal({ open, onClose, initial = { name: "Global Dashboard", description: "", widgets: [] }, onSave }) {
  const [dash, setDash] = React.useState(initial);

  React.useEffect(() => { setDash(initial); }, [initial, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const addWidget = () => {
    const w = { id: uid(), title: "New Widget", entity: "Submission", widget_type: "bar", group_by: "status", metric: "count", cols: 1 };
    setDash(prev => ({ ...prev, widgets: [...(prev.widgets || []), w] }));
  };

  const updateWidget = (id, patch) => {
    setDash(prev => ({ ...prev, widgets: prev.widgets.map(w => w.id === id ? { ...w, ...patch } : w) }));
  };

  const removeWidget = (id) => {
    setDash(prev => ({ ...prev, widgets: prev.widgets.filter(w => w.id !== id) }));
  };

  const move = (idx, dir) => {
    setDash(prev => {
      const arr = [...prev.widgets];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...prev, widgets: arr };
    });
  };

  const save = () => onSave?.(dash);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden relative" onClick={(e)=>e.stopPropagation()}>
        <Button aria-label="Close" variant="ghost" size="icon" onClick={onClose} className="absolute top-2 right-2 text-red-600 hover:text-red-700">
          <X className="w-5 h-5" />
        </Button>
        <CardHeader className="flex items-center justify-between pr-12">
          <CardTitle>Customize Dashboard (Global)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-auto max-h-[80vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600">Name</label>
              <Input value={dash.name || ""} onChange={e => setDash({ ...dash, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-600">Description</label>
              <Textarea rows={2} value={dash.description || ""} onChange={e => setDash({ ...dash, description: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-medium">Widgets ({dash.widgets?.length || 0})</h3>
            <Button className="gap-2" onClick={addWidget}><Plus className="w-4 h-4" /> Add Widget</Button>
          </div>

          <div className="space-y-3">
            {(dash.widgets || []).map((w, i) => (
              <div key={w.id} className="p-3 border rounded-lg bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-600">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-sm">Widget #{i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => move(i, -1)}>Up</Button>
                    <Button size="sm" variant="outline" onClick={() => move(i, 1)}>Down</Button>
                    <Button size="icon" variant="ghost" onClick={() => removeWidget(w.id)} title="Remove">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-3">
                  <div className="md:col-span-3">
                    <label className="text-xs text-slate-600">Title</label>
                    <Input value={w.title} onChange={e => updateWidget(w.id, { title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Entity</label>
                    <Select value={w.entity} onValueChange={v => updateWidget(w.id, { entity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ENTITIES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Type</label>
                    <Select value={w.widget_type} onValueChange={v => updateWidget(w.id, { widget_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WIDGET_TYPES.map(t => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Width</label>
                    <Select value={String(w.cols || 1)} onValueChange={v => updateWidget(w.id, { cols: Number(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 col</SelectItem>
                        <SelectItem value="2">2 cols</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {["bar","pie","stacked"].includes(w.widget_type) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-slate-600">Group By</label>
                      <Input placeholder="e.g. technologyText, status, priority" value={w.group_by || ""} onChange={e => updateWidget(w.id, { group_by: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Metric</label>
                      <Input value="count" disabled />
                    </div>
                  </div>
                )}

                {["line","stacked"].includes(w.widget_type) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="text-xs text-slate-600">Date Field</label>
                      <Input placeholder="e.g. submissionDate, created_date" value={w.date_field || ""} onChange={e => updateWidget(w.id, { date_field: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600">Months</label>
                      <Input type="number" min={1} max={24} value={w.months || 8} onChange={e => updateWidget(w.id, { months: Number(e.target.value || 8) })} />
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  <label className="text-xs text-slate-600">Filter JSON (optional)</label>
                  <Textarea rows={2} placeholder='e.g. {"status":"open"}' value={JSON.stringify(w.filter || {}, null, 0)} onChange={(e) => {
                    try {
                      const val = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                      updateWidget(w.id, { filter: val });
                    } catch {
                      // ignore parse errors; leave as before
                    }
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} className="gap-2"><Save className="w-4 h-4" /> Save Global Dashboard</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
