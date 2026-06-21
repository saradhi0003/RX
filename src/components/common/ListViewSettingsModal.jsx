
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ListViewSettingsModal({
  open,
  onClose,
  initial = { name: "", filters: { status: [] }, visibility: "private", sort: "-created_date" },
  statusOptions = [],
  users = [],
  onSave,
  availableColumns = [] // NEW: optional columns config [{key, label, locked?: boolean}]
}) {
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);
  if (!open) return null;

  const toggleStatus = (val) => {
    const cur = data.filters?.status || [];
    const next = cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val];
    setData({ ...data, filters: { ...(data.filters || {}), status: next } });
  };

  const toggleCreatedBy = (email) => {
    const cur = data.filters?.created_by_in || [];
    const next = cur.includes(email) ? cur.filter((e) => e !== email) : [...cur, email];
    setData({ ...data, filters: { ...(data.filters || {}), created_by_in: next } });
  };

  const setFilterVal = (key, val) => {
    setData({ ...data, filters: { ...(data.filters || {}), [key]: val } });
  };

  // NEW: toggle visible columns
  const toggleColumn = (key) => {
    const current = Array.isArray(data.columns) ? data.columns : [];
    const exists = current.includes(key);
    const next = exists ? current.filter((k) => k !== key) : [...current, key];
    setData({ ...data, columns: next });
  };

  // NEW: parse/save sort field and direction
  const parseSort = (s) => {
    if (!s) return { field: "created_date", dir: "desc" };
    if (s.startsWith("-")) return { field: s.slice(1), dir: "desc" };
    return { field: s, dir: "asc" };
  };
  const sort = parseSort(data.sort || "-created_date");

  const setSortField = (f) => {
    setData({ ...data, sort: sort.dir === "desc" ? `-${f}` : f });
  };
  const setSortDir = (d) => {
    const field = sort.field || "created_date";
    setData({ ...data, sort: d === "desc" ? `-${field}` : field });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>List View Settings</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Name</Label>
            <input className="mt-1 w-full border rounded px-3 py-2 text-sm" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="e.g., Active Only" />
          </div>

          {/* NEW: Visibility */}
          <div>
            <Label className="mb-2 block">Visibility</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.visibility === "private"} onCheckedChange={() => setData({ ...data, visibility: "private" })} />
                <span>Only me</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.visibility === "team"} onCheckedChange={() => setData({ ...data, visibility: "team" })} />
                <span>My team</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={data.visibility === "public"} onCheckedChange={() => setData({ ...data, visibility: "public" })} />
                <span>Everyone</span>
              </label>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox checked={data.visibility === "role_recruiter"} onCheckedChange={() => setData({ ...data, visibility: "role_recruiter" })} />
                  <span>Recruiters only</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox checked={data.visibility === "role_admin"} onCheckedChange={() => setData({ ...data, visibility: "role_admin" })} />
                  <span>Admins only</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Choose who can see this view to avoid duplicates.</p>
          </div>

          {/* Columns (optional) */}
          {Array.isArray(availableColumns) && availableColumns.length > 0 && (
            <div>
              <Label className="mb-2 block">Columns</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableColumns.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      disabled={c.locked}
                      checked={(data.columns || []).includes(c.key) || c.locked}
                      onCheckedChange={() => toggleColumn(c.key)}
                    />
                    <span className={c.locked ? "text-slate-500" : ""}>{c.label}{c.locked ? " (fixed)" : ""}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Tip: Columns appear in the order shown; drag reordering coming soon.</p>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Default Sort</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={sort.field} onValueChange={setSortField}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_date">Created Date</SelectItem>
                  <SelectItem value="name">Connection</SelectItem>
                  <SelectItem value="industry">Industry</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort.dir} onValueChange={setSortDir}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-slate-500 self-center">Click column headers to sort inline.</div>
            </div>
          </div>

          {/* Filters */}
          <div>
            <Label className="mb-2 block">Statuses</Label>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(data.filters?.status || []).includes(s.value)} onCheckedChange={() => toggleStatus(s.value)} />
                  <span className="capitalize">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Industry contains</Label>
              <Input value={data.filters?.industry_contains || ""} onChange={(e)=>setFilterVal("industry_contains", e.target.value)} placeholder="e.g., tech" />
            </div>
            <div>
              <Label>Location contains</Label>
              <Input value={data.filters?.location_contains || ""} onChange={(e)=>setFilterVal("location_contains", e.target.value)} placeholder="e.g., Austin" />
            </div>
            <div>
              <Label>Has website</Label>
              <Select value={data.filters?.has_website ?? "any"} onValueChange={(v)=>setFilterVal("has_website", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Created By</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-auto border rounded p-2">
              {(users || []).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={(data.filters?.created_by_in || []).includes(u.email)} onCheckedChange={() => toggleCreatedBy(u.email)} />
                  <span>{u.full_name || u.email}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="gap-2" onClick={() => onSave?.(data)}><Save className="w-4 h-4" />Save View</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
