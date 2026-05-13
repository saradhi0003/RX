import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import JobIntakePanel from "./JobIntakePanel";
import CandidateMatchQueue from "./CandidateMatchQueue";
import EmailDraftReview from "./EmailDraftReview";
import RecruiterActivityTimeline from "./RecruiterActivityTimeline";

/**
 * Invoke a Supabase Edge Function and return its JSON response.
 * Using a typed helper avoids TS excess-property-check errors on FunctionInvokeOptions.
 * @param {string} name
 * @param {Record<string, any>} payload
 * @returns {Promise<any>}
 */
async function callFn(name, payload) {
  const { data, error } = await supabase.functions.invoke(name, { body: payload });
  if (error) throw error;
  return data;
}

/** @param {{ user: any }} props */
export default function AIRecruiterDashboard({ user }) {
  const [currentRun, setCurrentRun]       = useState(/** @type {any}    */ (null));
  const [step, setStep]                   = useState("job");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(/** @type {string|null} */ (null));
  const [selectedJob, setSelectedJob]     = useState(/** @type {any}    */ (null));
  const [matches, setMatches]             = useState(/** @type {any[]}  */ ([]));
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [draft, setDraft]                 = useState(/** @type {any}    */ (null));

  /** @param {any} run */
  const handleJobParsed = (run) => {
    setCurrentRun(run);
    setSelectedJob(run.job);
    setStep("match");
    setError(null);
  };

  /** @param {any} job */
  const handleMatchCandidates = async (job) => {
    setLoading(true);
    setError(null);
    try {
      const data = await callFn("aiRecruiterMatchCandidates", {
        job_id: job.id,
        run_id: currentRun?.id ?? null,
        max_candidates: 50,
      });
      setMatches(data.matches || []);
      setSelectedMatches(new Set());
      setStep("draft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to match candidates");
    } finally {
      setLoading(false);
    }
  };

  /**
   * @param {string} draftType
   * @param {string} [tone]
   */
  const handleGenerateDraft = async (draftType, tone) => {
    if (selectedMatches.size === 0) { setError("Select at least one candidate"); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await callFn("aiRecruiterDraftEmail", {
        run_id: currentRun?.id ?? null,
        job_id: selectedJob.id,
        candidate_ids: Array.from(selectedMatches),
        draft_type: draftType,
        tone: tone ?? "professional",
      });
      setDraft({ id: data.draft_ids?.[0], status: "draft", count: data.count });
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setLoading(false);
    }
  };

  /** @param {"approve"|"reject"} action */
  const handleApproveDraft = async (action) => {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      if (action === "reject") {
        await supabase.from("email_drafts").update({ status: "rejected" }).eq("id", draft.id);
        setDraft({ ...draft, status: "rejected" });
      } else {
        const data = await callFn("aiRecruiterApproveDraft", {
          draft_id: draft.id,
          approved_by: user?.email || "recruiter",
        });
        setDraft({ ...draft, status: data.sent ? "sent" : "approved" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentRun(null);
    setStep("job");
    setSelectedJob(null);
    setMatches([]);
    setSelectedMatches(new Set());
    setDraft(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">AI Recruiter Copilot</h1>
          <p className="text-muted-foreground text-sm">Find and engage top candidates with AI assistance</p>
        </div>

        {error && (
          <Card className="mb-6 bg-red-50 border-red-200 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 text-sm">Error</p>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </Card>
        )}

        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="job" disabled={loading}>1. Job</TabsTrigger>
            <TabsTrigger value="match" disabled={!selectedJob || loading}>2. Match</TabsTrigger>
            <TabsTrigger value="draft" disabled={matches.length === 0 || loading}>3. Draft</TabsTrigger>
            <TabsTrigger value="review" disabled={!draft || loading}>4. Review</TabsTrigger>
          </TabsList>

          <TabsContent value="job" className="space-y-6">
            <JobIntakePanel onJobParsed={handleJobParsed} currentRun={currentRun} />
            {currentRun?.id && <RecruiterActivityTimeline runId={currentRun.id} />}
          </TabsContent>

          <TabsContent value="match" className="space-y-6">
            {selectedJob && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                    <p className="text-muted-foreground text-sm">
                      {selectedJob.location} • {selectedJob.job_type}
                    </p>
                  </div>
                  {matches.length === 0 && (
                    <Button onClick={() => handleMatchCandidates(selectedJob)} disabled={loading}>
                      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Find Candidates
                    </Button>
                  )}
                </div>

                {matches.length > 0 && (
                  <>
                    <CandidateMatchQueue
                      matches={matches}
                      selectedMatches={selectedMatches}
                      onSelectionChange={setSelectedMatches}
                      loading={loading}
                    />
                    <div className="flex gap-3">
                      <Button onClick={() => setStep("draft")} disabled={selectedMatches.size === 0}>
                        Continue with {selectedMatches.size} candidate{selectedMatches.size !== 1 ? "s" : ""}
                      </Button>
                      <Button variant="outline" onClick={() => setMatches([])}>
                        Refine Search
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="draft" className="space-y-6">
            {selectedJob && selectedMatches.size > 0 && (
              <>
                <EmailDraftReview
                  job={selectedJob}
                  selectedCount={selectedMatches.size}
                  draft={draft}
                  loading={loading}
                  onGenerateDraft={handleGenerateDraft}
                />
                {draft && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApproveDraft("approve")}
                      disabled={loading || draft.status === "approved" || draft.status === "sent"}
                    >
                      {loading
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve & Send
                    </Button>
                    <Button variant="outline" onClick={() => handleApproveDraft("reject")} disabled={loading}>
                      Reject
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="review">
            {draft && (draft.status === "approved" || draft.status === "sent") && (
              <Card className="bg-green-50 border-green-200 p-6 mb-6">
                <div className="flex gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-900">
                      {draft.status === "sent" ? "Email Sent" : "Draft Approved"}
                    </p>
                    <p className="text-sm text-green-800 mt-1">
                      {(draft.count ?? 1) > 1
                        ? `${draft.count} outreach emails have been processed.`
                        : "Your outreach email has been processed."}
                    </p>
                  </div>
                </div>
              </Card>
            )}
            {currentRun?.id && <RecruiterActivityTimeline runId={currentRun.id} />}
          </TabsContent>
        </Tabs>

        {currentRun && (
          <div className="mt-8 pt-6 border-t flex justify-end">
            <Button variant="outline" onClick={handleReset}>
              Start New Run
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
