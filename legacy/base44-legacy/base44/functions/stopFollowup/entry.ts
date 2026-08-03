/**
 * Stop a follow-up schedule.
 * Input: { followup_schedule_id: string, reason?: string }
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { followup_schedule_id, reason = "manual" } = body;
    if (!followup_schedule_id) return Response.json({ error: "followup_schedule_id is required" }, { status: 400 });

    await base44.entities.FollowupSchedule.update(followup_schedule_id, {
      status: "stopped",
      stop_reason: reason,
    });

    await base44.entities.RecruiterActivity.create({
      entity_type: "submission",
      entity_id: followup_schedule_id,
      activity_type: "manual_action",
      title: "Follow-up stopped",
      description: `Follow-up schedule stopped. Reason: ${reason}`,
      metadata: { followup_schedule_id, reason },
    });

    await base44.entities.AuditLog.create({
      user_email: user.email,
      action: "followup_stopped",
      meta: { followup_schedule_id, reason },
    });

    return Response.json({ success: true, followup_schedule_id, reason });
  } catch (error) {
    console.error("stopFollowup error:", (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
