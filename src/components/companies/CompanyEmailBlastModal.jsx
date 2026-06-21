import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MailPlus, Sparkles, X, Send, Users } from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { sendAppEmail } from "@/components/utils/email";

export default function CompanyEmailBlastModal({ open, onClose, companies = [] }) {
  const [selectedCompanyIds, setSelectedCompanyIds] = useState(companies.map(c => c.id));
  const [subject, setSubject] = useState("Introduction & Opportunities");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const recipients = useMemo(() => {
    const chosen = companies.filter(c => selectedCompanyIds.includes(c.id));
    const emails = [];
    chosen.forEach(c => {
      (c.contacts || []).forEach(ct => { if (ct?.email) emails.push({ email: ct.email, name: ct.name || c.name, company: c.name }); });
    });
    // de-duplicate by email
    const map = new Map();
    emails.forEach(r => { if (!map.has(r.email)) map.set(r.email, r); });
    return Array.from(map.values());
  }, [companies, selectedCompanyIds]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleCompany = (id) => {
    setSelectedCompanyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generate = async () => {
    setGenerating(true);
    const chosen = companies.filter(c => selectedCompanyIds.includes(c.id));
    const prompt = `
Write a concise outreach email to client contacts across these companies.
Tone: professional, value-driven, short paragraphs, clear CTA to reply with hiring needs or schedule a call.
Include a short bulleted capability list.

Companies JSON:
${JSON.stringify(chosen.map(c => ({ name: c.name, industry: c.industry, location: c.location })), null, 2)}
`;
    const res = await InvokeLLM({ prompt });
    setBody(typeof res === "string" ? res : JSON.stringify(res, null, 2));
    setGenerating(false);
  };

  const sendBlast = async () => {
    setSending(true);
    for (const r of recipients) {
      await sendAppEmail({ to: r.email, subject, body });
    }
    setSending(false);
    onClose?.();
    alert(`Email sent to ${recipients.length} recipient(s).`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col" onClick={(e)=>e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><MailPlus className="w-5 h-5" /> Company Email Blast</CardTitle>
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
                <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="gap-2">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate with AI
                </Button>
              </div>
              <Textarea className="min-h-[280px]" value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Write your email..." />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Select Connections</Label>
                <Badge variant="secondary" className="flex items-center gap-1"><Users className="w-3 h-3" /> {recipients.length} recipients</Badge>
              </div>
              <div className="max-h-72 overflow-auto border rounded p-2 bg-white space-y-1">
                {companies.map(c => {
                  const count = (c.contacts || []).filter(ct => !!ct.email).length;
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedCompanyIds.includes(c.id)} onChange={()=>toggleCompany(c.id)} />
                      <span className="truncate">{c.name} {count ? `• ${count} contact(s)` : "• 0 contacts"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
        <div className="border-t p-4 flex justify-end gap-2 bg-white">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={sendBlast} disabled={sending || recipients.length === 0} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Blast
          </Button>
        </div>
      </Card>
    </div>
  );
}