import React from "react";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Hash, Filter } from "lucide-react";

const CHANNELS = [
  { key: "all", label: "All Channels", icon: Filter },
  { key: "email_inbound", label: "Email", icon: Mail },
  { key: "telegram", label: "Telegram", icon: MessageSquare },
  { key: "slack", label: "Slack", icon: Hash },
];

const STATUSES = [
  { key: "all", label: "All" },
  { key: "processed", label: "Processed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "ignored", label: "Ignored" },
];

export default function ChannelFilter({ channel, status, counts, onChannelChange, onStatusChange }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide px-2 mb-2">Channel</p>
        {CHANNELS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChannelChange(key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              channel === key
                ? "bg-[rgba(0,113,227,.1)] text-[#9333EA]"
                : "text-[#64748B] hover:bg-black/5 hover:text-[#0F172A]"
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {counts?.[key] !== undefined && (
              <Badge variant="outline" className="text-xs py-0 h-5">{counts[key]}</Badge>
            )}
          </button>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide px-2 mb-2">Status</p>
        {STATUSES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onStatusChange(key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === key
                ? "bg-[rgba(0,113,227,.1)] text-[#9333EA]"
                : "text-[#64748B] hover:bg-black/5 hover:text-[#0F172A]"
            }`}
          >
            <span className="flex-1 text-left">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
