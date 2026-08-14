import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { EmailAccount } from "@/entities/EmailAccount";
import { addNotification } from "@/components/notifications/NotificationToast";
import PageHeader from "@/components/common/PageHeader";
import { Mail, MailPlus, Loader2, RefreshCcw, Unlink, CheckCircle2, AlertTriangle } from "lucide-react";

const PROVIDERS = [
  { id: "gmail", label: "Gmail", description: "Google OAuth — read-only Gmail API scope" },
  { id: "zoho", label: "Zoho Mail", description: "Zoho OAuth — ZohoMail messages read scope" },
];

export default function EmailSettings() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState("");
  const [loadError, setLoadError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const rows = await EmailAccount.list("-created_at", 50);
      setAccounts(rows || []);
      setLoadError("");
    } catch (err) {
      // Distinguished from "none connected" on purpose: a permissions or
      // network failure that renders as an empty list reads as "nothing is
      // connected", and someone reconnects a mailbox that was never gone.
      console.error("Failed to load email accounts:", err);
      setAccounts([]);
      setLoadError(err?.message || "Could not load connected mailboxes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  // Landing back from the provider consent screen.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    if (connected) {
      addNotification({ type: "success", title: "Mailbox connected", message: `${connected} account linked. Polling starts within 5 minutes.` });
      loadAccounts();
    } else if (oauthError) {
      addNotification({ type: "error", title: "Connection failed", message: oauthError, duration: 8000 });
    }
    if (connected || oauthError) setSearchParams({}, { replace: true });
  }, [searchParams]);

  const connect = async (provider) => {
    setConnecting(provider);
    try {
      const { data, error } = await supabase.functions.invoke("emailOAuthStart", { body: { provider } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.consent_url) throw new Error("No consent URL returned");
      window.location.href = data.consent_url;
    } catch (err) {
      console.error("OAuth start failed:", err);
      addNotification({
        type: "error",
        title: "Could not start connection",
        message: err.message || "Check that the OAuth secrets are set",
        duration: 8000,
      });
      setConnecting("");
    }
  };

  const disconnect = async (account) => {
    try {
      await EmailAccount.update(account.id, { is_active: false });
      addNotification({ type: "success", title: "Disconnected", message: `${account.email_address} will no longer be polled.` });
      loadAccounts();
    } catch (err) {
      addNotification({ type: "error", title: "Disconnect failed", message: err.message });
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Email Settings"
        subtitle="Connect Gmail and Zoho inboxes — inbound mail is classified by the local LLM and routed to Jobs / Candidates"
        right={
          <Button variant="outline" onClick={loadAccounts} className="gap-2">
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      {/* Connect providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((p) => {
          const connectedAccounts = accounts.filter((a) => a.provider === p.id && a.is_active);
          return (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="w-5 h-5" />
                  {p.label}
                  {connectedAccounts.length > 0 && (
                    <Badge className="bg-green-100 text-green-800">
                      {connectedAccounts.length} connected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">{p.description}</p>
                <Button onClick={() => connect(p.id)} disabled={!!connecting} className="gap-2">
                  {connecting === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MailPlus className="w-4 h-4" />
                  )}
                  Connect {p.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connected accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Mailboxes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : loadError ? (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Could not load mailboxes</p>
                <p className="text-xs text-red-700 mt-0.5">{loadError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={loadAccounts}>
                  Retry
                </Button>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-sm text-slate-500 p-2">
              No mailboxes connected yet. Connect Gmail or Zoho above — once linked, new mail is
              polled every 5 minutes, classified, and turned into Job / Candidate records
              (low-confidence items go to the Approval Queue).
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    {a.is_active && !a.last_error ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{a.email_address}</p>
                      <p className="text-xs text-slate-500">
                        {a.provider} · {a.is_active ? "active" : "disabled"}
                        {a.last_polled_at && ` · last polled ${new Date(a.last_polled_at).toLocaleString()}`}
                      </p>
                      {a.last_error && (
                        <p className="text-xs text-red-600 mt-0.5">{a.last_error}</p>
                      )}
                    </div>
                  </div>
                  {a.is_active && (
                    <Button variant="outline" size="sm" onClick={() => disconnect(a)} className="gap-1.5">
                      <Unlink className="w-3.5 h-3.5" />
                      Disconnect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-slate-500">
            Tokens are stored server-side in Supabase (never in the browser). The poller runs as an
            Edge Function on a schedule gated by CRON_SECRET; classification and parsing use the
            local LM Studio fleet first and fall back to DeepSeek → Qwen → Claude automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
