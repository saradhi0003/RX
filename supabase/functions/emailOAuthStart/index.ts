// @ts-nocheck   — Deno-runtime file; node-tsc can't see Deno globals.
/**
 * emailOAuthStart
 * POST { provider: "gmail" | "zoho" } — admin only.
 * Returns the provider consent URL. The admin opens it, approves, and the
 * provider redirects to emailOAuthCallback, which stores the tokens.
 */
import { withErrorHandling, okResponse, errResponse } from "../_shared/errorHandler.ts";
import { requireAdminUser, DEFAULT_WORKSPACE_ID } from "../_shared/auth.ts";
import {
  hasGoogleOAuth, getGoogleOAuthEnv,
  hasZohoOAuth, getZohoOAuthEnv,
  getEmailOAuthRedirectUrl,
} from "../_shared/env.ts";
import { signState } from "../_shared/oauthState.ts";

Deno.serve(withErrorHandling(async (req) => {
  // Connecting a mailbox imports data for the whole workspace — admin only.
  const gate = await requireAdminUser(req);
  if (gate.response) return gate.response;

  const { provider } = await req.json();
  const state = await signState({
    provider,
    uid: gate.user.id || "",
    workspaceId: gate.profile.workspace_id || DEFAULT_WORKSPACE_ID,
    ts: Date.now(),
  });
  const redirectUri = getEmailOAuthRedirectUrl();

  if (provider === "gmail") {
    if (!hasGoogleOAuth()) {
      return errResponse("GOOGLE_OAUTH_CLIENT_ID/SECRET not configured as Edge Function secrets", 400);
    }
    const { clientId } = getGoogleOAuthEnv();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return okResponse({ consent_url: url.toString() });
  }

  if (provider === "zoho") {
    if (!hasZohoOAuth()) {
      return errResponse("ZOHO_OAUTH_CLIENT_ID/SECRET not configured as Edge Function secrets", 400);
    }
    const { clientId } = getZohoOAuthEnv();
    const url = new URL("https://accounts.zoho.com/oauth/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "ZohoMail.messages.READ,ZohoMail.accounts.READ");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return okResponse({ consent_url: url.toString() });
  }

  return errResponse(`Unknown provider "${provider}" — expected gmail or zoho`, 400);
}));
