/**
 * Send an approved EmailDraft via Postmark (or log a TODO for Gmail/Zoho).
 * Creates a SentEmail record and optionally creates a FollowupSchedule.
 *
 * Input: { draft_id: string }
 *
 * Env vars required:
 *   POSTMARK_SERVER_TOKEN   — transactional send token
 *   POSTMARK_FROM_EMAIL     — verified from address (e.g. recruiter@yourcompany.com)
 *   POSTMARK_FROM_NAME      — display name (optional)
 *   INBOUND_DOMAIN          — domain for Message-ID generation (e.g. inbound.recruiterx.app)
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const POSTMARK_SERVER_TOKEN = Deno.env.get("POSTMARK_SERVER_TOKEN") || "";
const POSTMARK_FROM_EMAIL = Deno.env.get("POSTMARK_FROM_EMAIL") || "noreply@recruiterx.app";
const POSTMARK_FROM_NAME = Deno.env.get("POSTMARK_FROM_NAME") || "Recruiter X";
const INBOUND_DOMAIN = Deno.env.get("INBOUND_DOMAIN") || "recruiterx.app";

async function sendViaPostmark(params: {
  to: string;
  cc?: string[];
  subject: string;
  textBody: string;
  messageId: string;
  inReplyTo?: string;
}): Promise<{ postmarkMessageId: string }> {
  if (!POSTMARK_SERVER_TOKEN) throw new Error("POSTMARK_SERVER_TOKEN is not configured");

  const headers: Array<{ Name: string; Value: string }> = [
    { Name: "Message-ID", Value: params.messageId },
  ];
  if (params.inReplyTo) {
    headers.push({ Name: "In-Reply-To", Value: params.inReplyTo });
    headers.push({ Name: "References", Value: params.inReplyTo });
  }

  const payload: Record<string, unknown> = {
    From: `${POSTMARK_FROM_NAME} <${POSTMARK_FROM_EMAIL}>`,
    To: params.to,
    Subject: params.subject,
    TextBody: params.textBody,
    HtmlBody: params.textBody.replace(/\n/g, "<br>"),
    MessageStream: "outbound",
    Headers: headers,
  };

  if (params.cc && params.cc.length > 0) {
    payload.Cc = params.cc.join(", ");
  }

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.Message || `Postmark send failed (${res.status})`);
  }

  const data = await res.json() as any;
  return { postmarkMessageId: data.MessageID };
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { draft_id } = body;
    if (!draft_id) return Response.json({ error: "draft_id is required" }, { status: 400 });

    // Load and validate draft
    const drafts = await base44.entities.EmailDraft.list("", 1);
    const draft = drafts.find((d: any) => d.id === draft_id);
    if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
    if (draft.status !== "approved") {
      return Response.json({ error: `Draft status is '${draft.status}', must be 'approved' to send` }, { status: 422 });
    }

    // Load settings to determine send method
    let settings: any = {};
    try {
      const settingsList = await base44.entities.AIRecruiterSettings.list("", 1);
      settings = settingsList[0] || {};
    } catch { /* use defaults */ }

    // Generate a unique Message-ID for threading
    const messageId = `<${draft_id}.${Date.now()}@${INBOUND_DOMAIN}>`;

    // Look up In-Reply-To from prior follow-up thread
    let inReplyTo: string | undefined;
    let threadId: string | undefined;
    if (draft.followup_schedule_id) {
      try {
        const schedules = await base44.entities.FollowupSchedule.list("", 200);
        const schedule = schedules.find((s: any) => s.id === draft.followup_schedule_id);
        if (schedule?.thread_message_id) {
          inReplyTo = schedule.thread_message_id;
          threadId = schedule.thread_message_id; // use first message ID as thread anchor
        }
      } catch { /* non-critical */ }
    }

    const subject = inReplyTo && !draft.subject.startsWith("Re:")
      ? `Re: ${draft.subject}`
      : draft.subject;

    let providerMessageId = "";
    let sendError: string | null = null;

    if (settings.gmail_draft_enabled) {
      // TODO: Implement Gmail API sending (requires OAuth)
      console.info("sendApprovedDraft: Gmail sending not yet implemented — falling through to Postmark");
    }

    if (settings.zoho_sync_enabled) {
      // TODO: Implement Zoho Mail sending
      console.info("sendApprovedDraft: Zoho sending not yet implemented — falling through to Postmark");
    }

    // Default: send via Postmark
    try {
      const ccList = draft.cc ? (Array.isArray(draft.cc) ? draft.cc : [draft.cc]) : [];
      const result = await sendViaPostmark({
        to: draft.to_email,
        cc: ccList,
        subject,
        textBody: draft.body,
        messageId,
        inReplyTo,
      });
      providerMessageId = result.postmarkMessageId;
    } catch (err) {
      sendError = (err as Error).message;
    }

    if (sendError) {
      await base44.entities.EmailDraft.update(draft_id, {
        status: "send_failed",
        send_failed_reason: sendError,
      });
      await base44.entities.AuditLog.create({
        user_email: user.email,
        action: "email_send_failed",
        meta: { draft_id, error: sendError },
      });
      return Response.json({ error: sendError, draft_id }, { status: 500 });
    }

    const sentAt = new Date().toISOString();

    // Create SentEmail record
    const sentEmail = await base44.entities.SentEmail.create({
      draft_id,
      to_email: draft.to_email,
      cc: draft.cc ? (Array.isArray(draft.cc) ? draft.cc : [draft.cc]) : [],
      subject,
      body: draft.body,
      message_id: messageId,
      in_reply_to: inReplyTo || null,
      thread_id: threadId || messageId,
      provider: "postmark",
      provider_message_id: providerMessageId,
      status: "sent",
      sent_at: sentAt,
      related_entity_type: draft.candidate_ids?.length > 0 ? "Candidate" : "Job",
      related_entity_id: draft.job_id,
      followup_schedule_id: draft.followup_schedule_id || null,
    });

    // Update draft status
    await base44.entities.EmailDraft.update(draft_id, {
      status: "sent",
      external_draft_id: providerMessageId,
    });

    // If this was a follow-up, update the schedule
    if (draft.followup_schedule_id) {
      try {
        const schedules = await base44.entities.FollowupSchedule.list("", 200);
        const schedule = schedules.find((s: any) => s.id === draft.followup_schedule_id);
        if (schedule) {
          const newCount = (schedule.followup_count || 0) + 1;
          const cadence = schedule.cadence_days || settings.default_followup_cadence || 3;
          const nextDate = new Date(Date.now() + cadence * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const maxFollowups = schedule.max_followups || settings.max_followups || 3;
          const newStatus = newCount >= maxFollowups ? "completed" : "scheduled";

          await base44.entities.FollowupSchedule.update(draft.followup_schedule_id, {
            followup_count: newCount,
            last_outbound_at: sentAt,
            next_followup_date: newStatus === "scheduled" ? nextDate : null,
            status: newStatus,
            draft_id: null,
          });
        }
      } catch (err) {
        console.warn("sendApprovedDraft: Follow-up schedule update failed:", (err as Error).message);
      }
    } else if (draft.draft_type === "client_submission" && settings.auto_followup_enabled !== false) {
      // Auto-create a follow-up schedule for new client submission emails
      try {
        const cadence = settings.default_followup_cadence || 3;
        const maxFollowups = settings.max_followups || 3;
        const nextDate = new Date(Date.now() + cadence * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Try to find the associated submission
        let submissionId: string | null = null;
        if (draft.candidate_ids?.length > 0 && draft.job_id) {
          try {
            const submissions = await base44.entities.Application.list("", 200);
            const match = submissions.find((s: any) =>
              s.job_id === draft.job_id && draft.candidate_ids.includes(s.candidate_id)
            );
            submissionId = match?.id || null;
          } catch { /* non-critical */ }
        }

        if (submissionId) {
          await base44.entities.FollowupSchedule.create({
            submission_id: submissionId,
            recipient_email: draft.to_email,
            thread_message_id: messageId,
            next_followup_date: nextDate,
            followup_count: 0,
            last_outbound_at: sentAt,
            status: "scheduled",
            cadence_days: cadence,
            max_followups: maxFollowups,
          });
        }
      } catch (err) {
        console.warn("sendApprovedDraft: FollowupSchedule creation failed:", (err as Error).message);
      }
    }

    // Log activity
    if (draft.run_id) {
      await base44.entities.RecruiterActivity.create({
        run_id: draft.run_id,
        entity_type: "email",
        entity_id: sentEmail.id,
        activity_type: "manual_action",
        title: `Email sent: ${subject}`,
        description: `Sent via Postmark to ${draft.to_email}`,
        metadata: { draft_id, sent_email_id: sentEmail.id, postmark_id: providerMessageId },
      });
    }

    await base44.entities.AuditLog.create({
      user_email: user.email,
      action: "email_sent",
      meta: { draft_id, sent_email_id: sentEmail.id, to: draft.to_email },
    });

    return Response.json({
      success: true,
      sent_email_id: sentEmail.id,
      message_id: messageId,
      draft_id,
    });

  } catch (error) {
    console.error("sendApprovedDraft error:", (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
