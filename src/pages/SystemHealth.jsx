import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, CheckCircle2, XCircle, AlertCircle, Activity, Mail, Cpu, Loader2 } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { InboundChannelMessage } from "@/entities/InboundChannelMessage";
import { EmailDraft } from "@/entities/EmailDraft";
import { AuditLog } from "@/entities/AuditLog";
import { InvokeFunction } from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import { usePermissions } from "@/components/common/PermissionsContext";

function StatusDot({ ok }) {
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <XCircle className="w-4 h-4 text-red-500" />;
}

const STATUS_COLORS = {
  processed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  ignored: "bg-slate-100 text-slate-500",
};

const DRAFT_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  approved: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  send_failed: "bg-red-100 text-red-700",
};

export default function SystemHealth() {
  const { isAdmin } = usePermissions();
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const result = await InvokeFunction({ function_name: "healthCheck", payload: {} });
      setHealth(result);
    } catch {
      addNotification({ type: "error", title: "Error", message: "Health check failed" });
    }
    setHealthLoading(false);
  };

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [msgs, dfs, auditData] = await Promise.allSettled([
        InboundChannelMessage.list("-received_at", 100),
        EmailDraft.list("-created_date", 50),
        AuditLog.filter({}, "-created_date", 20).catch(() => []),
      ]);
      setMessages(msgs.status === "fulfilled" ? msgs.value : []);
      setDrafts(dfs.status === "fulfilled" ? dfs.value : []);
      const auditList = auditData.status === "fulfilled" ? auditData.value : [];
      setErrors(auditList.filter(a => a.action?.includes("failed") || a.action?.includes("error")));
    } catch {}
    setDataLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
    runHealthCheck();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-slate-600">Admin access required.</CardContent></Card>
      </div>
    );
  }

  // Stats from messages
  const msgByStatus = messages.reduce((acc, m) => {
    acc[m.processing_status] = (acc[m.processing_status] || 0) + 1;
    return acc;
  }, {});
  const draftByStatus = drafts.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="System Health"
        subtitle="Monitor AI Recruiter pipeline, channel ingestion, and email delivery"
        right={
          <Button variant="outline" size="sm" onClick={() => { loadData(); runHealthCheck(); }} className="gap-2">
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Service health checks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4" />
            Service Health
            {healthLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#94A3B8]" />}
            {health && (
              <Badge className={health.status === "healthy" ? "bg-green-100 text-green-700 border-0 ml-auto" : "bg-yellow-100 text-yellow-700 border-0 ml-auto"}>
                {health.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-3">
              {Object.entries(health.checks || {}).map(([service, check]) => (
                <div key={service} className="flex items-center gap-3">
                  <StatusDot ok={check.ok} />
                  <span className="text-sm font-semibold capitalize text-[#0F172A] w-28">{service}</span>
                  <span className="text-sm text-[#64748B]">{check.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#94A3B8]">Running health checks…</div>
          )}
        </CardContent>
      </Card>

      {/* Channel message stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="w-4 h-4" />
              Inbound Messages (Last 100)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(msgByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={`${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"} border-0`}>
                      {status}
                    </Badge>
                    <span className="text-sm font-semibold text-[#0F172A]">{count}</span>
                  </div>
                ))}
                {Object.keys(msgByStatus).length === 0 && (
                  <p className="text-sm text-[#94A3B8]">No messages yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4" />
              Email Drafts (Last 50)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(draftByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <Badge className={`${DRAFT_COLORS[status] || "bg-slate-100 text-slate-600"} border-0`}>
                      {status}
                    </Badge>
                    <span className="text-sm font-semibold text-[#0F172A]">{count}</span>
                  </div>
                ))}
                {Object.keys(draftByStatus).length === 0 && (
                  <p className="text-sm text-[#94A3B8]">No drafts yet</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent errors */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-600">
              <AlertCircle className="w-4 h-4" />
              Recent Errors ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errors.slice(0, 10).map(err => (
                <div key={err.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-red-800">{err.action}</p>
                    {err.meta?.error && (
                      <p className="text-xs text-red-600 mt-0.5">{err.meta.error}</p>
                    )}
                    <p className="text-xs text-red-400 mt-0.5">
                      {err.created_date ? new Date(err.created_date).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
