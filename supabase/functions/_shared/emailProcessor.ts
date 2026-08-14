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
 */
import { supabase, getAISettings } from "./supabaseClient.ts";
import { classifyMessage } from "./classifier.ts";
import { parseJobText } from "./parseJob.ts";
import { parseResumeText, findCandidateByEmail } from "./parseCandidate.ts";
import { DEFAULT_WORKSPACE_ID } from "./auth.ts";
import { shouldAutoCreate, htmlToText } from "./emailNormalizers.ts";

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

  try {
    const aiSettings = await getAISettings();
    const model = aiSettings?.parsing_model || null;

    const bodyText = email.body_text || htmlToText(email.body_html || "");
    const classifyInput = `Subject: ${email.subject || ""}\n\n${bodyText}\n\n${opts.extraText || ""}`;

    // ── Reply to a tracked outreach → stop the follow-up sequence ──
    let stoppedFollowup = false;
    if (email.in_reply_to) {
      const { data: origSent } = await supabase
        .from("sent_emails")
        .select("id, followup_schedule_id")
        .eq("message_id", email.in_reply_to)
        .maybeSingle();
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
    }

    // ── Classify with the local-first parsing model ──
    const { classification, confidence } = await classifyMessage(classifyInput, model);

    const baseUpdate: Record<string, unknown> = {
      classification,
      classification_confidence: confidence,
      processed_at: new Date().toISOString(),
    };

    // ── Route ──
    if (classification === "reply" || (email.in_reply_to && stoppedFollowup)) {
      await supabase
        .from("inbound_emails")
        .update({ ...baseUpdate, processing_status: "processed" })
        .eq("id", emailId);
      return { status: "processed", classification, confidence, stoppedFollowup };
    }

    if (shouldAutoCreate(classification, confidence)) {
      const parseInput = `From: ${email.from_email}\nSubject: ${email.subject || ""}\n\n${bodyText}\n\n${opts.extraText || ""}`;

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

      // resume
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
      return {
        status: "processed",
        classification,
        confidence,
        entityType: "candidate",
        entityId: parseResult.candidateId,
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

    // spam / unknown
    await supabase
      .from("inbound_emails")
      .update({ ...baseUpdate, processing_status: "ignored" })
      .eq("id", emailId);
    return { status: "ignored", classification, confidence };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase
      .from("inbound_emails")
      .update({ processing_status: "failed", error_message: message })
      .eq("id", emailId);
    return { status: "failed", error: message };
  }
}
