import React from "react";
import PublicNav from "@/components/site/PublicNav";
import PublicFooter from "@/components/site/PublicFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Job, Candidate, Submission } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";

function ApplyModal({ job, onClose, onApplied }) {
  const [form, setForm] = React.useState({ first_name: "", last_name: "", email: "", phone: "", notes: "" });
  const [resumeUrl, setResumeUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Store the storage path, not the signed URL — the latter expires in an hour.
    const { path } = await UploadFile({ file: f });
    setResumeUrl(path);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const cand = await Candidate.create({
      ...form,
      resume_url: resumeUrl || undefined,
      status: "active",
      source: "website"
    });
    // The candidate→job pipeline lives in `submissions` (migration 026) —
    // `applications` used to be a second, disconnected table that the
    // Dashboard and several other pages never actually read.
    await Submission.create({
      candidate_id: cand.id,
      job_id: job.id,
      company_id: job.company_id || undefined,
      status: "submitted",
      notes: form.notes || ""
    });
    setBusy(false);
    onApplied();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Apply: {job.title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">Close</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="First name" value={form.first_name} onChange={(e)=>setForm({...form, first_name:e.target.value})} required />
            <Input placeholder="Last name" value={form.last_name} onChange={(e)=>setForm({...form, last_name:e.target.value})} required />
          </div>
          <Input type="email" placeholder="Email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} required />
          <Input placeholder="Phone (optional)" value={form.phone} onChange={(e)=>setForm({...form, phone:e.target.value})} />
          <Textarea rows={3} placeholder="Notes (optional)" value={form.notes} onChange={(e)=>setForm({...form, notes:e.target.value})} />
          <div className="flex items-center justify-between">
            <input type="file" accept=".pdf,.doc,.docx" onChange={upload} />
            <Button type="submit" disabled={busy} className="bg-blue-600 hover:bg-blue-700">{busy ? "Submitting…" : "Submit Application"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Careers() {
  const [jobs, setJobs] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [applied, setApplied] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      const open = await Job.filter({ status: "open" }, "-created_date", 100).catch(()=>[]);
      setJobs(open);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PublicNav />
      <section className="pt-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">Careers</h1>
          <p className="mt-4 text-slate-600 text-lg">Join us and help modern teams hire better.</p>
        </div>

        <div className="mx-auto max-w-5xl px-6 mt-10 grid gap-4">
          {applied && <div className="p-3 rounded-md bg-green-50 text-green-700">Thanks! Your application has been submitted.</div>}
          {jobs.map(job => (
            <Card key={job.id} className="hover:shadow-md transition">
              <CardHeader><CardTitle>{job.title}</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-slate-600">{job.location || "Remote / Flexible"}</div>
                <Button onClick={() => setSelected(job)} className="bg-blue-600 hover:bg-blue-700">Apply</Button>
              </CardContent>
            </Card>
          ))}
          {!jobs.length && <div className="text-slate-600 text-center py-10">No openings right now. Check back soon.</div>}
        </div>
      </section>
      <PublicFooter />
      {selected && (
        <ApplyModal
          job={selected}
          onClose={() => setSelected(null)}
          onApplied={() => { setSelected(null); setApplied(true); }}
        />
      )}
    </div>
  );
}