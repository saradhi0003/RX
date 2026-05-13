import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Settings2, Inbox } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { InboundChannelMessage } from "@/entities/InboundChannelMessage";
import { addNotification } from "@/components/notifications/NotificationToast";
import ChannelFilter from "@/components/channel-inbox/ChannelFilter";
import MessageList from "@/components/channel-inbox/MessageList";
import MessageDetail from "@/components/channel-inbox/MessageDetail";
import ChannelConnectionsModal from "@/components/channel-inbox/ChannelConnectionsModal";
import { InvokeFunction } from "@/integrations/Core";

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30000;

export default function ChannelInbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showConnections, setShowConnections] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const pollRef = useRef(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await InboundChannelMessage.list("-received_at", PAGE_SIZE);
      setMessages(data || []);
    } catch {
      if (!silent) addNotification({ type: "error", title: "Error", message: "Could not load messages" });
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(() => loadMessages(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadMessages]);

  const filtered = messages.filter(msg => {
    if (channelFilter !== "all" && msg.channel_type !== channelFilter) return false;
    if (statusFilter !== "all" && msg.processing_status !== statusFilter) return false;
    return true;
  });

  // Count by channel for filter badges
  const counts = {
    all: messages.length,
    email_inbound: messages.filter(m => m.channel_type === "email_inbound").length,
    telegram: messages.filter(m => m.channel_type === "telegram").length,
    slack: messages.filter(m => m.channel_type === "slack").length,
  };

  const handleRetry = async () => {
    if (!selected) return;
    setRetrying(true);
    try {
      await InvokeFunction({ function_name: "reprocessChannelMessage", payload: { message_id: selected.id } });
      addNotification({ type: "success", title: "Reprocessing", message: "Message queued for reprocessing" });
      await loadMessages();
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not reprocess message" });
    }
    setRetrying(false);
  };

  const handleSelect = (msg) => {
    setSelected(msg);
  };

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#F8FAFC" }}>
      {/* Left: Filters */}
      <div className="w-52 flex-shrink-0 border-r border-[#E2E8F0] bg-white p-4 overflow-y-auto">
        <ChannelFilter
          channel={channelFilter}
          status={statusFilter}
          counts={counts}
          onChannelChange={setChannelFilter}
          onStatusChange={setStatusFilter}
        />
      </div>

      {/* Middle: Message list */}
      <div className="w-80 flex-shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-semibold text-[#0F172A]">
              {filtered.length} message{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => loadMessages()}>
              <RefreshCcw className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => setShowConnections(true)}>
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MessageList
            messages={filtered}
            selectedId={selected?.id}
            onSelect={handleSelect}
            loading={loading}
          />
        </div>
      </div>

      {/* Right: Detail pane */}
      <div className="flex-1 min-w-0 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2E8F0]">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            {selected ? "Message Details" : "Select a message"}
          </h2>
        </div>
        <MessageDetail
          message={selected}
          onRetry={handleRetry}
          retrying={retrying}
        />
      </div>

      <ChannelConnectionsModal
        open={showConnections}
        onClose={() => setShowConnections(false)}
      />
    </div>
  );
}
