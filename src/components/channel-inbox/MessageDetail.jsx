import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Briefcase, Users, RefreshCcw, ExternalLink, Mail, MessageSquare, Hash, Clock, CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDistanceToNow, format } from "date-fns";

const CHANNEL_ICONS = { email_inbound: Mail, telegram: MessageSquare, slack: Hash };
const CHANNEL_LABELS = { email_inbound: "Email", telegram: "Telegram", slack: "Slack" };

const STATUS_BADGES = {
  processed: <Badge className="bg-green-100 text-green-700 border-0">Processed</Badge>,
  pending: <Badge className="bg-yellow-100 text-yellow-700 border-0">Pending</Badge>,
  failed: <Badge className="bg-red-100 text-red-700 border-0">Failed</Badge>,
  ignored: <Badge className="bg-slate-100 text-slate-600 border-0">Ignored</Badge>,
};

const CLASS_BADGES = {
  job: <Badge className="bg-blue-100 text-blue-700 border-0">Job</Badge>,
  resume: <Badge className="bg-green-100 text-green-700 border-0">Resume</Badge>,
  reply: <Badge className="bg-purple-100 text-purple-700 border-0">Reply</Badge>,
  spam: <Badge className="bg-red-100 text-red-700 border-0">Spam</Badge>,
  unknown: <Badge className="bg-slate-100 text-slate-600 border-0">Unknown</Badge>,
};

export default function MessageDetail({ message, onRetry, retrying }) {
  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#94A3B8] gap-2 p-8">
        <Mail className="w-12 h-12 opacity-20" />
        <p className="text-sm">Select a message to view details</p>
      </div>
    );
  }

  const ChannelIcon = CHANNEL_ICONS[message.channel_type] || Mail;
  const channelLabel = CHANNEL_LABELS[message.channel_type] || message.channel_type;

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ChannelIcon className="w-4 h-4 text-[#64748B]" />
            <span className="text-xs text-[#64748B] font-medium">{channelLabel}</span>
            {STATUS_BADGES[message.processing_status]}
            {message.classification && CLASS_BADGES[message.classification]}
          </div>
          <h2 className="text-[15px] font-semibold text-[#0F172A]">
            {message.subject || `Message from ${message.sender_name || message.sender}`}
          </h2>
          <p className="text-xs text-[#94A3B8]">
            From: <span className="font-medium">{message.sender_name || message.sender}</span>
            {message.received_at && (
              <> · {format(new Date(message.received_at), "MMM d, yyyy 'at' h:mm a")}</>
            )}
          </p>
        </div>

        {message.processing_status === "failed" && (
          <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} className="gap-2 flex-shrink-0">
            <RefreshCcw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
            Retry
          </Button>
        )}
      </div>

      {/* Classification confidence */}
      {message.classification_confidence !== null && message.classification_confidence !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">Confidence:</span>
          <div className="flex-1 max-w-32 h-1.5 bg-[#E2E8F0] rounded-full">
            <div
              className="h-full rounded-full bg-[#9333EA]"
              style={{ width: `${Math.round(message.classification_confidence * 100)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-[#0F172A]">
            {Math.round((message.classification_confidence || 0) * 100)}%
          </span>
        </div>
      )}

      {/* Resulting entity */}
      {message.resulting_entity_id && (
        <Card className="p-4 bg-[#F8FAFC] border-0">
          <p className="text-xs font-semibold text-[#94A3B8] mb-2">Created Entity</p>
          <div className="flex items-center gap-3">
            {message.resulting_entity_type === "Job" ? (
              <Briefcase className="w-5 h-5 text-[#9333EA]" />
            ) : (
              <Users className="w-5 h-5 text-green-600" />
            )}
            <span className="text-sm font-medium text-[#0F172A]">{message.resulting_entity_type}</span>
            <Link
              to={createPageUrl(`${message.resulting_entity_type === "Job" ? "JobDetails" : "CandidateDetails"}?id=${message.resulting_entity_id}`)}
              className="ml-auto flex items-center gap-1 text-xs text-[#9333EA] font-medium hover:underline"
            >
              View record <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      )}

      {/* Error message */}
      {message.error_message && (
        <Card className="p-4 bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-700 mb-1">Processing Error</p>
          <p className="text-sm text-red-600">{message.error_message}</p>
        </Card>
      )}

      {/* Message body */}
      <div>
        <p className="text-xs font-semibold text-[#94A3B8] mb-2">Message Content</p>
        <div className="bg-[#F8FAFC] rounded-xl p-4 text-sm text-[#0F172A] whitespace-pre-wrap leading-relaxed font-mono text-xs max-h-64 overflow-y-auto">
          {message.body || "(empty)"}
        </div>
      </div>

      {/* Attachments */}
      {message.attachments?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#94A3B8] mb-2">Attachments</p>
          <div className="space-y-1">
            {message.attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-[#0F172A]">
                <span className="text-[#94A3B8]">📎</span>
                <span>{att.filename}</span>
                <span className="text-xs text-[#94A3B8]">({att.mime_type})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing timeline */}
      <div>
        <p className="text-xs font-semibold text-[#94A3B8] mb-2">Processing Timeline</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#64748B]">
            <div className="w-2 h-2 rounded-full bg-[#9333EA]" />
            <span>Received {message.received_at ? formatDistanceToNow(new Date(message.received_at), { addSuffix: true }) : "—"}</span>
          </div>
          {message.processed_at && (
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Processed {formatDistanceToNow(new Date(message.processed_at), { addSuffix: true })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
