// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals or esm.sh URL imports.
// ============================================================================
// transcribeRecording — Whisper post-call transcription.
//
// Trigger: POST { recording_id: "<uuid>" }
//
// Flow
//   1. Look up the row in video_call_recordings.
//   2. Download the file from the meeting-recordings Storage bucket
//      (service role bypasses RLS).
//   3. Send to OpenAI Whisper API (audio/transcriptions, verbose_json).
//   4. Update the row: status='done', transcript_text, transcript_json.
//   5. On failure: status='failed', error=<message>.
//
// Deploy (Supabase Dashboard → Edge Functions → Via Editor):
//   - Function name: transcribeRecording
//   - Verify JWT: ON  (default; we want this called from authenticated clients)
//   - Paste this file.
//   - Already-required secrets: OPENAI_API_KEY  (set via Project Settings →
//     Edge Functions → Secrets if not already there).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY        = Deno.env.get("OPENAI_API_KEY") ?? "";
const BUCKET                = "meeting-recordings";
const WHISPER_LIMIT_BYTES   = 25 * 1024 * 1024;   // OpenAI hard limit

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  if (!OPENAI_API_KEY) {
    return json({
      error: "OPENAI_API_KEY missing in Edge Function secrets. Set it at " +
             "Project Settings → Edge Functions → Secrets.",
    }, 500);
  }

  let recordingId: string;
  try {
    const body = await req.json();
    recordingId = body?.recording_id;
    if (!recordingId) return json({ error: "Missing 'recording_id'" }, 400);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── 1. Look up the recording row ─────────────────────────────────────────
  const { data: rec, error: selErr } = await sb
    .from("video_call_recordings")
    .select("*")
    .eq("id", recordingId)
    .single();
  if (selErr || !rec) return json({ error: selErr?.message || "Recording not found" }, 404);

  // Mark transcribing
  await sb.from("video_call_recordings").update({ status: "transcribing", error: null }).eq("id", recordingId);

  try {
    // ── 2. Download the file ──────────────────────────────────────────────
    const { data: file, error: dlErr } = await sb.storage.from(BUCKET).download(rec.file_path);
    if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message}`);

    if (file.size > WHISPER_LIMIT_BYTES) {
      throw new Error(
        `Recording is ${(file.size / 1024 / 1024).toFixed(1)} MB; Whisper max is 25 MB. ` +
        `For longer calls, switch to LiveKit Egress + multi-part transcription.`
      );
    }

    // ── 3. Call Whisper ────────────────────────────────────────────────────
    const ext  = rec.file_path.split(".").pop() || "webm";
    const form = new FormData();
    form.append("file", file, `recording.${ext}`);
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");

    const t0 = Date.now();
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    const latency_ms = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Whisper ${res.status}: ${text.slice(0, 400)}`);
    }
    const whisper = await res.json();

    // ── 4. Update recording row with transcript ────────────────────────────
    await sb.from("video_call_recordings").update({
      status: "done",
      transcript_text: whisper.text || "",
      transcript_json: whisper,
      error: null,
    }).eq("id", recordingId);

    // ── 5. Optional: post-call summary + action items via GPT-4o-mini ──────
    // Runs only if there's text to summarize. Failure here doesn't roll back
    // the transcript — we want the raw text saved even if the LLM call hiccups.
    let summary = null;
    let action_items = null;
    if ((whisper.text || "").trim().length > 50) {
      try {
        const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "You are a recruiting assistant. Given a meeting transcript, return JSON " +
                  "with exactly two fields:\n" +
                  '  summary: a 2-4 sentence neutral recap of what was discussed.\n' +
                  '  action_items: an array of {task, owner, due_date_hint} ' +
                  "(owner = the person responsible if mentioned, else null; due_date_hint = " +
                  "any time reference like 'next Tuesday' or 'by EOW', else null). " +
                  "If no action items, return an empty array.",
              },
              { role: "user", content: `Transcript:\n${whisper.text}` },
            ],
            temperature: 0.2,
          }),
        });
        if (summaryRes.ok) {
          const j = await summaryRes.json();
          const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");
          summary = parsed.summary ?? null;
          action_items = Array.isArray(parsed.action_items) ? parsed.action_items : null;
        } else {
          console.warn(`[transcribeRecording] summary call ${summaryRes.status}: ${await summaryRes.text().catch(() => "")}`);
        }
      } catch (e) {
        console.warn(`[transcribeRecording] summary failed: ${e instanceof Error ? e.message : e}`);
      }
    }

    // ── 6. If linked to a booking, write summary + action_items on it. ─────
    //     We look up the booking via the recording's booking_id column (added
    //     by migration 011). Forward link only — booking_id may be null for
    //     ad-hoc rooms that weren't created from a Booking.
    if (rec.booking_id && (summary || action_items)) {
      await sb.from("bookings").update({
        summary,
        action_items,
        recording_id: recordingId,    // backfill the reverse link
        status: "completed",
      }).eq("id", rec.booking_id);
    }

    return json({
      ok: true,
      recording_id: recordingId,
      booking_id: rec.booking_id ?? null,
      duration_seconds: whisper.duration,
      segments: whisper.segments?.length ?? 0,
      summary_chars: summary?.length ?? 0,
      action_items_count: action_items?.length ?? 0,
      latency_ms,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sb.from("video_call_recordings").update({
      status: "failed",
      error: msg,
    }).eq("id", recordingId);
    return json({ ok: false, recording_id: recordingId, error: msg }, 500);
  }
});
