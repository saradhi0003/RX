import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Zap, CheckCircle2 } from "lucide-react";

const STEPS = ["Account", "Workspace", "Done"];

export default function Register() {
  const [step, setStep]           = useState(0);
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [fullName, setFullName]   = useState("");
  const [workspace, setWorkspace] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);

  const handleStep0 = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (err) { setError(err.message); setLoading(false); return; }

    // The user_profiles row is created in step 1 — it requires a workspace_id
    // (NOT NULL since migration 012), and the workspace name is collected next.
    setLoading(false);
    setStep(1);
  };

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. Create the workspace. Use a client-side id so we never have to read
      //    the row back through RLS (the profile doesn't exist yet, so
      //    auth_workspace_id() is still null and would hide an insert-returning).
      const workspaceId = crypto.randomUUID();
      const { error: wsErr } = await supabase
        .from("workspaces")
        .insert({ id: workspaceId, name: workspace || "My Workspace" });
      if (wsErr) { setError(wsErr.message); setLoading(false); return; }

      // 2. Create the user's profile in that workspace (admin = first user).
      const { error: pErr } = await supabase.from("user_profiles").upsert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: "admin",
        workspace_id: workspaceId,
      });
      if (pErr) { setError(pErr.message); setLoading(false); return; }

      // 3. Store the workspace name as a workspace-scoped setting
      //    (the BEFORE INSERT trigger stamps workspace_id automatically).
      await supabase
        .from("app_settings")
        .upsert({ key: "workspace_name", value: workspace }, { onConflict: "workspace_id,key" });

      // 4. Seed a default AI recruiter settings row.
      await supabase.from("ai_recruiter_settings").upsert({ id: crypto.randomUUID() }).select();
    }
    setLoading(false);
    setDone(true);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#9333EA] mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Recruiter X</h1>
          <p className="text-sm text-[#64748B] mt-1">Create your workspace</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                i === step ? "text-[#9333EA]" : i < step ? "text-green-600" : "text-[#94A3B8]"
              }`}>
                {i < step
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <span className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] ${
                      i === step ? "border-[#9333EA] bg-[#9333EA] text-white" : "border-[#E2E8F0]"
                    }`}>{i + 1}</span>
                }
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px max-w-[32px] ${i < step ? "bg-green-400" : "bg-[#E2E8F0]"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
          {step === 0 && (
            <form onSubmit={handleStep0} className="space-y-4">
              <h2 className="font-semibold text-[#0F172A] mb-4">Your account</h2>
              <div className="space-y-1.5">
                <Label className="text-sm">Full Name</Label>
                <Input
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#E2E8F0]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Work Email</Label>
                <Input
                  type="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#E2E8F0]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 rounded-xl border-[#E2E8F0] pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
              </Button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <h2 className="font-semibold text-[#0F172A] mb-4">Name your workspace</h2>
              <div className="space-y-1.5">
                <Label className="text-sm">Workspace / Company Name</Label>
                <Input
                  placeholder="Acme Staffing"
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#E2E8F0]"
                />
                <p className="text-xs text-[#94A3B8]">You can invite teammates after setup.</p>
              </div>
              {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Workspace"}
              </Button>
            </form>
          )}

          {step === 2 && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="font-semibold text-[#0F172A]">You're all set!</h2>
              <p className="text-sm text-[#64748B]">
                Workspace <strong>{workspace}</strong> is ready. Let's set up your AI recruiter.
              </p>
              <Button
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white"
                onClick={() => window.location.href = "/Onboarding"}
              >
                Set up AI Recruiter →
              </Button>
            </div>
          )}
        </div>

        {step === 0 && (
          <p className="text-center text-sm text-[#64748B] mt-6">
            Already have an account?{" "}
            <a href="/Login" className="text-[#9333EA] font-medium hover:underline">Sign in</a>
          </p>
        )}
      </div>
    </div>
  );
}
