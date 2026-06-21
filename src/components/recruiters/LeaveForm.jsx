
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, Calendar } from "lucide-react";

export default function LeaveForm({ onSave, onCancel, defaultValues }) {
  const [data, setData] = useState(defaultValues || {
    type: "vacation",
    start_date: "",
    end_date: "",
    reason: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle>Apply for Leave</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={data.type} onValueChange={(v)=>setData({...data, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="sick">Sick</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Start date</Label>
                <Input type="date" value={data.start_date} onChange={(e)=>setData({...data, start_date: e.target.value})} required />
              </div>
              <div>
                <Label>End date</Label>
                <Input type="date" value={data.end_date} onChange={(e)=>setData({...data, end_date: e.target.value})} required />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea rows={3} value={data.reason} onChange={(e)=>setData({...data, reason: e.target.value})} placeholder="Optional" />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
