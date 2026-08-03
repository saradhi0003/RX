/**
 * Scheduled follow-up runner — invoked by an external cron (Vercel Cron or Upstash QStash).
 * Finds all due FollowupSchedule records and generates draft emails for approval.
 *
 * Auth: Bearer CRON_SECRET in Authorization header.
 *
 * Cron setup options:
 *   Option A — Vercel Cron: add to vercel.json:
 *     { "crons": [{ "path": "/api/scheduledFollowupRun", "schedule": "0 9 * * *" }] }
 *   Option B — Upstash QStash: send a POST daily at 9 AM to this function URL.
 *
 * Env vars:
 *   CRON_SECRET — shared secret for cron auth
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

Deno.serve(async (req: Request) => {
  // Auth: only allow cron runner
  const authHeader = req.headers.get("Authorization") || "";
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let base44: any;
  try {
    base44 = createClientFromRequest(req);
  } catch (err) {
    return Response.json({ error: "Could not create Base44 client" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];
  let processed = 0, drafted = 0, skipped = 0, failed = 0;

  // Load settings
  let settings: any = {};
  try {
    const settingsList = await base44.entities.AIRecruiterSettings.list("", 1);
    settings = settingsList[0] || {};
  } catch { /* use defaults */ }

  if (settings.auto_followup_enabled === false) {
    return Response.json({ skipped: true, reason: "auto_followup_disabled" });
  }

  // Load all scheduled follow-ups that are due today or overdue
  let schedules: any[] = [];
  try {
    const all = await base44.entities.FollowupSchedule.list("", 500);
    schedules = all.filter((s: any) =>
      s.status === "scheduled" &&
      s.next_followup_date <= today &&
      s.followup_count < (s.max_followups || 3)
    );
  } catch (err) {
    console.error("scheduledFollowupRun: Could not load schedules:", (err as Error).message);
    return Response.json({ error: "Could not load follow-up schedules" }, { status: 500 });
  }

  for (const schedule of schedules) {
    processed++;
    try {
      // Check if candidate already replied since last outbound
      if (
        schedule.last_inbound_reply_at &&
        schedule.last_outbound_at &&
        schedule.last_inbound_reply_at > schedule.last_outbound_at
      ) {
        // They replied — stop following up
        await base44.entities.FollowupSchedule.update(schedule.id, {
          status: "stopped",
          stop_reason: "candidate_replied",
        });
        skipped++;
        continue;
      }

      // Load context for this follow-up
      let job: any = null;
      let candidates: any[] = [];
      let threadContext: string[] = [];

      try {
        // Load submission → job and candidates
        const submissions = await base44.entities.Application.list("", 200);
        const submission = submissions.find((s: any) => s.id === schedule.submission_id);
        if (submission) {
          const jobs = await base44.entities.Job.list("", 200);
          job = jobs.find((j: any) => j.id === submission.job_id);

          const allCandidates = await base44.entities.Candidate.list("", 500);
          candidates = allCandidates.filter((c: any) => c.id === submission.candidate_id);
        }
      } catch { /* non-critical */ }

      // Load prior thread emails for context
      try {
        const sentEmails = await base44.entities.SentEmail.list("-sent_at", 100);
        const thread = sentEmails
          .filter((e: any) => e.thread_id === schedule.thread_message_id)
          .slice(0, 3)
          .map((e: any) => `Subject: ${e.subject}\n${e.body}`);
        threadContext = thread;
      } catch { /* non-critical */ }

      if (!job) {
        console.warn(`scheduledFollowupRun: Could not find job for schedule ${schedule.id}`);
        skipped++;
        continue;
      }

      // Create a follow-up draft
      const draftRes = await (await fetch(req.url.replace("scheduledFollowupRun", "aiRecruiterDraftEmail"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization") || "",
        },
        body: JSON.stringify({
          job_id: job.id,
          candidate_ids: candidates.map((c: any) => c.id),
          draft_type: "followup",
          to_email: schedule.recipient_email,
          followup_schedule_id: schedule.id,
          thread_context: threadContext,
        }),
      })).json() as any;

      if (draftRes.success) {
        drafted++;
      } else if (draftRes.skipped) {
        skipped++;
      } else {
        console.warn(`scheduledFollowupRun: Draft creation failed for schedule ${schedule.id}:`, draftRes.error);
        failed++;
      }

    } catch (err) {
      console.error(`scheduledFollowupRun: Error processing schedule ${schedule.id}:`, (err as Error).message);
      failed++;
    }
  }

  const summary = `Scheduled follow-up run: ${processed} processed, ${drafted} drafted, ${skipped} skipped, ${failed} failed`;
  console.info(summary);

  // Log activity
  try {
    await base44.entities.RecruiterActivity.create({
      entity_type: "system",
      entity_id: "scheduled_followup_run",
      activity_type: "manual_action",
      title: `Follow-up cron: ${drafted} draft(s) ready for review`,
      description: summary,
      metadata: { processed, drafted, skipped, failed, date: today },
    });
  } catch { /* non-critical */ }

  return Response.json({ success: true, processed, drafted, skipped, failed, date: today });
});
