import { supabase, corsHeaders } from "../_shared/supabaseClient.ts";
import { withErrorHandling, okResponse } from "../_shared/errorHandler.ts";

Deno.serve(withErrorHandling(async (_req) => {
  const checks: Record<string, boolean> = {};

  // DB connectivity
  const { error: dbErr } = await supabase.from("app_settings").select("key").limit(1);
  checks.database = !dbErr;

  // AI settings row exists
  const { data: aiSettings } = await supabase
    .from("ai_recruiter_settings")
    .select("id")
    .limit(1)
    .maybeSingle();
  checks.ai_settings = !!aiSettings;

  const healthy = Object.values(checks).every(Boolean);

  return okResponse(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    healthy ? 200 : 503
  );
}));
