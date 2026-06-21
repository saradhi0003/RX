
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";
import { Company } from "@/entities/Company";

export default function BulkUpdateModal({ open, onClose, selectedIds = [], onDone }) {
  const [updating, setUpdating] = useState(false);

  // field toggles
  const [applyStatus, setApplyStatus] = useState(false);
  const [applyIndustry, setApplyIndustry] = useState(false);
  const [applyLocation, setApplyLocation] = useState(false);
  const [applyWebsite, setApplyWebsite] = useState(false);
  const [applyType, setApplyType] = useState(false);

  // values
  const [status, setStatus] = useState("prospect");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [type, setType] = useState("client");

  useEffect(() => {
    if (!open) {
      setApplyStatus(false);
      setApplyIndustry(false);
      setApplyLocation(false);
      setApplyWebsite(false);
      setApplyType(false);
      setStatus("prospect");
      setIndustry("");
      setLocation("");
      setWebsite("");
      setType("client");
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setUpdating(true);
    const payload = {};
    if (applyStatus) payload.status = status;
    if (applyIndustry) payload.industry = industry;
    if (applyLocation) payload.location = location;
    if (applyWebsite) payload.website = website;
    if (applyType) payload.type = type;

    // Throttle updates to avoid hitting rate limits
    const BATCH_SIZE = 8;
    for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
      const slice = selectedIds.slice(i, i + BATCH_SIZE);
      for (const id of slice) {
        // No try/catch to allow errors to surface for individual updates
        await Company.update(id, payload);
        await new Promise((r) => setTimeout(r, 20)); // Small delay between requests
      }
    }

    setUpdating(false);
    onDone?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-xl" onClick={(e)=>e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Bulk Update Connections</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-red-600 hover:text-red-700">
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="text-sm text-slate-600">Applying to {selectedIds.length} selected connection(s).</div>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={applyStatus} onChange={(e)=>setApplyStatus(e.target.checked)} />
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                <Label className="col-span-2">Status</Label>
                <div className="col-span-3">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={applyType} onChange={(e)=>setApplyType(e.target.checked)} />
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                <Label className="col-span-2">Type</Label>
                <div className="col-span-3">
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={applyIndustry} onChange={(e)=>setApplyIndustry(e.target.checked)} />
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                <Label className="col-span-2">Industry</Label>
                <Input className="col-span-3" value={industry} onChange={(e)=>setIndustry(e.target.value)} placeholder="e.g., Technology" />
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={applyLocation} onChange={(e)=>setApplyLocation(e.target.checked)} />
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                <Label className="col-span-2">Location</Label>
                <Input className="col-span-3" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="City, State" />
              </div>
            </label>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={applyWebsite} onChange={(e)=>setApplyWebsite(e.target.checked)} />
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                <Label className="col-span-2">Website</Label>
                <Input className="col-span-3" value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="https://example.com" />
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="gap-2" onClick={submit} disabled={updating}>
              <Save className="w-4 h-4" />
              Apply Updates
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
