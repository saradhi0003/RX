import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { mfaStatus } from "@/lib/mfa";
import MfaChallenge from "@/components/auth/MfaChallenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Zap, AlertTriangle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { mfaChallengeRequired, refreshMfa } = useAuth();
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [magicSent, setMagicSent]     = useState(false);
  const [mode, setMode]               = useState("password");
  const [mfaStep, setMfaStep]         = useState(false); // show TOTP challenge

  /* ── helpers ── */

  const goToDashboard = () => navigate("/Dashboard", { replace: true });

  // If a session already exists at aal1 with a verified factor (e.g. page
  // reload mid-login), surface the challenge automatically.
  useEffect(() => { if (mfaChallengeRequired) setMfaStep(true); }, [mfaChallengeRequired]);

  // On successful TOTP verify: refresh assurance level, then proceed.
  const onMfaVerified = async () => { await refreshMfa(); goToDashboard(); };

  /**
   * After a successful password sign-in, step up to aal2 if the account has a
   * verified authenticator; otherwise go straight to the dashboard.
   */
  const continueAfterSignIn = async () => {
    try {
      const { shouldChallenge } = await mfaStatus();
      if (shouldChallenge) { setMfaStep(true); setLoading(false); return; }
    } catch { /* if AAL check fails, fall through to dashboard */ }
    goToDashboard();
  };

  const cancelMfa = async () => {
    await supabase.auth.signOut();
    setMfaStep(false);
    setPassword("");
    setError("");
  };

  /* ── handlers ── */

  /** @param {React.FormEvent} e */
  const handlePassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      const msg = signInErr.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        setError("Please verify your email first — check your inbox for the confirmation link.");
      } else if (msg.includes("invalid login")) {
        setError("Invalid email or password. New here? Create an account to get started.");
      } else {
        setError(signInErr.message);
      }
      setLoading(false);
      return;
    }
    await continueAfterSignIn();
  };

  /** @param {React.FormEvent} e */
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/Dashboard` },
    });
    if (err) setError(err.message);
    else setMagicSent(true);
    setLoading(false);
  };

  /* ── render ── */

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo — swap /logo.svg in public/ for your company mark (PNG/SVG). */}
        {/* Falls back to gradient RX mark if logo.svg is missing.            */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img
              src="/logo.svg"
              alt="Recruiter X"
              className="h-14 w-auto"
              onError={(e) => { e.currentTarget.src = "/favicon.svg"; e.currentTarget.className = "h-14 w-14"; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Recruiter X</h1>
          <p className="text-sm text-[#64748B] mt-1">Sign in to your workspace</p>
        </div>

        {/* ── Not-configured banner ── */}
        {!isSupabaseConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <div className="flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Supabase not connected</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Edit <code className="bg-amber-100 px-1 rounded font-mono">.env.local</code> and set:
                </p>
                <pre className="text-[10px] text-amber-900 bg-amber-100 rounded-lg p-2 mt-1.5 leading-relaxed font-mono overflow-auto">
{`VITE_SUPABASE_URL=https://<id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
                </pre>
                <p className="text-[10px] text-amber-700 mt-1">
                  Find these in Supabase → Settings → API, then restart the dev server.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Sign-in card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
          {mfaStep ? (
            <MfaChallenge onSuccess={onMfaVerified} onCancel={cancelMfa} />
          ) : magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="font-semibold text-[#0F172A] mb-2">Check your email</h2>
              <p className="text-sm text-[#64748B]">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
              <Button
                variant="ghost"
                className="mt-4 text-[#9333EA] text-sm"
                onClick={() => { setMagicSent(false); setMode("password"); }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex rounded-xl bg-[#F8FAFC] p-1 mb-6">
                {["password", "magic"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-all ${
                      mode === m
                        ? "bg-white text-[#0F172A] shadow-sm"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    {m === "password" ? "Password" : "Magic Link"}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === "password" ? handlePassword : handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm text-[#0F172A]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#9333EA] focus:ring-[#9333EA]"
                  />
                </div>

                {mode === "password" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm text-[#0F172A]">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 rounded-xl border-[#E2E8F0] focus:border-[#9333EA] focus:ring-[#9333EA] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-right">
                      <a href="/reset-password" className="text-xs text-[#9333EA] hover:underline">
                        Forgot password?
                      </a>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg leading-relaxed">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white font-medium"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : mode === "password" ? "Sign In" : "Send Magic Link"}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[#64748B] mt-6">
          Don't have an account?{" "}
          <a href="/Register" className="text-[#9333EA] font-medium hover:underline">
            Create workspace
          </a>
        </p>

      </div>
    </div>
  );
}
