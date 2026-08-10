import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, User, Star } from "lucide-react";
import { Submission, Job, Candidate } from "@/entities/all";

export default function ApplicationPreview({ id }) {
  const [app, setApp] = React.useState(null);
  const [job, setJob] = React.useState(null);
  const [cand, setCand] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await Submission.filter({ id }, "-created_date", 1);
      const a = r?.[0] || null;
      if (!mounted) return;
      setApp(a);
      if (a?.job_id) {
        const jr = await Job.filter({ id: a.job_id }, "-created_date", 1).catch(()=>[]);
        if (mounted) setJob(jr?.[0] || null);
      }
      if (a?.candidate_id) {
        const cr = await Candidate.filter({ id: a.candidate_id }, "-created_date", 1).catch(()=>[]);
        if (mounted) setCand(cr?.[0] || null);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (!app) return <div className="flex items-center justify-center h-24 text-slate-600"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading application…</div>;

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-slate-700 text-sm">
          <User className="w-4 h-4 text-slate-400" /> {cand ? `${cand.first_name} ${cand.last_name}` : "—"}
        </div>
        <div className="flex items-center gap-2 text-slate-700 text-sm">
          <Briefcase className="w-4 h-4 text-slate-400" /> {job?.title || "—"}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="secondary" className="capitalize">{app.status}</Badge>
          {typeof app.match_score === "number" && (
            <Badge className="bg-green-100 text-green-800"><Star className="w-3 h-3 mr-1" />{Math.round(app.match_score)}%</Badge>
          )}
        </div>
      </CardContent></Card>
    </div>
  );
}