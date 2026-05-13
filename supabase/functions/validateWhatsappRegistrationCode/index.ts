/**
 * validateWhatsappRegistrationCode  (verify_jwt = false — called by the WhatsApp bot)
 * POST { code: string, phone: string, channel_type?: string }
 * Validates the registration code texted by a user, creates a channel_connection,
 * and marks the code as used.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { code, phone, channel_type = "whatsapp" } = body;

  if (!code || !phone) return errResponse("code and phone are required", 400);

  // Look up the code
  const { data: reg, error } = await supabase
    .from("whatsapp_registrations")
    .select("id, workspace_id, expires_at, used_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  if (error || !reg) return errResponse("Invalid code", 404);
  if (reg.used_at) return errResponse("Code already used", 409);
  if (new Date(reg.expires_at) < new Date()) return errResponse("Code expired", 410);

  // Create or update the channel_connection for this phone
  const { data: conn, error: connErr } = await supabase
    .from("channel_connections")
    .upsert({
      workspace_id: reg.workspace_id,
      channel_type,
      external_id: phone,
      channel_name: `WhatsApp ${phone}`,
      is_active: true,
    }, { onConflict: "channel_type,external_id" })
    .select("id")
    .single();

  if (connErr) return errResponse(`Failed to create channel connection: ${connErr.message}`, 500);

  // Mark code as used and link the connection
  await supabase
    .from("whatsapp_registrations")
    .update({
      used_at: new Date().toISOString(),
      registered_phone: phone,
      channel_connection_id: conn.id,
    })
    .eq("id", reg.id);

  return okResponse({
    success: true,
    workspace_id: reg.workspace_id,
    channel_connection_id: conn.id,
    message: "WhatsApp number registered successfully. You can now send job descriptions or resumes here.",
  });
}));
