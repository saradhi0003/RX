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

  // Brand lockup: vector mark + wordmark (purple T + S, matching the logo)
  const Wordmark = ({ light = false }) => (
    <span
      className="font-semibold tracking-tight"
      style={{ fontFamily: "'Bricolage Grotesque', 'IBM Plex Sans', sans-serif" }}
    >
      <span className="text-[#5A16F3]">T</span>
      <span className={light ? "text-white" : "text-[#16121F]"}>alent </span>
      <span className="text-[#5A16F3]">S</span>
      <span className={light ? "text-white" : "text-[#16121F]"}>tack</span>
    </span>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFC]">

      {/* ══ Left — brand panel (desktop only) ══ */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-1/2 relative overflow-hidden flex-col justify-between p-12 bg-[#0D0A1F]">
        {/* Oversized translucent mark as backdrop art */}
        <svg viewBox="0 0 96 96" className="absolute -right-24 -bottom-28 w-[560px] h-[560px] opacity-[0.16] pointer-events-none" aria-hidden="true">
          <g transform="translate(8 16) skewY(-9)">
            <rect x="0" y="28" width="21" height="42" rx="8" fill="#2BD5F6" />
            <rect x="26" y="18" width="21" height="58" rx="8" fill="#189FE8" />
            <rect x="52" y="0" width="23" height="66" rx="8" fill="#5A16F3" />
          </g>
        </svg>
        <div className="absolute -left-32 -top-32 w-96 h-96 rounded-full bg-[#5A16F3] opacity-20 blur-[120px] pointer-events-none" aria-hidden="true" />

        {/* Lockup */}
        <div className="relative flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
          <span className="text-[22px]"><Wordmark light /></span>
        </div>

        {/* Headline + value props */}
        <div className="relative max-w-md">
          <h1
            className="text-4xl xl:text-[44px] leading-[1.12] font-semibold text-white"
            style={{ fontFamily: "'Bricolage Grotesque', 'IBM Plex Sans', sans-serif" }}
          >
            Hiring, stacked
            <br />in your <span className="text-[#2BD5F6]">favor</span>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[#A8A3BD]">
            One workspace for candidates, jobs, and clients — with an AI recruiter
            that reads, matches, and drafts while your team closes.
          </p>
          <ul className="mt-8 space-y-3">
            {["AI matching & outreach drafts", "Pipeline Kanban with approvals", "Your inbox, auto-triaged"].map((t) => (
              <li key={t} className="flex items-center gap-3 text-sm text-[#CFCBE0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2BD5F6]" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-[#6E6788]">© {new Date().getFullYear()} TalentStack · recruiterx.app</p>
      </div>

      {/* ══ Right — sign-in ══ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">

        {/* Lockup (mobile + form header) */}
        <div className="mb-10 lg:mb-8">
          <div className="flex items-center gap-2.5 lg:hidden mb-8 justify-center">
            <img src="/logo.svg" alt="" className="h-9 w-9" />
            <span className="text-[21px]"><Wordmark /></span>
          </div>
          <h2
            className="text-[26px] font-semibold text-[#16121F] tracking-tight"
            style={{ fontFamily: "'Bricolage Grotesque', 'IBM Plex Sans', sans-serif" }}
          >
            Welcome back
          </h2>
          <p className="text-sm text-[#6E6788] mt-1.5">Sign in to your workspace to continue.</p>
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

        {/* ── Sign-in ── */}
        <div>
          {mfaStep ? (
            <div className="bg-white rounded-2xl border border-[#EAE8F0] shadow-[0_1px_2px_rgba(22,18,31,.04)] p-8">
              <MfaChallenge onSuccess={onMfaVerified} onCancel={cancelMfa} />
            </div>
          ) : magicSent ? (
            <div className="bg-white rounded-2xl border border-[#EAE8F0] shadow-[0_1px_2px_rgba(22,18,31,.04)] p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[#EAFBF1] flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-[#16A34A]" />
              </div>
              <h2 className="font-semibold text-[#16121F] mb-2">Check your email</h2>
              <p className="text-sm text-[#6E6788]">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
              <Button
                variant="ghost"
                className="mt-4 text-[#5A16F3] text-sm"
                onClick={() => { setMagicSent(false); setMode("password"); }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div className="flex rounded-xl bg-[#F1EFF6] p-1 mb-6">
                {["password", "magic"].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    className={`flex-1 text-sm py-2 rounded-lg font-medium transition-all ${
                      mode === m
                        ? "bg-white text-[#16121F] shadow-[0_1px_3px_rgba(22,18,31,.08)]"
                        : "text-[#6E6788] hover:text-[#16121F]"
                    }`}
                  >
                    {m === "password" ? "Password" : "Magic Link"}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === "password" ? handlePassword : handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[13px] font-medium text-[#3B3552]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 rounded-xl bg-white border-[#DDD9E8] focus-visible:ring-2 focus-visible:ring-[#5A16F3]/30 focus-visible:border-[#5A16F3]"
                  />
                </div>

                {mode === "password" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[13px] font-medium text-[#3B3552]">Password</Label>
                      <a href="/reset-password" className="text-xs text-[#5A16F3] hover:underline">
                        Forgot password?
                      </a>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-11 rounded-xl bg-white border-[#DDD9E8] focus-visible:ring-2 focus-visible:ring-[#5A16F3]/30 focus-visible:border-[#5A16F3] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        aria-label={showPw ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A84A3] hover:text-[#3B3552]"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3.5 py-2.5 rounded-xl leading-relaxed">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl bg-[#5A16F3] hover:bg-[#4A0FD6] active:bg-[#3F0BBd] text-white font-medium text-[15px] shadow-[0_1px_2px_rgba(90,22,243,.35)] transition-colors"
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : mode === "password" ? "Sign in" : "Send magic link"}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[#6E6788] mt-8">
          Don't have an account?{" "}
          <a href="/Register" className="text-[#5A16F3] font-medium hover:underline">
            Create workspace
          </a>
        </p>

      </div>
      </div>
    </div>
  );
}
