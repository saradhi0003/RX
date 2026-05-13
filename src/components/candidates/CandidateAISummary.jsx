import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";

export default function CandidateAISummary({ candidate, applications = [], jobs = [], submissions = [], tasks = [], resumes = [] }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");

  const buildContext = () => {
    const apps = applications.map(a => ({
      id: a.id,
      job_id: a.job_id,
      status: a.status,
      match_score: a.match_score
    }));
    const jobsLite = jobs.map(j => ({
      id: j.id,
      title: j.title,
      company_id: j.company_id,
      required_skills: j.required_skills?.slice(0, 8) || []
    }));
    const subs = submissions.map(s => ({
      id: s.id, status: s.status, follow_up_date: s.follow_up_date
    }));
    const tsks = tasks.map(t => ({
      id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date
    }));
    const res = resumes.map(r => ({
      id: r.id, name: r.name, skills: r.skills?.slice(0, 12) || []
    }));

    return {
      candidate: {
        id: candidate.id,
        name: `${candidate.first_name} ${candidate.last_name}`,
        title: candidate.current_title,
        location: candidate.location,
        experience_years: candidate.experience_years,
        skills: candidate.skills || [],
        work_authorization: candidate.work_authorization,
        status: candidate.status,
      },
      applications: apps,
      jobs: jobsLite,
      submissions: subs,
      tasks: tsks,
      resumes: res
    };
  };

  const generate = async (customQuestion) => {
    setLoading(true);
    try {
      const ctx = buildContext();
      const basePrompt = `
You are an expert recruiting copilot. Summarize the candidate for a recruiter using the provided structured JSON.
Include:
- 3–5 bullet executive summary (title, years exp, location).
- Key hard skills and certifications (grouped).
- Current pipeline highlights (applications with best match_score and statuses).
- Risks and follow-ups (overdue tasks, pending follow-ups).
- Recommended next steps.

Return concise bullet points and short paragraphs (max 180 words).
JSON CONTEXT:
${JSON.stringify(ctx, null, 2)}
      `.trim();

      const prompt = customQuestion
        ? `${basePrompt}\n\nUser question: ${customQuestion}\nAnswer the question using the context and be specific.`
        : basePrompt;

      const resp = await InvokeLLM({ prompt });
      const text = typeof resp === "string" ? resp : JSON.stringify(resp, null, 2);
      setSummary(text);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-generate on first mount
    if (!summary) generate();
     
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          AI Candidate Summary
          {loading && <Badge variant="secondary" className="ml-2">Generating…</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {summary ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{summary}</div>
          ) : (
            <div className="text-sm text-slate-500">No summary yet.</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Ask a question about this candidate (e.g., top matching roles?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button onClick={() => generate(question)} disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => generate()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Regenerate"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}