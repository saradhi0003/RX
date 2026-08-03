/**
 * Called by the WhatsApp bot service when a phone number sends REGISTER <code>.
 * Validates the code, marks it used, creates a ChannelConnection, returns workspace_id.
 * Auth: CHANNEL_BOT_SECRET bearer token (same pattern as channelMessageWebhook).
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CHANNEL_BOT_SECRET = Deno.env.get("CHANNEL_BOT_SECRET") || "";

Deno.serve(async (req: Request) => {
  // Verify bot secret
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (CHANNEL_BOT_SECRET && token !== CHANNEL_BOT_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { code: string; phone_number?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code, phone_number } = payload;
  if (!code) return Response.json({ error: "code is required" }, { status: 400 });

  try {
    const base44 = createClientFromRequest(req);

    // Find matching registration
    const registrations = await base44.entities.WhatsAppRegistration.filter(
      { code: code.toUpperCase() },
      "-created_date",
      10
    );

    const now = new Date();
    const reg = registrations.find((r: any) => {
      if (r.used_at) return false; // already consumed
      const expiry = new Date(r.expires_at);
      return expiry > now; // not expired
    });

    if (!reg) {
      return Response.json({ valid: false, error: "Code not found, already used, or expired" });
    }

    // Create ChannelConnection for this WhatsApp number
    let connection: any = null;
    try {
      connection = await base44.entities.ChannelConnection.create({
        workspace_id: reg.workspace_id,
        channel_type: "whatsapp",
        channel_name: phone_number ? `WhatsApp ${phone_number}` : `WhatsApp (code: ${code})`,
        external_id: phone_number || code,
        is_active: true,
        default_classification: "auto",
      });
    } catch (err) {
      console.error("validateWhatsappRegistrationCode: Failed to create ChannelConnection:", err);
      return Response.json({ error: "Failed to create channel connection" }, { status: 500 });
    }

    // Mark code as used
    await base44.entities.WhatsAppRegistration.update(reg.id, {
      used_at: now.toISOString(),
      registered_phone: phone_number || "",
      channel_connection_id: connection.id,
    }).catch((e: Error) => console.warn("Failed to mark code used:", e.message));

    return Response.json({
      valid: true,
      workspace_id: reg.workspace_id,
      channel_connection_id: connection.id,
    });
  } catch (err) {
    const error = err as Error;
    console.error("validateWhatsappRegistrationCode error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
