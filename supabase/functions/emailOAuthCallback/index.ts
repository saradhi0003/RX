// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals.
/**
 * emailOAuthCallback  (verify_jwt = false)
 * GET ?code&state — the OAuth redirect target for Gmail and Zoho.
 *
 * Exchanges the code for tokens, resolves the mailbox address, upserts the
 * email_accounts row, and lands the browser back on the app's Email Settings
 * page. Auth is the HMAC-signed state from emailOAuthStart.
 */
import { supabase } from "../_shared/supabaseClient.ts";
import { DEFAULT_WORKSPACE_ID } from "../_shared/auth.ts";
import {
  getGoogleOAuthEnv, getZohoOAuthEnv, getEmailOAuthRedirectUrl, getAppUrl,
} from "../_shared/env.ts";
import { verifyState } from "../_shared/oauthState.ts";

function redirect(path: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${getAppUrl()}${path}` },
  });
}

async function exchangeCode(provider: string, code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}> {
  const redirectUri = getEmailOAuthRedirectUrl();
  const tokenUrl = provider === "gmail"
    ? "https://oauth2.googleapis.com/token"
    : "https://accounts.zoho.com/oauth/v2/token";
  const { clientId, clientSecret } =
    provider === "gmail" ? getGoogleOAuthEnv() : getZohoOAuthEnv();

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `token exchange failed: HTTP ${res.status}`);
  }
  return json;
}

/** Mailbox address from Gmail's id_token (JWT payload, no network call). */
function gmailEmailFromIdToken(idToken: string): string {
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(String(idToken).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    return payload.email || "";
  } catch {
    return "";
  }
}

/** Zoho account id + primary address from the Mail accounts endpoint. */
async function zohoAccountInfo(accessToken: string): Promise<{ email: string; accountId: string }> {
  const res = await fetch("https://mail.zoho.com/api/accounts", {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  const account = Array.isArray(json?.data) ? json.data[0] : null;
  return {
    email: account?.primaryEmailAddress || account?.emailAddress || "",
    accountId: account?.accountId ? String(account.accountId) : "",
  };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const stateParam = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error");

  if (errorParam) return redirect(`/EmailSettings?oauth_error=${encodeURIComponent(errorParam)}`);

  try {
    const state = await verifyState(stateParam);
    if (!state || !code) return redirect("/EmailSettings?oauth_error=invalid_state");

    const tokens = await exchangeCode(state.provider, code);

    let emailAddress = "";
    let externalAccountId = "";
    if (state.provider === "gmail") {
      emailAddress = gmailEmailFromIdToken(tokens.id_token || "");
    } else {
      const info = await zohoAccountInfo(tokens.access_token);
      emailAddress = info.email;
      externalAccountId = info.accountId;
    }
    if (!emailAddress) throw new Error("could not resolve mailbox address from provider");

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Upsert on (provider, email_address). A reconnect refreshes tokens; a
    // provider that withholds refresh_token on re-consent keeps the old one.
    const { data: existing } = await supabase
      .from("email_accounts")
      .select("id, refresh_token")
      .eq("provider", state.provider)
      .eq("email_address", emailAddress)
      .maybeSingle();

    const row = {
      workspace_id: state.workspaceId || DEFAULT_WORKSPACE_ID,
      provider: state.provider,
      email_address: emailAddress,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: expiresAt,
      external_account_id: externalAccountId || null,
      is_active: true,
      last_error: null,
      created_by: state.uid || null,
    };

    const { error } = existing
      ? await supabase.from("email_accounts").update(row).eq("id", existing.id)
      : await supabase.from("email_accounts").insert(row);
    if (error) throw new Error(error.message);

    return redirect(`/EmailSettings?connected=${state.provider}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return redirect(`/EmailSettings?oauth_error=${encodeURIComponent(message)}`);
  }
});
