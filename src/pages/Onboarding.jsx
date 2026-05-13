import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Mail, MessageSquare, Brain, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

const STEPS = [
  { id: "llm",      label: "AI Model",     icon: Brain },
  { id: "email",    label: "Email",        icon: Mail },
  { id: "channels", label: "Channels",     icon: MessageSquare },
  { id: "done",     label: "Launch",       icon: Zap },
];

export default function Onboarding() {
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  // LLM config
  const [llmProvider, setLlmProvider] = useState("openai");
  const [openaiKey, setOpenaiKey]     = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [matchModel, setMatchModel]   = useState("gpt-4o-mini");
  const [draftModel, setDraftModel]   = useState("gpt-4o");

  // Email config
  const [postmarkToken, setPostmarkToken] = useState("");
  const [fromEmail, setFromEmail]         = useState("");
  const [autoApprove, setAutoApprove]     = useState(false);
  const [autoFollowup, setAutoFollowup]   = useState(true);
  const [cadenceDays, setCadenceDays]     = useState(3);
  const [maxFollowups, setMaxFollowups]   = useState(3);

  // Channels
  const [telegramToken, setTelegramToken] = useState("");
  const [slackToken, setSlackToken]       = useState("");

  const saveLLM = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert([
      { key: "llm_provider",   value: llmProvider },
      { key: "openai_key",     value: openaiKey },
      { key: "anthropic_key",  value: anthropicKey },
    ]);
    await supabase.from("ai_recruiter_settings").update({
      matching_model: matchModel,
      drafting_model: draftModel,
      default_model:  matchModel,
    }).neq("id", "00000000-0000-0000-0000-000000000000");
    setSaving(false);
    setStep(1);
  };

  const saveEmail = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert([
      { key: "postmark_token", value: postmarkToken },
      { key: "from_email",     value: fromEmail },
    ]);
    await supabase.from("ai_recruiter_settings").update({
      send_immediately_on_approval: autoApprove,
      auto_followup_enabled:        autoFollowup,
      default_followup_cadence:     cadenceDays,
      max_followups:                maxFollowups,
    }).neq("id", "00000000-0000-0000-0000-000000000000");
    setSaving(false);
    setStep(2);
  };

  const saveChannels = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert([
      { key: "telegram_bot_token", value: telegramToken },
      { key: "slack_bot_token",    value: slackToken },
    ]);
    setSaving(false);
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#9333EA] mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Set up Recruiter X</h1>
          <p className="text-sm text-[#64748B] mt-1">Configure your AI pipeline — you can change this later</p>
        </div>

        {/* Step bar */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    i < step  ? "bg-green-500 text-white" :
                    i === step ? "bg-[#9333EA] text-white" :
                    "bg-[#E2E8F0] text-[#94A3B8]"
                  }`}>
                    {i < step ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium ${i === step ? "text-[#9333EA]" : "text-[#94A3B8]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 mb-4 ${i < step ? "bg-green-400" : "bg-[#E2E8F0]"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">

          {/* Step 0 — LLM */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-[#0F172A]">AI Model Configuration</h2>

              <div className="space-y-1.5">
                <Label className="text-sm">Primary LLM Provider</Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger className="h-11 rounded-xl border-[#E2E8F0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="ollama">Ollama (Local)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(llmProvider === "openai" || llmProvider === "anthropic") && (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {llmProvider === "openai" ? "OpenAI API Key" : "Anthropic API Key"}
                  </Label>
                  <Input
                    type="password"
                    placeholder={llmProvider === "openai" ? "sk-..." : "sk-ant-..."}
                    value={llmProvider === "openai" ? openaiKey : anthropicKey}
                    onChange={(e) => llmProvider === "openai"
                      ? setOpenaiKey(e.target.value)
                      : setAnthropicKey(e.target.value)
                    }
                    className="h-11 rounded-xl border-[#E2E8F0] font-mono text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Matching Model</Label>
                  <Select value={matchModel} onValueChange={setMatchModel}>
                    <SelectTrigger className="h-10 rounded-xl border-[#E2E8F0] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                      <SelectItem value="claude-haiku-4-5-20251001">claude-haiku</SelectItem>
                      <SelectItem value="llama3.2">llama3.2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Drafting Model</Label>
                  <Select value={draftModel} onValueChange={setDraftModel}>
                    <SelectTrigger className="h-10 rounded-xl border-[#E2E8F0] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="claude-sonnet-4-6">claude-sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-[#94A3B8] bg-[#F8FAFC] p-3 rounded-xl">
                Keys are stored in Supabase app_settings. For production, move them to Supabase Edge Function secrets.
              </p>

              <Button onClick={saveLLM} disabled={saving}
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
          )}

          {/* Step 1 — Email */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-[#0F172A]">Email Configuration</h2>

              <div className="space-y-1.5">
                <Label className="text-sm">Postmark Server Token</Label>
                <Input
                  type="password"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={postmarkToken}
                  onChange={(e) => setPostmarkToken(e.target.value)}
                  className="h-11 rounded-xl border-[#E2E8F0] font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">From Email Address</Label>
                <Input
                  type="email"
                  placeholder="recruiter@yourcompany.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="h-11 rounded-xl border-[#E2E8F0]"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Send on approval</p>
                    <p className="text-xs text-[#94A3B8]">Send email immediately after draft is approved</p>
                  </div>
                  <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">Auto follow-up</p>
                    <p className="text-xs text-[#94A3B8]">Schedule follow-ups after submissions</p>
                  </div>
                  <Switch checked={autoFollowup} onCheckedChange={setAutoFollowup} />
                </div>
                {autoFollowup && (
                  <div className="grid grid-cols-2 gap-3 pl-0">
                    <div className="space-y-1">
                      <Label className="text-xs text-[#64748B]">Cadence (days)</Label>
                      <Input type="number" min={1} max={14} value={cadenceDays}
                        onChange={(e) => setCadenceDays(Number(e.target.value))}
                        className="h-9 rounded-xl border-[#E2E8F0] text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-[#64748B]">Max follow-ups</Label>
                      <Input type="number" min={1} max={10} value={maxFollowups}
                        onChange={(e) => setMaxFollowups(Number(e.target.value))}
                        className="h-9 rounded-xl border-[#E2E8F0] text-sm" />
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={saveEmail} disabled={saving}
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
              <button onClick={() => setStep(2)} className="w-full text-center text-sm text-[#94A3B8] hover:text-[#0F172A]">
                Skip for now
              </button>
            </div>
          )}

          {/* Step 2 — Channels */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-[#0F172A]">Connect Channels</h2>
              <p className="text-sm text-[#64748B]">Optional — connect Telegram or Slack to forward job posts automatically.</p>

              <div className="space-y-1.5">
                <Label className="text-sm">Telegram Bot Token</Label>
                <Input
                  type="password"
                  placeholder="123456:ABCDEF..."
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="h-11 rounded-xl border-[#E2E8F0] font-mono text-sm"
                />
                <p className="text-xs text-[#94A3B8]">Create a bot at @BotFather on Telegram</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Slack Bot Token</Label>
                <Input
                  type="password"
                  placeholder="xoxb-..."
                  value={slackToken}
                  onChange={(e) => setSlackToken(e.target.value)}
                  className="h-11 rounded-xl border-[#E2E8F0] font-mono text-sm"
                />
                <p className="text-xs text-[#94A3B8]">Create a Slack app at api.slack.com</p>
              </div>

              <Button onClick={saveChannels} disabled={saving}
                className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Save & Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
              <button onClick={() => setStep(3)} className="w-full text-center text-sm text-[#94A3B8] hover:text-[#0F172A]">
                Skip for now
              </button>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-full bg-[#9333EA] flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#0F172A]">Recruiter X is ready!</h2>
              <p className="text-sm text-[#64748B]">
                Your AI recruiting pipeline is configured. Start by adding candidates and jobs, or paste a job description into the AI Recruiter.
              </p>
              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-11 rounded-xl bg-[#9333EA] hover:bg-[#A855F7] text-white"
                  onClick={() => window.location.href = "/Dashboard"}
                >
                  Go to Dashboard
                </Button>
                <Button variant="outline"
                  className="w-full h-11 rounded-xl border-[#E2E8F0]"
                  onClick={() => window.location.href = "/AIRecruiter"}
                >
                  Open AI Recruiter
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
