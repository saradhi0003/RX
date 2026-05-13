import React from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Hash, Briefcase, Users, AlertCircle, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CHANNEL_ICONS = {
  email_inbound: Mail,
  telegram: MessageSquare,
  slack: Hash,
};

const CHANNEL_COLORS = {
  email_inbound: "text-blue-500",
  telegram: "text-sky-500",
  slack: "text-purple-500",
};

const STATUS_CONFIG = {
  processed: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Processed" },
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "Pending" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Failed" },
  ignored: { icon: MinusCircle, color: "text-slate-400", bg: "bg-slate-50", label: "Ignored" },
};

const CLASS_COLORS = {
  job: "bg-blue-100 text-blue-700",
  resume: "bg-green-100 text-green-700",
  reply: "bg-purple-100 text-purple-700",
  spam: "bg-red-100 text-red-700",
  unknown: "bg-slate-100 text-slate-600",
};

export default function MessageList({ messages, selectedId, onSelect, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[#94A3B8] text-sm">
        Loading messages…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[#94A3B8] gap-2">
        <Mail className="w-8 h-8 opacity-30" />
        <p className="text-sm">No messages yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#E2E8F0]">
      {messages.map(msg => {
        const ChannelIcon = CHANNEL_ICONS[msg.channel_type] || Mail;
        const channelColor = CHANNEL_COLORS[msg.channel_type] || "text-slate-400";
        const statusConf = STATUS_CONFIG[msg.processing_status] || STATUS_CONFIG.pending;
        const StatusIcon = statusConf.icon;
        const isSelected = msg.id === selectedId;

        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className={`w-full text-left px-4 py-3 transition-colors ${
              isSelected
                ? "bg-[rgba(0,113,227,.06)] border-l-2 border-[#9333EA]"
                : "hover:bg-black/[.03] border-l-2 border-transparent"
            }`}
          >
            <div className="flex items-start gap-2">
              <ChannelIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${channelColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                    {msg.sender_name || msg.sender || "Unknown"}
                  </span>
                  {msg.classification && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CLASS_COLORS[msg.classification] || CLASS_COLORS.unknown}`}>
                      {msg.classification}
                    </span>
                  )}
                </div>
                {msg.subject && (
                  <p className="text-[12px] font-medium text-[#0F172A] truncate">{msg.subject}</p>
                )}
                <p className="text-[12px] text-[#64748B] truncate mt-0.5">
                  {(msg.body || "").substring(0, 80)}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <StatusIcon className={`w-3 h-3 ${statusConf.color}`} />
                  <span className={`text-[11px] font-medium ${statusConf.color}`}>{statusConf.label}</span>
                  {msg.received_at && (
                    <span className="text-[11px] text-[#94A3B8] ml-auto">
                      {formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
