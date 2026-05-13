import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, Loader2 } from "lucide-react";

export default function DraftEditor({ draft, open, onClose, onSaveAndApprove, saving }) {
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");

  if (!draft) return null;

  const handleSave = () => {
    onSaveAndApprove({ ...draft, subject, body });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit & Approve Draft</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div>
            <Label className="text-xs font-semibold text-[#94A3B8] mb-1.5 block">To</Label>
            <Input value={draft.to_email || ""} disabled className="bg-[#F8FAFC] border-0" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-[#94A3B8] mb-1.5 block">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-[#94A3B8] mb-1.5 block">Body</Label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              className="font-mono text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-[#E2E8F0] pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-[#9333EA] hover:bg-[#A855F7]"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save & Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
