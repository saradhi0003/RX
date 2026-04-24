import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, CheckCircle, Clock } from "lucide-react";
import JobIntakePanel from "./JobIntakePanel";
import CandidateMatchQueue from "./CandidateMatchQueue";
import EmailDraftReview from "./EmailDraftReview";
import RecruiterActivityTimeline from "./RecruiterActivityTimeline";

export default function AIRecruiterDashboard({ user }) {
  const [currentRun, setCurrentRun] = useState(null);
  const [step, setStep] = useState("job"); // job | match | draft | review
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatches, setSelectedMatches] = useState(new Set());
  const [draft, setDraft] = useState(null);

  // Handle job parsing
  const handleJobParsed = async (run) => {
    setCurrentRun(run);
    setSelectedJob(run.job);
    setStep("match");
    setError(null);
  };

  // Handle matching
  const handleMatchCandidates = async (job) => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("aiRecruiterMatchCandidates", {
        job_id: job.id,
        run_id: currentRun?.id,
        max_candidates: 50,
      });

      if (!response.success) {
        setError(response.error || "Failed to match candidates");
        return;
      }

      setMatches(response.matches || []);
      setSelectedMatches(new Set());
      setStep("draft");
    } catch (err) {
      setError(err.message);
      console.error("Matching error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle draft email
  const handleGenerateDraft = async (draftType, tone) => {
    if (selectedMatches.size === 0) {
      setError("Select at least one candidate");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selectedIds = Array.from(selectedMatches);
      const response = await base44.functions.invoke("aiRecruiterDraftEmail", {
        run_id: currentRun?.id,
        job_id: selectedJob.id,
        candidate_ids: selectedIds,
        draft_type: draftType,
        tone,
        channel: "app",
      });

      if (!response.success) {
        setError(response.error || "Failed to generate draft");
        return;
      }

      setDraft(response.draft);
      setStep("review");
    } catch (err) {
      setError(err.message);
      console.error("Draft error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle draft approval
  const handleApproveDraft = async (action) => {
    if (!draft) return;

    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("aiRecruiterApproveDraft", {
        draft_id: draft.id,
        action,
      });

      if (!response.success) {
        setError(response.error || "Failed to approve draft");
        return;
      }

      setDraft({ ...draft, status: response.status });
      if (action === "approve") {
        setError(null); // Clear error on success
      }
    } catch (err) {
      setError(err.message);
      console.error("Approval error:", err);
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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Recruiter Copilot</h1>
          <p className="text-muted-foreground">Find and engage top candidates with AI assistance</p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 bg-red-50 border-red-200 p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">Error</h3>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Workflow Steps */}
        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="job" disabled={loading} className="flex items-center gap-2">
              <span className={step === "job" ? "font-bold" : ""}>1. Job</span>
            </TabsTrigger>
            <TabsTrigger value="match" disabled={!selectedJob || loading} className="flex items-center gap-2">
              <span className={step === "match" ? "font-bold" : ""}>2. Match</span>
            </TabsTrigger>
            <TabsTrigger value="draft" disabled={matches.length === 0 || loading} className="flex items-center gap-2">
              <span className={step === "draft" ? "font-bold" : ""}>3. Draft</span>
            </TabsTrigger>
            <TabsTrigger value="review" disabled={!draft || loading} className="flex items-center gap-2">
              <span className={step === "review" ? "font-bold" : ""}>4. Review</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="job" className="space-y-6">
            <JobIntakePanel onJobParsed={handleJobParsed} loading={loading} currentRun={currentRun} />
            {currentRun && <RecruiterActivityTimeline runId={currentRun.id} />}
          </TabsContent>

          <TabsContent value="match" className="space-y-6">
            {selectedJob && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedJob.title}</h2>
                    <p className="text-muted-foreground">{selectedJob.location} • {selectedJob.employment_type}</p>
                  </div>
                  {matches.length === 0 && (
                    <Button onClick={() => handleMatchCandidates(selectedJob)} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
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
                    <Button onClick={() => handleApproveDraft("approve")} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      Approve Draft
                    </Button>
                    <Button variant="outline" onClick={() => handleApproveDraft("reject")} disabled={loading}>
                      Reject Draft
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="review">
            {draft && draft.status === "approved" && (
              <Card className="bg-green-50 border-green-200 p-6">
                <div className="flex gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-green-900">Draft Approved</h3>
                    <p className="text-sm text-green-800 mt-1">Your email draft is ready. You can now:</p>
                    <ul className="text-sm text-green-800 mt-2 space-y-1 ml-4 list-disc">
                      <li>Copy and send via your preferred email client</li>
                      <li>Create submissions for selected candidates</li>
                      <li>Generate follow-up tasks</li>
                      <li>View activity timeline below</li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}
            {currentRun && <RecruiterActivityTimeline runId={currentRun.id} />}
          </TabsContent>
        </Tabs>

        {/* Reset Button */}
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