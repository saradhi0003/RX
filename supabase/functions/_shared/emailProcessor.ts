// @ts-nocheck   — Deno-runtime module; imports llm.ts which uses npm: specifiers.
/**
 * emailProcessor.ts — the single intake path for every inbound email.
 *
 * Both entry points funnel here:
 *   - inboundEmailWebhook   (Postmark inbound stream)
 *   - pollEmailInboxes      (Gmail / Zoho OAuth polling)
 *
 * Flow: classify → persist classification → route:
 *   reply              → stop the follow-up sequence (thread match)
 *   job / resume       → parse + create record when confidence ≥ threshold,
 *                        else an approval_items row for human review
 *   spam / unknown     → ignored
 *
 * Never throws: a failed email is marked failed with the error message so the
 * poller can move on to the next account.
 *
 * `failed` and `ignored` mean different things and the difference matters:
 * `ignored` is terminal (line ~60 refuses to reprocess it), so it is only ever
 * used for a decision the classifier actually reached. Anything that went wrong
 * — LLM down, cost ceiling hit — is `failed`, which stays reprocessable.
 */
import { supabase, getAISettings } from "./supabaseClient.ts";
import { classifyMessage } from "./classifier.ts";
import { checkDailyCeiling } from "./llm.ts";
import { parseJobText } from "./parseJob.ts";
import { parseResumeText, findCandidateByEmail } from "./parseCandidate.ts";
import { DEFAULT_WORKSPACE_ID } from "./auth.ts";
import {
  shouldAutoCreate,
  htmlToText,
  messageIdCandidates,
  normalizeSubject,
  isReplySubject,
} from "./emailNormalizers.ts";

export interface ProcessResult {
  status: "processed" | "ignored" | "failed" | "skipped";
  classification?: string;
  confidence?: number;
  entityType?: "job" | "candidate";
  entityId?: string;
  approvalItemId?: string;
  stoppedFollowup?: boolean;
  error?: string;
}

/**
 * Find the outreach this email is replying to.
 *
 * Primary match is the `In-Reply-To` header, compared against every form the id
 * might have been stored in (see `messageIdCandidates`). The subject fallback
 * exists because Zoho's list payload carries no threading headers at all, so
 * without it stop-on-reply is dead for every Zoho mailbox.
 */
async function findRepliedSend(email) {
  const ids = messageIdCandidates(email.in_reply_to || "");
  if (ids.length) {
    const { data } = await supabase
      .from("sent_emails")
      .select("id, followup_schedule_id")
      .in("message_id", ids)
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  if (isReplySubject(email.subject) && email.from_email) {
    const { data } = await supabase
      .from("sent_emails")
      .select("id, followup_schedule_id, subject")
      .eq("to_email", email.from_email)
      .order("sent_at", { ascending: false })
      .limit(10);
    const base = normalizeSubject(email.subject);
    return (data || []).find((s) => normalizeSubject(s.subject) === base) || null;
  }

  return null;
}

export async function processInboundEmail(
  emailId: string,
  opts: { extraText?: string } = {},
): Promise<ProcessResult> {
  const { data: email } = await supabase
    .from("inbound_emails")
    .select(
      "id, workspace_id, subject, body_text, body_html, in_reply_to, from_email, processing_status",
    )
    .eq("id", emailId)
    .maybeSingle();

  if (!email) return { status: "failed", error: "inbound_emails row not found" };
  if (email.processing_status === "processed" || email.processing_status === "ignored") {
    return { status: "skipped" };
  }

  const workspaceId = email.workspace_id || DEFAULT_WORKSPACE_ID;

  const markFailed = async (message: string): Promise<ProcessResult> => {
    await supabase
      .from("inbound_emails")
      .update({ processing_status: "failed", error_message: message })
      .eq("id", emailId);
    return { status: "failed", error: message };
  };

  try {
    // Two LLM calls per email on a path reachable from a public webhook, so it
    // needs the same spend guard as every other entry point.
    const ceiling = await checkDailyCeiling();
    if (!ceiling.ok) {
      return await markFailed(
        `LLM daily cost ceiling reached ($${ceiling.spent.toFixed(2)} of $${ceiling.ceiling}) — ` +
          "reprocess this email after it resets (UTC) or raise LLM_DAILY_COST_CEILING_USD.",
      );
    }

    const aiSettings = await getAISettings();
    const model = aiSettings?.parsing_model || null;

    const bodyText = email.body_text || htmlToText(email.body_html || "");
    const attachmentText = String(opts.extraText || "").trim();
    const classifyInput = `Subject: ${email.subject || ""}\n\n${bodyText}\n\n${attachmentText}`;

    // ── Reply to a tracked outreach → stop the follow-up sequence ──
    let stoppedFollowup = false;
    const origSent = await findRepliedSend(email);
    if (origSent?.followup_schedule_id) {
      await supabase
        .from("followup_schedules")
        .update({
          status: "stopped",
          last_inbound_reply_at: new Date().toISOString(),
          stop_reason: "candidate_replied",
        })
        .eq("id", origSent.followup_schedule_id);
      stoppedFollowup = true;
    }

    // ── Classify with the local-first parsing model ──
    const { classification, confidence, failed } = await classifyMessage(classifyInput, model);
    if (failed) {
      // Deliberately not 'ignored': that is terminal, and an outage would
      // silently swallow a mailbox's whole intake with no way to replay it.
      return await markFailed("Classifier unavailable — reprocess this email once the LLM is reachable.");
    }

    const baseUpdate: Record<string, unknown> = {
      classification,
      classification_confidence: confidence,
      processed_at: new Date().toISOString(),
    };

    const parseInput = `From: ${email.from_email}\nSubject: ${email.subject || ""}\n\n${bodyText}\n\n${attachmentText}`;

    /** Parse as a resume, updating the sender's existing record when there is one. */
    const captureCandidate = async () => {
      const parseResult = await parseResumeText(parseInput, model, {
        candidateId: await findCandidateByEmail(email.from_email, workspaceId),
        source: "email",
        workspaceId,
      });
      await supabase
        .from("inbound_emails")
        .update({
          ...baseUpdate,
          processing_status: "processed",
          resulting_entity_type: "candidate",
          resulting_entity_id: parseResult.candidateId,
        })
        .eq("id", emailId);
      return parseResult.candidateId;
    };

    // ── Route ──
    if (classification === "reply" || stoppedFollowup) {
      // A reply that carries a CV is still a resume — returning here on the
      // strength of the "reply" label alone throws the attachment away.
      if (attachmentText) {
        const candidateId = await captureCandidate();
        return {
          status: "processed",
          classification,
          confidence,
          stoppedFollowup,
          entityType: "candidate",
          entityId: candidateId,
        };
      }

      await supabase
        .from("inbound_emails")
        .update({ ...baseUpdate, processing_status: "processed" })
        .eq("id", emailId);
      return { status: "processed", classification, confidence, stoppedFollowup };
    }

    if (shouldAutoCreate(classification, confidence)) {
      if (classification === "job") {
        const { jobId } = await parseJobText(parseInput, model, {
          source: "email",
          workspaceId,
        });
        await supabase
          .from("inbound_emails")
          .update({
            ...baseUpdate,
            processing_status: "processed",
            resulting_entity_type: "job",
            resulting_entity_id: jobId,
          })
          .eq("id", emailId);
        return { status: "processed", classification, confidence, entityType: "job", entityId: jobId };
      }

      const candidateId = await captureCandidate();
      return {
        status: "processed",
        classification,
        confidence,
        entityType: "candidate",
        entityId: candidateId,
      };
    }

    // ── Plausible but uncertain → human review ──
    if (classification === "job" || classification === "resume") {
      const { data: item } = await supabase
        .from("approval_items")
        .insert({
          workspace_id: workspaceId,
          type: "email_intake",
          risk_tier: "low",
          title: `Review inbound email: ${email.subject || "(no subject)"} — looks like a ${classification}`,
          ai_confidence: confidence,
          action_payload: {
            inbound_email_id: emailId,
            classification,
            from_email: email.from_email,
          },
          diff_summary: `Classifier saw a ${classification} at ${(confidence * 100).toFixed(0)}% confidence — below the auto-create threshold.`,
          source_id: emailId,
          source_type: "inbound_email",
        })
        .select("id")
        .single();
      await supabase
        .from("inbound_emails")
        .update({ ...baseUpdate, processing_status: "processed" })
        .eq("id", emailId);
      return {
        status: "processed",
        classification,
        confidence,
        approvalItemId: item?.id,
      };
    }

    // spam / unknown — a decision the classifier actually reached, so terminal.
    await supabase
      .from("inbound_emails")
      .update({ ...baseUpdate, processing_status: "ignored" })
      .eq("id", emailId);
    return { status: "ignored", classification, confidence };
  } catch (e) {
    return await markFailed(e instanceof Error ? e.message : String(e));
  }
}
