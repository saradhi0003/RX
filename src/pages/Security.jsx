import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, ShieldAlert, Loader2, Trash2, Plus } from "lucide-react";
import { listFactors, enrollTotp, verifyEnrollment, unenroll } from "@/lib/mfa";
import { useAuth } from "@/lib/AuthContext";

/**
 * Security settings — manage TOTP two-factor authentication.
 * Enroll (QR + secret) → verify → the factor becomes required at next login.
 */
export default function Security() {
  const { refreshMfa } = useAuth();
  const [factors, setFactors]   = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [enrolling, setEnrolling]     = useState(null); // { factorId, qrSvg, secret }
  const [code, setCode]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [notice, setNotice]     = useState("");

  const refresh = async () => {
    setLoadingList(true);
    try {
      const { verified } = await listFactors();
      setFactors(verified);
    } catch (e) {
      setError(e?.message || "Could not load factors.");
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setError(""); setNotice(""); setBusy(true);
    try {
      const started = await enrollTotp(`Authenticator ${new Date().toISOString().slice(0, 10)}`);
      setEnrolling(started);
    } catch (e) {
      setError(e?.message || "Could not start enrollment.");
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await verifyEnrollment(enrolling.factorId, code.trim());
      setEnrolling(null);
      setCode("");
      setNotice("Two-factor authentication is now enabled. You'll be asked for a code at your next sign-in.");
      await refresh();
      await refreshMfa();
    } catch (err) {
      setError(err?.message || "Invalid code — check your app's clock and try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (factorId) => {
    setError(""); setBusy(true);
    try {
      await unenroll(factorId);
      await refresh();
      await refreshMfa();
      setNotice("Authenticator removed.");
    } catch (e) {
      setError(e?.message || "Could not remove — you may need to re-verify (aal2) first.");
    } finally {
      setBusy(false);
    }
  };

  const hasMfa = factors.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Security</h1>
        <p className="text-sm text-[#64748B] mt-1">Protect your account with two-factor authentication.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {hasMfa
              ? <><ShieldCheck className="w-5 h-5 text-green-600" /> Two-factor authentication is on</>
              : <><ShieldAlert className="w-5 h-5 text-amber-500" /> Two-factor authentication is off</>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">{notice}</p>}
          {error  && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {/* Existing factors */}
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between border border-[#E2E8F0] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">{f.friendly_name || "Authenticator app"}</p>
                  <p className="text-xs text-[#94A3B8]">TOTP · verified</p>
                </div>
                <Button variant="ghost" size="sm" disabled={busy}
                  onClick={() => remove(f.id)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}

          {/* Enroll flow */}
          {enrolling ? (
            <form onSubmit={confirmEnroll} className="space-y-3 border-t border-[#E2E8F0] pt-4">
              <p className="text-sm text-[#0F172A] font-medium">1. Scan this QR in your authenticator app</p>
              <div className="flex justify-center bg-white rounded-xl border border-[#E2E8F0] p-4"
                   // Supabase returns the QR as an inline SVG string.
                   dangerouslySetInnerHTML={{ __html: enrolling.qrSvg }} />
              <p className="text-xs text-[#64748B]">
                Or enter this key manually:{" "}
                <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded font-mono text-[11px] break-all">{enrolling.secret}</code>
              </p>
              <Label htmlFor="enroll-code" className="text-sm">2. Enter the 6-digit code</Label>
              <Input id="enroll-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="123456" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-11 rounded-xl text-center text-lg tracking-[0.3em]" />
              <div className="flex gap-2">
                <Button type="submit" disabled={busy || code.length !== 6}
                  className="bg-[#9333EA] hover:bg-[#A855F7] text-white rounded-xl">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & enable"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => { setEnrolling(null); setCode(""); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={startEnroll} disabled={busy}
              className="rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add authenticator</>}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
