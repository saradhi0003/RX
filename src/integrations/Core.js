/**
 * Drop-in replacement for Base44's integrations/Core module.
 * All exports match the original API surface.
 */
import { invokeLLM } from "@/lib/llm";
import { supabase } from "@/lib/supabase";

// ── InvokeLLM ─────────────────────────────────────────────────────────────────
export const InvokeLLM = invokeLLM;

// ── InvokeFunction ────────────────────────────────────────────────────────────
// Routes to Supabase Edge Functions.
export async function InvokeFunction({ function_name, payload = {} }) {
  const { data, error } = await supabase.functions.invoke(function_name, { body: payload });
  if (error) throw error;
  return data;
}

// ── SendEmail ─────────────────────────────────────────────────────────────────
// Calls the send-email Edge Function.
export async function SendEmail({ to, subject, body, from, cc, reply_to }) {
  return InvokeFunction({
    function_name: "sendEmail",
    payload: { to, subject, body, from, cc, reply_to },
  });
}

// ── UploadFile ────────────────────────────────────────────────────────────────
// Uploads to Supabase Storage bucket "uploads".
export async function UploadFile({ file, bucket = "uploads", path }) {
  const filePath = path || `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { url: urlData.publicUrl, path: data.path };
}

// ── ExtractDataFromUploadedFile ───────────────────────────────────────────────
// Calls the extract-data Edge Function.
export async function ExtractDataFromUploadedFile({ file_url, extraction_prompt }) {
  return InvokeFunction({
    function_name: "extractDataFromFile",
    payload: { file_url, extraction_prompt },
  });
}

// ── GenerateImage ─────────────────────────────────────────────────────────────
// Falls through to OpenAI DALL·E via Edge Function.
export async function GenerateImage({ prompt, size = "1024x1024" }) {
  return InvokeFunction({ function_name: "generateImage", payload: { prompt, size } });
}

// ── SendSMS ───────────────────────────────────────────────────────────────────
export async function SendSMS({ to, body }) {
  return InvokeFunction({ function_name: "sendSMS", payload: { to, body } });
}

// ── Core namespace (for backwards compatibility with `Core.InvokeLLM` usage) ──
export const Core = {
  InvokeLLM,
  InvokeFunction,
  SendEmail,
  UploadFile,
  ExtractDataFromUploadedFile,
  GenerateImage,
  SendSMS,
};
