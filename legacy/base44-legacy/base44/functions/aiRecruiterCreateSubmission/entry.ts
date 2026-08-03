import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { run_id, job_id, candidate_id } = body;

    if (!job_id || !candidate_id) {
      return Response.json({ error: "job_id and candidate_id required" }, { status: 400 });
    }

    // Check if submission/application already exists
    const submissions = await base44.entities.Submission.filter({ job_id, candidate_id }, "", 1);
    if (submissions.length > 0) {
      return Response.json({ error: "Submission already exists for this candidate/job" }, { status: 400 });
    }

    // Create submission
    const submission = await base44.entities.Submission.create({
      candidate_id,
      job_id,
      recruiter_id: user.id || user.email,
      submitted_date: new Date().toISOString(),
      status: "submitted",
    });

    // Update match result if run exists
    if (run_id) {
      const matches = await base44.entities.CandidateMatchResult.filter({ run_id, candidate_id }, "", 1);
      if (matches.length > 0) {
        await base44.entities.CandidateMatchResult.update(matches[0].id, {
          recruiter_action: "submitted",
        });
      }

      // Log activity
      await base44.entities.RecruiterActivity.create({
        run_id,
        entity_type: "submission",
        entity_id: submission.id,
        activity_type: "ai_submission_created",
        title: `Submission created for candidate`,
        description: `Candidate submitted for job via AI Recruiter`,
        metadata: { submission_id: submission.id, candidate_id, job_id },
      });
    }

    return Response.json({
      success: true,
      submission_id: submission.id,
    });
  } catch (error) {
    console.error("aiRecruiterCreateSubmission error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});