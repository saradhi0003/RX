/**
 * scheduledFollowupRun
 * POST {} — invoked by pg_cron / Supabase scheduled trigger.
 * Finds all follow-up schedules due today and sends them via Postmark.
 *
 * Auth: requires `x-cron-secret` header matching the CRON_SECRET Edge secret.
 * Without the gate, anyone with the URL could trigger outbound email sends.
 * If CRON_SECRET is unset (local dev), the gate is disabled with a console
 * warning — REQUIRED in production (StockAnalysis pattern).
 */
import { supabase, getSetting, getAISettings } from "../_shared/supabaseClient.ts";
import { invokeLLM } from "../_shared/llm.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { hasCronSecret, getCronSecret } from "../_shared/env.ts";

const FOLLOWUP_SYSTEM = `You are a recruiter writing a brief, friendly follow-up email.
The recipient has not responded to a previous outreach. Keep it short (60-80 words), polite, and add value.
Format:
SUBJECT: Re: <original subject or new short subject>
---
<email body>`;

Deno.serve(withErrorHandling(async (req) => {
  // ── Cron gate ──
  if (hasCronSecret()) {
    if (req.headers.get("x-cron-secret") !== getCronSecret()) {
      return errResponse("Unauthorized: bad or missing x-cron-secret", 401);
    }
  } else {
    console.warn("CRON_SECRET not set — cron gate disabled (dev only; set it in production)");
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Find due follow-ups
  const { data: due } = await supabase
    .from("followup_schedules")
    .select("id, submission_id, recipient_email, thread_message_id, followup_count, max_followups, cadence_days, draft_id")
    .eq("status", "scheduled")
    .lte("next_followup_date", today);

  if (!due?.length) return okResponse({ sent: 0, message: "No follow-ups due" });

  const postmarkToken = await getSetting("postmark_token");
  const fromEmail = await getSetting("from_email");
  const aiSettings = await getAISettings();
  const model = aiSettings?.drafting_model || "gpt-4o";

  let sent = 0;
  const errors: string[] = [];

  for (const schedule of due) {
    try {
      // Fetch the original draft for context
      let originalSubject = "Our recent outreach";
      let recipientName = "";

      if (schedule.draft_id) {
        const { data: origDraft } = await supabase
          .from("email_drafts")
          .select("subject, body, to_email")
          .eq("id", schedule.draft_id)
          .single();

        if (origDraft) originalSubject = origDraft.subject;
      }

      // Draft the follow-up
      const prompt = `Write follow-up #${schedule.followup_count + 1} (of ${schedule.max_followups}) to ${recipientName || schedule.recipient_email}.
Original outreach subject: "${originalSubject}"
This is a gentle nudge — they haven't responded yet.`;

      const raw = await invokeLLM(prompt, FOLLOWUP_SYSTEM, model);
      const subjectMatch = raw.match(/^SUBJECT:\s*(.+)/m);
      const subject = subjectMatch ? subjectMatch[1].trim() : `Following up: ${originalSubject}`;
      const bodyStart = raw.indexOf("---");
      const emailBody = bodyStart !== -1 ? raw.slice(bodyStart + 3).trim() : raw;

      // Send via Postmark
      if (postmarkToken && fromEmail) {
        const headers: Array<{ Name: string; Value: string }> = [];
        if (schedule.thread_message_id) {
          headers.push({ Name: "In-Reply-To", Value: schedule.thread_message_id });
          headers.push({ Name: "References", Value: schedule.thread_message_id });
        }

        const pmRes = await fetch("https://api.postmarkapp.com/email", {
          method: "POST",
          headers: {
            "X-Postmark-Server-Token": postmarkToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            From: fromEmail,
            To: schedule.recipient_email,
            Subject: subject,
            TextBody: emailBody,
            MessageStream: "outbound",
            Headers: headers,
          }),
        });

        if (pmRes.ok) {
          const pmJson = await pmRes.json();
          const messageId = pmJson.MessageID || null;

          // Record sent email
          await supabase.from("sent_emails").insert({
            to_email: schedule.recipient_email,
            subject,
            body: emailBody,
            message_id: messageId,
            in_reply_to: schedule.thread_message_id || null,
            thread_id: schedule.thread_message_id || messageId,
            provider: "postmark",
            followup_schedule_id: schedule.id,
            status: "sent",
          });

          // Determine next state
          const newCount = schedule.followup_count + 1;
          const isComplete = newCount >= schedule.max_followups;
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + (schedule.cadence_days || 3));

          await supabase
            .from("followup_schedules")
            .update({
              followup_count: newCount,
              last_outbound_at: new Date().toISOString(),
              next_followup_date: isComplete ? null : nextDate.toISOString().slice(0, 10),
              status: isComplete ? "completed" : "scheduled",
            })
            .eq("id", schedule.id);

          sent++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Schedule ${schedule.id}: ${msg}`);
      await supabase
        .from("followup_schedules")
        .update({ status: "scheduled" }) // keep scheduled, retry tomorrow
        .eq("id", schedule.id);
    }
  }

  return okResponse({ sent, total_due: due.length, errors });
}));
