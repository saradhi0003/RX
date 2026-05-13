import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2, Clock, Mail, MessageSquare, HelpCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_CONFIG = {
  client_submission: { label: "Submission", color: "bg-blue-100 text-blue-700", icon: Mail },
  candidate_outreach: { label: "Outreach", color: "bg-purple-100 text-purple-700", icon: Mail },
  recruiter_clarification: { label: "Clarification", color: "bg-orange-100 text-orange-700", icon: HelpCircle },
  followup: { label: "Follow-up", color: "bg-green-100 text-green-700", icon: MessageSquare },
  follow_up: { label: "Follow-up", color: "bg-green-100 text-green-700", icon: MessageSquare },
};

export default function DraftListItem({ draft, onApprove, onEdit, onReject, approving }) {
  const typeConf = TYPE_CONFIG[draft.draft_type] || { label: draft.draft_type, color: "bg-slate-100 text-slate-600", icon: Mail };
  const TypeIcon = typeConf.icon;

  return (
    <div className="flex items-start gap-3 p-4 border border-[#E2E8F0] rounded-xl bg-white hover:bg-[#FAFAFA] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeConf.color}`}>
            {typeConf.label}
          </span>
          {draft.created_date && (
            <span className="text-[11px] text-[#94A3B8] flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDistanceToNow(new Date(draft.created_date), { addSuffix: true })}
            </span>
          )}
        </div>
        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{draft.subject || "(No subject)"}</p>
        <p className="text-[12px] text-[#64748B] truncate mt-0.5">To: {draft.to_email || "—"}</p>
        <p className="text-[12px] text-[#94A3B8] mt-1 line-clamp-2">{(draft.body || "").substring(0, 120)}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-[#94A3B8] hover:text-[#0F172A]"
          onClick={() => onEdit(draft)}
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-red-500 hover:bg-red-50"
          onClick={() => onReject(draft)}
          title="Reject"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          className="gap-1 bg-[#9333EA] hover:bg-[#A855F7] text-white h-8 px-3"
          onClick={() => onApprove(draft)}
          disabled={approving === draft.id}
        >
          <Check className="w-3 h-3" />
          {approving === draft.id ? "Approving…" : "Approve"}
        </Button>
      </div>
    </div>
  );
}
