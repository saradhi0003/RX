import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, User, Star, Building2, Calendar } from "lucide-react";
import { Submission, Job, Candidate, Company } from "@/entities/all";
import { personName } from "@/lib/names";

/** Swap this panel for the linked record's own preview. */
const openRecord = (entity, id) =>
  window.dispatchEvent(new CustomEvent("preview:open", { detail: { entity, id } }));

export default function ApplicationPreview({ id }) {
  const [app, setApp] = React.useState(null);
  const [job, setJob] = React.useState(null);
  const [cand, setCand] = React.useState(null);
  const [company, setCompany] = React.useState(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    setApp(null);
    setMissing(false);
    (async () => {
      const a = await Submission.get(id).catch(() => null);
      if (!mounted) return;
      if (!a) { setMissing(true); return; }
      setApp(a);
      // Candidate and job are independent — fetch them together.
      const [c, j] = await Promise.all([
        a.candidate_id ? Candidate.get(a.candidate_id).catch(() => null) : null,
        a.job_id ? Job.get(a.job_id).catch(() => null) : null,
      ]);
      if (!mounted) return;
      setCand(c);
      setJob(j);
      const companyId = j?.company_id || a.company_id;
      if (companyId) {
        const co = await Company.get(companyId).catch(() => null);
        if (mounted) setCompany(co);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (missing) return <div className="text-sm text-slate-600 py-6 text-center">This application could not be loaded.</div>;
  if (!app) return <div className="flex items-center justify-center h-24 text-slate-600"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading application…</div>;

  const submitted = app.submitted_date || app.submitted_at;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          {cand ? (
            <button type="button" onClick={() => openRecord("Candidate", cand.id)} className="font-medium text-purple-700 hover:underline text-left">
              {personName(cand)}
            </button>
          ) : "—"}
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
          {job ? (
            <button type="button" onClick={() => openRecord("Job", job.id)} className="font-medium text-purple-700 hover:underline text-left">
              {job.title}
            </button>
          ) : "—"}
        </div>
        {company && (
          <div className="flex items-center gap-2 text-slate-700">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" /> {company.name}
          </div>
        )}
        {submitted && (
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" /> Submitted {new Date(submitted).toLocaleDateString()}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary" className="capitalize">{(app.status || "").replace(/_/g, " ")}</Badge>
          {typeof app.match_score === "number" && (
            <Badge className="bg-green-100 text-green-800"><Star className="w-3 h-3 mr-1" />{Math.round(app.match_score)}%</Badge>
          )}
        </div>
        {app.notes && <p className="text-slate-700 whitespace-pre-wrap">{app.notes}</p>}
      </CardContent></Card>
    </div>
  );
}
