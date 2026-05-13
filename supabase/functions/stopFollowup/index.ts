/**
 * stopFollowup
 * POST { schedule_id, reason?: string }
 * Manually stops a follow-up sequence.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { schedule_id, reason = "manual_stop" } = body;

  if (!schedule_id) return errResponse("schedule_id is required", 400);

  const { data, error } = await supabase
    .from("followup_schedules")
    .update({ status: "stopped", stop_reason: reason })
    .eq("id", schedule_id)
    .select("id, recipient_email, followup_count")
    .single();

  if (error || !data) return errResponse("Schedule not found or already stopped", 404);

  return okResponse({ stopped: true, schedule_id: data.id, reason });
}));
