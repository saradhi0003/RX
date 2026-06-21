
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Mail, Save, Building2, ExternalLink, Loader2 } from "lucide-react";
import { Company, Job } from "@/entities/all";
import { sendAppEmail } from "@/components/utils/email";
import { User } from "@/entities/User"; // NEW

export default function CompanyDetailsModal({ companyId, onClose, onUpdated }) {
  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [edit, setEdit] = useState(true);
  const [form, setForm] = useState({ name: "", industry: "", website: "", location: "", description: "", status: "prospect" });
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const [createdByUser, setCreatedByUser] = useState(null); // NEW

  useEffect(() => {
    const load = async () => {
      const rec = await Company.get(companyId);
      setCompany(rec);
      setForm({
        name: rec.name || "",
        industry: rec.industry || "",
        website: rec.website || "",
        location: rec.location || "",
        description: rec.description || "",
        status: rec.status || "prospect"
      });
      const js = await Job.filter({ company_id: companyId }, "-created_date");
      setJobs(js);

      // NEW: resolve created_by to full name
      try {
        const users = await User.list();
        const match = (users || []).find(u => u.email === rec.created_by);
        setCreatedByUser(match || null);
      } catch (_) { /* ignore */ }
    };
    if (companyId) load();
  }, [companyId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // NEW: helpers
  const getPrimarySecondaryPhones = (contacts = []) => {
    if (!Array.isArray(contacts) || contacts.length === 0) return { primary: "—", secondary: "—" };
    const primary = contacts.find(c => c.is_primary) || contacts[0];
    const secondary = contacts.find(c => !c.is_primary && c.phone) || contacts[1]; // Find a secondary with a phone if possible
    return {
      primary: primary?.phone || "—",
      secondary: secondary?.phone || "—"
    };
  };

  if (!company) return null;

  const save = async () => {
    await Company.update(company.id, form);
    setEdit(false);
    onUpdated?.();
    const rec = await Company.get(company.id);
    setCompany(rec);
  };

  const openEmail = (recipient) => {
    setEmailData({
      to: recipient || "",
      subject: `Intro from Recruiter X`,
      body: `Hi${recipient ? "" : ""},

We help teams like ${company.name} hire top talent. Happy to share relevant candidates or discuss roles.

Best,
Recruiter X`
    });
    setEmailOpen(true);
  };

  const sendEmail = async () => {
    setSending(true);
    try {
      await sendAppEmail(emailData);
      setEmailOpen(false);
    } finally {
      setSending(false);
    }
  };

  const { primary: primaryPhone, secondary: secondaryPhone } = getPrimarySecondaryPhones(company.contacts);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col relative" onClick={(e)=>e.stopPropagation()}>
        <Button aria-label="Close" variant="ghost" size="icon" onClick={onClose} className="absolute top-2 right-2 text-red-600 hover:text-red-700">
          <X className="w-5 h-5" />
        </Button>
        <CardHeader className="border-b flex items-start justify-between gap-3 pr-12">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> {company.name}
              <Badge className="capitalize">{form.status}</Badge>
            </CardTitle>
            <div className="text-sm text-slate-600 mt-1 flex flex-wrap items-center gap-3">
              {company.location && <span>{company.location}</span>}
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Website
                </a>
              )}
            </div>

            {/* NEW: meta */}
            <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-3">
              <span>Created By: <span className="font-medium text-slate-700">{createdByUser?.full_name || company.created_by || "—"}</span></span>
              <span>Created: {company.created_date ? new Date(company.created_date).toLocaleString() : "—"}</span>
              <span>Updated: {company.updated_date ? new Date(company.updated_date).toLocaleString() : "—"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {edit ? (
              <Button className="gap-2" onClick={save}><Save className="w-4 h-4" /> Save</Button>
            ) : null}
            <Button variant="outline" className="gap-2" onClick={() => openEmail("")}>
              <Mail className="w-4 h-4" /> Email (custom)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">Company</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} disabled={!edit} />
                    </div>
                    <div>
                      <Label>Industry</Label>
                      <Input value={form.industry} onChange={(e)=>setForm({...form, industry: e.target.value})} disabled={!edit} />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input value={form.location} onChange={(e)=>setForm({...form, location: e.target.value})} disabled={!edit} />
                    </div>
                    <div>
                      <Label>Website</Label>
                      <Input value={form.website} onChange={(e)=>setForm({...form, website: e.target.value})} disabled={!edit} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea rows={4} value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} disabled={!edit} />
                    </div>
                    {/* NEW: contact numbers quick view */}
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                      <div><span className="text-slate-500">Primary Phone:</span> {primaryPhone}</div>
                      <div><span className="text-slate-500">Secondary Phone:</span> {secondaryPhone}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-3">Contacts</h4>
                  <div className="space-y-2 text-sm">
                    {(company.contacts || []).length === 0 && <div className="text-slate-500">No contacts.</div>}
                    {(company.contacts || []).map((ct, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium">
                            {ct.name || "—"} {ct.is_primary ? <Badge className="ml-2">Primary</Badge> : null}
                          </div>
                          <div className="text-slate-600">{ct.title || ""}</div>
                          <div className="text-slate-600">{ct.email || ""}</div>
                          {ct.phone && <div className="text-slate-600">{ct.phone}</div>}
                        </div>
                        {ct.email && (
                          <Button size="sm" variant="outline" onClick={()=>openEmail(ct.email)}>Email</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="related">
              <div className="space-y-3">
                <h4 className="font-semibold">Open Jobs ({jobs.length})</h4>
                {jobs.length === 0 ? (
                  <div className="text-sm text-slate-600">No open jobs.</div>
                ) : (
                  <ul className="list-disc pl-6 text-sm">
                    {jobs.map(j => (<li key={j.id}>{j.title} {j.location ? `• ${j.location}` : ""}</li>))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        {emailOpen && (
          <div className="border-t p-4 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div className="md:col-span-2">
                <Label>To</Label>
                <Input value={emailData.to} onChange={(e)=>setEmailData({...emailData, to: e.target.value})} placeholder="recipient@example.com" />
              </div>
              <div className="md:col-span-4">
                <Label>Subject</Label>
                <Input value={emailData.subject} onChange={(e)=>setEmailData({...emailData, subject: e.target.value})} />
              </div>
              <div className="md:col-span-6">
                <Label>Message</Label>
                <Textarea rows={5} value={emailData.body} onChange={(e)=>setEmailData({...emailData, body: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button variant="outline" onClick={()=>setEmailOpen(false)}>Cancel</Button>
              <Button onClick={sendEmail} disabled={sending || !emailData.to} className="gap-2">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Email
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
