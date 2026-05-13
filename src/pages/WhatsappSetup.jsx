import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Copy, CheckCircle2, Clock, Phone, MessageSquare, ExternalLink, AlertCircle } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { InvokeFunction } from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import { ChannelConnection } from "@/entities/ChannelConnection";
import { formatDistanceToNow } from "date-fns";

export default function WhatsappSetup() {
  const [generating, setGenerating] = useState(false);
  const [currentCode, setCurrentCode] = useState(null);
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "+1 415 523 8886 (sandbox)";

  const loadConnections = async () => {
    setConnectionsLoading(true);
    try {
      const data = await ChannelConnection.filter({ channel_type: "whatsapp" }, "-created_date", 50);
      setConnections(data || []);
    } catch {
      // no connections yet
    }
    setConnectionsLoading(false);
  };

  useEffect(() => { loadConnections(); }, []);

  const generateCode = async () => {
    setGenerating(true);
    setCurrentCode(null);
    try {
      const result = await InvokeFunction({
        function_name: "createWhatsappRegistrationCode",
        payload: {},
      });
      if (result?.code) {
        setCurrentCode(result);
      } else {
        addNotification({ type: "error", title: "Error", message: result?.error || "Failed to generate code" });
      }
    } catch (err) {
      addNotification({ type: "error", title: "Error", message: "Could not generate registration code" });
    }
    setGenerating(false);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addNotification({ type: "info", title: "Copy failed", message: "Please copy manually" });
    }
  };

  const toggleConnection = async (conn) => {
    try {
      await ChannelConnection.update(conn.id, { is_active: !conn.is_active });
      setConnections(prev => prev.map(c => c.id === conn.id ? { ...c, is_active: !c.is_active } : c));
      addNotification({ type: "success", title: "Updated", message: `Connection ${conn.is_active ? "paused" : "activated"}` });
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not update connection" });
    }
  };

  const registerMessage = currentCode ? `REGISTER ${currentCode.code}` : "";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <PageHeader
        title="WhatsApp Integration"
        subtitle="Forward job posts from WhatsApp to Recruiter X automatically"
        right={
          <Button variant="outline" size="sm" onClick={loadConnections} className="gap-2">
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[#64748B]">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#9333EA] text-white text-xs flex items-center justify-center font-bold">1</span>
            <p>Generate a registration code below</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#9333EA] text-white text-xs flex items-center justify-center font-bold">2</span>
            <p>From your phone's WhatsApp, send the code to our intake number</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#9333EA] text-white text-xs flex items-center justify-center font-bold">3</span>
            <p>Once registered, forward any job post from any WhatsApp group to that number — it'll auto-capture to Recruiter X</p>
          </div>
          <div className="mt-3 p-3 bg-[#F8FAFC] rounded-lg flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#64748B] flex-shrink-0" />
            <div>
              <p className="text-xs text-[#94A3B8]">WhatsApp intake number</p>
              <p className="font-semibold text-[#0F172A]">{whatsappNumber}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Get Your Registration Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentCode ? (
            <Button
              onClick={generateCode}
              disabled={generating}
              className="gap-2 bg-[#9333EA] hover:bg-[#A855F7] text-white"
            >
              {generating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {generating ? "Generating…" : "Generate Registration Code"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Code ready — valid for 24 hours
                </p>
                <div className="flex items-center gap-3">
                  <code className="text-2xl font-bold tracking-widest text-green-800 font-mono">
                    {currentCode.code}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(currentCode.code)} className="gap-1">
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFC] rounded-xl space-y-2">
                <p className="text-xs font-semibold text-[#94A3B8]">Step 2 — Send this message from WhatsApp</p>
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono text-[#0F172A] flex-1">{registerMessage}</code>
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(registerMessage)} className="gap-1 flex-shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                    Copy message
                  </Button>
                </div>
                <p className="text-xs text-[#94A3B8]">Send this to: <strong>{whatsappNumber}</strong></p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <Clock className="w-3.5 h-3.5" />
                <span>Code expires in 24 hours. Generate a new one if needed.</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={generateCode}
                disabled={generating}
                className="text-[#94A3B8] text-xs"
              >
                Generate a different code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connected numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Connected WhatsApp Numbers
            {connections.length > 0 && (
              <Badge className="bg-[#9333EA] text-white border-0 ml-auto text-[10px]">{connections.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <p className="text-sm text-[#94A3B8]">Loading…</p>
          ) : connections.length === 0 ? (
            <div className="text-center py-6 text-[#94A3B8]">
              <Phone className="w-8 h-8 opacity-20 mx-auto mb-2" />
              <p className="text-sm">No WhatsApp numbers connected yet.</p>
              <p className="text-xs mt-1">Generate a code above and complete registration from your phone.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map(conn => (
                <div key={conn.id} className="flex items-center gap-3 p-3 border border-[#E2E8F0] rounded-xl">
                  <Phone className="w-4 h-4 text-[#64748B] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{conn.channel_name || conn.external_id}</p>
                    {conn.created_date && (
                      <p className="text-xs text-[#94A3B8]">
                        Connected {formatDistanceToNow(new Date(conn.created_date), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Badge className={`border-0 text-xs ${conn.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {conn.is_active ? "Active" : "Paused"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleConnection(conn)}
                    className="text-xs h-7"
                  >
                    {conn.is_active ? "Pause" : "Resume"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sandbox notice */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Production WhatsApp requires Meta Business Verification</p>
          <p className="text-xs mt-1 text-amber-700">
            During development, use the Twilio WhatsApp Sandbox (join with "join {"{your-sandbox-keyword}"}" sent to the sandbox number).
            For production, complete Meta Business Verification (~2–4 weeks) and buy a dedicated number through Twilio.
          </p>
          <a
            href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-800 hover:underline"
          >
            Twilio WhatsApp Sandbox Setup <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
