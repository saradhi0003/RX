import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { draft_id, action, edited_subject = null, edited_body = null } = body;

    if (!draft_id || !["approve", "reject"].includes(action)) {
      return Response.json({ error: "draft_id and valid action required" }, { status: 400 });
    }

    // Load draft
    const drafts = await base44.entities.EmailDraft.list("", 1);
    const draft = drafts.find(d => d.id === draft_id);
    if (!draft) {
      return Response.json({ error: "Draft not found" }, { status: 404 });
    }

    // Update draft
    const updateData = { status: action === "approve" ? "approved" : "rejected" };
    if (action === "approve") {
      updateData.approved_by = user.email;
      updateData.approved_at = new Date().toISOString();
    }
    if (edited_subject) updateData.subject = edited_subject;
    if (edited_body) updateData.body = edited_body;

    const updated = await base44.entities.EmailDraft.update(draft_id, updateData);

    // If approved and send_immediately_on_approval is enabled, trigger send
    if (action === "approve") {
      try {
        let settings: any = {};
        const settingsList = await base44.entities.AIRecruiterSettings.list("", 1).catch(() => []);
        settings = settingsList[0] || {};

        if (settings.send_immediately_on_approval !== false) {
          // Fire-and-forget: don't await so the approval response returns quickly
          fetch(req.url.replace("aiRecruiterApproveDraft", "sendApprovedDraft"), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": req.headers.get("Authorization") || "" },
            body: JSON.stringify({ draft_id }),
          }).catch(err => console.warn("sendApprovedDraft call failed:", err.message));
        }
      } catch (err) {
        console.warn("aiRecruiterApproveDraft: Could not trigger send:", (err as Error).message);
      }
    }

    // Log activity
    if (draft.run_id) {
      const activityType = action === "approve" ? "ai_email_draft_approved" : "ai_email_draft_rejected";
      await base44.entities.RecruiterActivity.create({
        run_id: draft.run_id,
        entity_type: "email",
        entity_id: draft_id,
        activity_type: activityType,
        title: `Email draft ${action === "approve" ? "approved" : "rejected"}`,
        description: `Recruiter ${action === "approve" ? "approved" : "rejected"} ${draft.draft_type} email draft`,
        metadata: { draft_id, action },
      });
    }

    // Also log to audit
    await base44.entities.AuditLog.create({
      user_email: user.email,
      action: `ai_email_draft_${action}`,
      meta: { draft_id, draft_type: draft.draft_type },
    });

    return Response.json({
      success: true,
      draft_id,
      status: updated.status,
    });
  } catch (error) {
    console.error("aiRecruiterApproveDraft error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});