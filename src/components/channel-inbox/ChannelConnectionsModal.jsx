import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Mail, MessageSquare, Hash, Plus, Trash2, Loader2 } from "lucide-react";
import { ChannelConnection } from "@/entities/ChannelConnection";
import { addNotification } from "@/components/notifications/NotificationToast";

const CHANNEL_ICONS = { email_inbound: Mail, telegram: MessageSquare, slack: Hash };
const CHANNEL_LABELS = { email_inbound: "Email (Postmark)", telegram: "Telegram", slack: "Slack" };

export default function ChannelConnectionsModal({ open, onClose }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ChannelConnection.list("-created_date", 100);
      setConnections(data || []);
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not load channel connections" });
    }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const toggleActive = async (conn) => {
    setToggling(conn.id);
    try {
      await ChannelConnection.update(conn.id, { is_active: !conn.is_active });
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, is_active: !c.is_active } : c));
      addNotification({ type: "success", title: "Updated", message: `Connection ${conn.is_active ? "paused" : "activated"}` });
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not update connection" });
    }
    setToggling(null);
  };

  const disconnect = async (conn) => {
    if (!confirm(`Disconnect "${conn.channel_name}"? This cannot be undone.`)) return;
    try {
      await ChannelConnection.delete(conn.id);
      setConnections(prev => prev.filter(c => c.id !== conn.id));
      addNotification({ type: "success", title: "Disconnected", message: conn.channel_name });
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not disconnect channel" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Channel Connections</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8 text-[#94A3B8] text-sm">
              <p>No channels connected yet.</p>
              <p className="mt-1 text-xs">Add the Telegram or Slack bot to a group and use /register to connect.</p>
            </div>
          ) : (
            connections.map(conn => {
              const Icon = CHANNEL_ICONS[conn.channel_type] || Mail;
              return (
                <div key={conn.id} className="flex items-center gap-3 p-3 border border-[#E2E8F0] rounded-xl">
                  <Icon className="w-5 h-5 text-[#64748B] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{conn.channel_name}</p>
                    <p className="text-xs text-[#94A3B8]">{CHANNEL_LABELS[conn.channel_type] || conn.channel_type}</p>
                  </div>
                  <Switch
                    checked={conn.is_active}
                    disabled={toggling === conn.id}
                    onCheckedChange={() => toggleActive(conn)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => disconnect(conn)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}

          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="text-xs font-semibold text-[#94A3B8] mb-2">Setup Instructions</p>
            <div className="space-y-2 text-xs text-[#64748B]">
              <p><strong>Telegram:</strong> Add @RecruiterXBot to a group, then type /register in that group.</p>
              <p><strong>Slack:</strong> Install the app to your workspace, then run /recruiterx-register in a channel.</p>
              <p><strong>Email:</strong> Forward emails to your Postmark inbound address to auto-process them.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
