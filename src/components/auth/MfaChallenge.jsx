import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { listFactors, challengeAndVerify } from "@/lib/mfa";

/**
 * Two-factor step-up: prompt for the 6-digit TOTP code and elevate the session
 * to aal2. Used on the Login page (after password) and by the route guard.
 *
 * @param {{ onSuccess: () => void, onCancel?: () => void }} props
 */
export default function MfaChallenge({ onSuccess, onCancel }) {
  const [code, setCode]       = useState("");
  const [factorId, setFactorId] = useState(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listFactors()
      .then(({ verified }) => {
        if (verified[0]) setFactorId(verified[0].id);
        else setError("No verified authenticator found for this account.");
      })
      .catch((e) => setError(e?.message || "Could not load your authenticator."));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!factorId) return;
    setError("");
    setLoading(true);
    try {
      await challengeAndVerify(factorId, code.trim());
      onSuccess();
    } catch (err) {
      setError(err?.message || "Invalid code. Try again.");
      setCode("");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[#EDE9FE] flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="w-6 h-6 text-[#9333EA]" />
        </div>
        <h2 className="font-semibold text-[#0F172A]">Two-factor verification</h2>
        <p className="text-sm text-[#64748B] mt-1">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mfa-code" className="text-sm text-[#0F172A]">Authentication code</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="h-11 rounded-xl border-[#E2E8F0] text-center text-lg tracking-[0.4em]"
        />
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <Button
        type="submit"
        disabled={loading || code.length !== 6 || !factorId}
        className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
      </Button>

      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}
          className="w-full text-[#64748B] text-sm">
          Sign in with a different account
        </Button>
      )}
    </form>
  );
}
