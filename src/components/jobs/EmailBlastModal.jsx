
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Mail, MailPlus, Sparkles, X, Send } from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { sendAppEmail } from "@/components/utils/email"; // Changed import path

export default function EmailBlastModal({ open, onClose, jobs = [], recruiters = [], candidates = [] }) {
  const [selectedJobIds, setSelectedJobIds] = useState(jobs.map(j => j.id));
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const marketingRecipients = useMemo(
    () => recruiters.filter(r => r.is_marketing && r.status === "active").map(r => r.email).filter(Boolean),
    [recruiters]
  );
  const [subject, setSubject] = useState(`Open roles roundup – ${new Date().toLocaleDateString()}`);
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const toggleJob = (id) => {
    setSelectedJobIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCandidate = (id) => {
    setSelectedCandidateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generateSummary = async () => {
    setGenerating(true);
    const chosen = jobs.filter(j => selectedJobIds.includes(j.id));
    const prompt = `
Summarize these ${chosen.length} jobs into a concise marketing email with:
- Short intro line
- Bulleted highlights per role (title, location, 3 key requirements)
- Clear call-to-action to reply with candidates
Keep it professional and crisp.

Jobs JSON:
${JSON.stringify(chosen.map(j => ({
  title: j.title,
  location: j.location,
  required_skills: j.required_skills,
  description: j.description,
  company_id: j.company_id
})), null, 2)}
`;
    const res = await InvokeLLM({ prompt });
    const candidateLines = candidates
      .filter(c => selectedCandidateIds.includes(c.id))
      .map(c => `- ${c.first_name} ${c.last_name} (${c.current_title || ""})`);
    const footer = candidateLines.length ? `\n\nSuggested candidates:\n${candidateLines.join("\n")}` : "";
    setBody((typeof res === "string" ? res : JSON.stringify(res, null, 2)) + footer);
    setGenerating(false);
  };

  const sendBlast = async () => {
    setSending(true);
    const recipients = marketingRecipients;
    for (const to of recipients) {
      await sendAppEmail({
        to,
        subject,
        body
      });
    }
    setSending(false);
    onClose();
    alert(`Email sent to ${recipients.length} marketing recruiter(s).`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><MailPlus className="w-5 h-5" /> Email Blast</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </CardHeader>
        <CardContent className="overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <Label>Subject</Label>
                <Input value={subject} onChange={(e)=>setSubject(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Body</Label>
                <Button variant="outline" size="sm" onClick={generateSummary} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Summary
                </Button>
              </div>
              <Textarea className="min-h-[280px]" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Email content..." />
            </div>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Select Jobs</Label>
                  <Button variant="outline" size="sm" onClick={()=>setSelectedJobIds(jobs.map(j=>j.id))}>Select all</Button>
                </div>
                <div className="mt-2 max-h-60 overflow-auto border rounded p-2 space-y-1 bg-white">
                  {jobs.map(j => (
                    <label key={j.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedJobIds.includes(j.id)} onChange={()=>toggleJob(j.id)} />
                      <span className="truncate">{j.title} {j.location ? `• ${j.location}` : ""}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Marketing Recipients</Label>
                <div className="text-xs text-slate-600 mt-1">
                  {marketingRecipients.length ? marketingRecipients.join(", ") : "No marketing recruiters flagged yet."}
                </div>
              </div>

              <div>
                <Label>Optional: Add Candidates</Label>
                <div className="mt-2 max-h-60 overflow-auto border rounded p-2 space-y-1 bg-white">
                  {candidates.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedCandidateIds.includes(c.id)} onChange={()=>toggleCandidate(c.id)} />
                      <span className="truncate">{c.first_name} {c.last_name} {c.current_title ? `• ${c.current_title}` : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <div className="border-t p-4 flex justify-end gap-2 bg-white">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={sendBlast} disabled={sending || marketingRecipients.length === 0} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Email Blast
          </Button>
        </div>
      </Card>
    </div>
  );
}
