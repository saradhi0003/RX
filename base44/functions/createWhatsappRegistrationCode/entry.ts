import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for legibility
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Generate a unique code (retry on collision)
    let code = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      try {
        // Check for existing unused, unexpired code with same value
        const existing = await base44.entities.WhatsAppRegistration.filter(
          { code, used_at: null },
          "",
          1
        ).catch(() => []);
        if (!existing.length) break;
      } catch { break; }
    }

    const registration = await base44.entities.WhatsAppRegistration.create({
      code,
      workspace_id: user.workspace_id || user.id,
      expires_at: expiresAt,
    });

    return Response.json({
      code: registration.code,
      expires_at: expiresAt,
      instructions: `Send this message from WhatsApp to your Recruiter X WhatsApp number: REGISTER ${code}`,
    });
  } catch (err) {
    const error = err as Error;
    console.error("createWhatsappRegistrationCode error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
