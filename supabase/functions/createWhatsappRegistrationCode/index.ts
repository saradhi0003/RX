/**
 * createWhatsappRegistrationCode
 * POST { workspace_id: string }
 * Generates a 6-character alphanumeric code that a user texts to the WhatsApp bot
 * to link their number to their workspace.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += chars[b % chars.length];
  return code;
}

Deno.serve(withErrorHandling(async (req) => {
  const body = await req.json();
  const { workspace_id } = body;

  if (!workspace_id) return errResponse("workspace_id is required", 400);

  // Expire old unused codes for this workspace
  await supabase
    .from("whatsapp_registrations")
    .update({ expires_at: new Date().toISOString() })
    .eq("workspace_id", workspace_id)
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  const { data, error } = await supabase
    .from("whatsapp_registrations")
    .insert({ code, workspace_id, expires_at: expiresAt })
    .select("id, code, expires_at")
    .single();

  if (error) return errResponse(`Failed to create code: ${error.message}`, 500);

  return okResponse({
    code: data.code,
    expires_at: data.expires_at,
    instructions: `Text the code "${data.code}" to the WhatsApp bot to link your number.`,
  });
}));
