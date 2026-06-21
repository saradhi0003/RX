
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RecruiterForm({ recruiter, onSave, onCancel, roles = [], users = [] }) {
  const [formData, setFormData] = useState(recruiter || {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "internal", // This 'role' defines the *type* of recruiter (internal/external/freelance)
    specializations: [],
    territory: "",
    commission_rate: "",
    status: "active",
    notes: ""
  });
  // INIT: derive default access level from existing user if editing
  const existingUser = users.find(u => u.email === recruiter?.email);
  const [accessRoleId, setAccessRoleId] = useState(existingUser?.role_id || ""); // This is for system access level/permissions
  const [newSpec, setNewSpec] = useState("");
  const [saving, setSaving] = useState(false);

  const addSpec = () => {
    if (!newSpec.trim()) return;
    if (formData.specializations.includes(newSpec.trim())) return;
    setFormData(prev => ({ ...prev, specializations: [...prev.specializations, newSpec.trim()] }));
    setNewSpec("");
  };

  const removeSpec = (s) => {
    setFormData(prev => ({ ...prev, specializations: prev.specializations.filter(x => x !== s) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    // Require Access Level on create
    if (!recruiter && !accessRoleId) {
      alert("Please select an Access Level.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        commission_rate: formData.commission_rate ? Number(formData.commission_rate) : undefined
      }, accessRoleId); // pass accessRoleId as a second argument to onSave
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{recruiter ? "Edit Recruiter" : "Add Recruiter"}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>First Name</Label>
                <Input value={formData.first_name} onChange={(e)=>setFormData({...formData, first_name: e.target.value})} required />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={formData.last_name} onChange={(e)=>setFormData({...formData, last_name: e.target.value})} required />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e)=>setFormData({...formData, email: e.target.value})} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e)=>setFormData({...formData, phone: e.target.value})} />
              </div>
              {/* The original 'Role' field for recruiter type (internal/external/freelance) is removed from UI as per instructions,
                  but 'formData.role' state remains for internal data if needed. */}
              <div>
                <Label>Access Level</Label>
                <Select value={accessRoleId} onValueChange={(v)=>setAccessRoleId(v)}>
                  <SelectTrigger><SelectValue placeholder="Pick access level" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">New recruiters will be invited with this access level.</p>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v)=>setFormData({...formData, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Territory</Label>
                <Input value={formData.territory} onChange={(e)=>setFormData({...formData, territory: e.target.value})} />
              </div>
              <div>
                <Label>Commission %</Label>
                <Input type="number" step="0.1" value={formData.commission_rate} onChange={(e)=>setFormData({...formData, commission_rate: e.target.value})} />
              </div>
            </div>

            <div>
              <Label>Specializations</Label>
              <div className="flex gap-2 mt-2">
                <Input value={newSpec} onChange={(e)=>setNewSpec(e.target.value)} placeholder="Add specialization" onKeyDown={(e)=>{ if (e.key==='Enter'){ e.preventDefault(); addSpec(); }}} />
                <Button type="button" onClick={addSpec}><Plus className="w-4 h-4 mr-1" />Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.specializations.map(s => (
                  <Badge key={s} variant="secondary" className="cursor-pointer" onClick={()=>removeSpec(s)}>{s} ✕</Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={formData.notes} onChange={(e)=>setFormData({...formData, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (recruiter ? "Update" : "Create")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
