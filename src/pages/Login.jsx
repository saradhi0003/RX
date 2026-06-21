import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Zap, Users, AlertTriangle } from "lucide-react";

const DEMO_USERS = [
  {
    label: "Admin",
    fullName: "Admin Demo",
    email: "admin@recruiterx.demo",
    password: "Demo@Admin123",
    role: "admin",
    color: "bg-[#9333EA] hover:bg-[#A855F7] text-white",
    description: "Full access",
  },
  {
    label: "Recruiter",
    fullName: "Recruiter Demo",
    email: "recruiter@recruiterx.demo",
    password: "Demo@Recruiter123",
    role: "recruiter",
    color: "bg-[#2563EB] hover:bg-[#1D4ED8] text-white",
    description: "Recruiting ops",
  },
  {
    label: "Accounts",
    fullName: "Accounts Demo",
    email: "accounts@recruiterx.demo",
    password: "Demo@Accounts123",
    role: "accounts",
    color: "bg-[#10B981] hover:bg-[#059669] text-white",
    description: "Invoices & expenses",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [demoLoading, setDemoLoading] = useState(""); // label of demo being signed in
  const [error, setError]             = useState("");
  const [magicSent, setMagicSent]     = useState(false);
  const [mode, setMode]               = useState("password");

  /* ── helpers ── */

  const goToDashboard = () => navigate("/Dashboard", { replace: true });

  /**
   * Try sign-in; if the account doesn't exist yet, create it then sign in.
   * @param {string} emailVal @param {string} passwordVal @param {string} fullName @param {string} role
   */
  const signInOrCreate = async (emailVal, passwordVal, fullName, role) => {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: emailVal,
      password: passwordVal,
    });

    if (!signInErr) return; // success

    const isNotFound =
      signInErr.message.toLowerCase().includes("invalid login") ||
      signInErr.message.toLowerCase().includes("user not found") ||
      signInErr.message.toLowerCase().includes("email not confirmed");

    if (!isNotFound) throw signInErr;

    // Account doesn't exist — auto-create it
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: emailVal,
      password: passwordVal,
      options: { data: { full_name: fullName } },
    });
    if (signUpErr) throw signUpErr;

    // Create profile row
    if (signUpData?.user) {
      await supabase.from("user_profiles").upsert({
        id: signUpData.user.id,
        email: emailVal,
        full_name: fullName,
        role,
      });
    }

    // Sign in after creation
    const { error: signInErr2 } = await supabase.auth.signInWithPassword({
      email: emailVal,
      password: passwordVal,
    });
    if (signInErr2) {
      // Email confirmation may be required — tell the user clearly
      if (signInErr2.message.toLowerCase().includes("email not confirmed")) {
        throw new Error(
          "Account created but email confirmation is required. " +
          "Disable 'Confirm email' in Supabase → Authentication → Settings, then try again."
        );
      }
      throw signInErr2;
    }
  };

  /* ── handlers ── */

  /** @param {React.FormEvent} e */
  const handlePassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInOrCreate(email, password, "User", "member");
      goToDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setLoading(false);
    }
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

  /** @param {typeof DEMO_USERS[0]} demo */
  const handleDemoLogin = async (demo) => {
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
      return;
    }
    setError("");
    setDemoLoading(demo.label);
    setEmail(demo.email);
    setPassword(demo.password);
    setMode("password");
    try {
      await signInOrCreate(demo.email, demo.password, demo.fullName, demo.role);
      goToDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setDemoLoading("");
    }
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

        {/* ── Demo accounts ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm font-medium text-[#0F172A]">Try a demo account</span>
            <span className="ml-auto text-[10px] text-[#94A3B8]">auto-created on first use</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.label}
                onClick={() => handleDemoLogin(demo)}
                disabled={!!demoLoading || loading}
                className={`${demo.color} rounded-xl py-2.5 px-2 text-center transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {demoLoading === demo.label
                  ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  : (
                    <>
                      <p className="text-sm font-semibold leading-none">{demo.label}</p>
                      <p className="text-[10px] mt-1 opacity-80 leading-tight">{demo.description}</p>
                    </>
                  )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-xs text-[#94A3B8] font-medium">or sign in with email</span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        {/* ── Sign-in card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
          {magicSent ? (
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
                  disabled={loading || !!demoLoading}
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
