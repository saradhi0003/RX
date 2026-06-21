import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const ALL_STATUSES = ["pending","in_progress","completed","cancelled"];

export default function ViewSettingsModal({
  open,
  onClose,
  initial = { name: "", view_type: "board", columns: ALL_STATUSES, filters: { status: [] }, visibility: "private" },
  onSave
}) {
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);
  if (!open) return null;

  const toggleStatus = (st) => {
    if (data.columns.includes(st)) setData({ ...data, columns: data.columns.filter(s => s !== st) });
    else setData({ ...data, columns: [...data.columns, st] });
  };

  const toggleFilterStatus = (st) => {
    const selected = data.filters?.status || [];
    const next = selected.includes(st) ? selected.filter(s => s !== st) : [...selected, st];
    setData({ ...data, filters: { ...(data.filters || {}), status: next } });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Task View Settings</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <input className="mt-1 w-full border rounded px-3 py-2 text-sm" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g., My Tasks" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={data.view_type} onValueChange={(v) => setData({ ...data, view_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="board">Board</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {data.view_type === "board" && (
            <div>
              <Label className="mb-2 block">Board Columns (statuses & order)</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_STATUSES.map(st => (
                  <label key={st} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={data.columns.includes(st)} onCheckedChange={() => toggleStatus(st)} />
                    <span className="capitalize">{st.replace("_"," ")}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Checked statuses appear as columns (left-to-right in the order above).</p>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Filters</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_STATUSES.map(st => (
                <label key={st} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(data.filters?.status || []).includes(st)} onCheckedChange={() => toggleFilterStatus(st)} />
                  <span className="capitalize">{st.replace("_"," ")}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave(data)} className="gap-2"><Save className="w-4 h-4" />Save View</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}