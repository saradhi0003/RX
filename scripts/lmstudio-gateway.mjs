#!/usr/bin/env node
/**
 * lmstudio-gateway — a shared-secret front door for the local LM Studio server.
 *
 * WHY THIS EXISTS
 * `cloudflared tunnel --url http://localhost:1234` publishes LM Studio at a
 * public hostname with **no authentication whatsoever**. Anyone who learns the
 * URL — and trycloudflare hostnames appear in Certificate Transparency logs
 * within seconds of issuance, so "nobody will guess it" is not a control — gets
 * unmetered use of the fleet and, more importantly, gets to read whatever the
 * model is asked about. In this app that is candidate PII: resumes, contact
 * details, interview notes.
 *
 * So we never point the tunnel at LM Studio. We point it here, and this process
 * requires `Authorization: Bearer <secret>` before it forwards anything.
 *
 * WHY A BEARER TOKEN AND NOT SOMETHING STRONGER
 * The consumer is `_shared/llm.ts`, which talks to the endpoint through the
 * OpenAI SDK. That SDK already sends `Authorization: Bearer <apiKey>` on every
 * request, so a bearer check is the one scheme that needs zero changes on the
 * calling side: set OPENAI_COMPATIBLE_API_KEY to the secret and it just works.
 * Cloudflare Access service tokens would be stronger, but they need an account,
 * a domain and a Zero Trust policy — see the header of tunnel-lmstudio.sh for
 * when to graduate to that.
 *
 * WHY THE BROWSER MUST NOT USE THIS
 * There is deliberately no CORS handling here. A browser can only send the
 * secret if the secret is in the bundle, and `VITE_*` vars are inlined at build
 * time — that would publish it. The SPA keeps talking to `http://localhost:1234`
 * directly (VITE_LLM_PROVIDER=lmstudio); this gateway exists for the one caller
 * that cannot reach localhost, the Supabase Edge Functions.
 *
 * Usage:
 *   node scripts/lmstudio-gateway.mjs              # start on 127.0.0.1:1235
 *   node scripts/lmstudio-gateway.mjs --print-secret   # resolve/create, print, exit
 *
 * Env:
 *   LMSTUDIO_TUNNEL_SECRET  the shared secret (generated + persisted if unset)
 *   LMSTUDIO_PORT           upstream LM Studio port (default 1234)
 *   GATEWAY_PORT            port to listen on (default 1235)
 */
import http from "node:http";
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Matches the existing `*.local` rule in .gitignore, so the secret is
 * untracked by construction rather than by remembering to add a rule.
 */
const SECRET_FILE = path.join(REPO_ROOT, ".lmstudio-tunnel.local");

const UPSTREAM_PORT = Number(process.env.LMSTUDIO_PORT || 1234);
const UPSTREAM = `http://127.0.0.1:${UPSTREAM_PORT}`;
const LISTEN_PORT = Number(process.env.GATEWAY_PORT || 1235);

/**
 * Only the read/inference surface. LM Studio's REST API also exposes model
 * management, and a tunnel is not the place to let a stranger load a 70B model
 * onto someone's laptop. Anything not listed here gets a 404 — including paths
 * that merely *start* with an allowed one, since matching is exact.
 */
const ALLOWED = new Map([
  ["/v1/chat/completions", ["POST"]],
  ["/v1/completions", ["POST"]],
  ["/v1/embeddings", ["POST"]],
  ["/v1/models", ["GET"]],
  ["/api/v0/models", ["GET"]],
]);

/** A runaway prompt is a cost and memory problem; cap it at the door. */
const MAX_BODY_BYTES = Number(process.env.GATEWAY_MAX_BODY_BYTES || 2_000_000);

/**
 * Resolve the shared secret: env wins, then the persisted file, else generate
 * one and persist it 0600. Generating on first run means the secure path is
 * also the path of least resistance — nobody has to invent a token to get
 * started, so nobody is tempted to skip the auth layer entirely.
 */
export function resolveSecret() {
  const fromEnv = (process.env.LMSTUDIO_TUNNEL_SECRET || "").trim();
  if (fromEnv) return fromEnv;

  if (existsSync(SECRET_FILE)) {
    const existing = readFileSync(SECRET_FILE, "utf8").trim();
    if (existing) return existing;
  }

  const generated = randomBytes(32).toString("base64url");
  writeFileSync(SECRET_FILE, `${generated}\n`, { mode: 0o600 });
  return generated;
}

/**
 * Constant-time comparison over SHA-256 digests.
 *
 * timingSafeEqual throws outright when the buffers differ in length, which
 * would both crash the request and leak the secret's length through the error.
 * Hashing first makes every comparison a fixed 32 bytes.
 */
function secretMatches(presented, expected) {
  if (!presented) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearerFrom(req) {
  const header = req.headers["authorization"] || "";
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1].trim() : "";
}

function deny(res, status, message) {
  const body = JSON.stringify({ error: { message, type: "gateway_error" } });
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/** ISO timestamp + outcome. Never the secret, never the prompt. */
function log(req, status, note = "") {
  const at = new Date().toISOString();
  const route = (req.url || "").split("?")[0];
  console.log(`${at}  ${String(status).padEnd(3)} ${req.method} ${route}${note ? `  ${note}` : ""}`);
}

const SECRET = resolveSecret();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  // Auth first — an unauthenticated caller learns nothing about which paths
  // exist, so probing the surface costs the same as probing a closed port.
  if (!secretMatches(bearerFrom(req), SECRET)) {
    log(req, 401, "bad or missing bearer token");
    return deny(res, 401, "Unauthorized: valid Authorization: Bearer <secret> required.");
  }

  const methods = ALLOWED.get(pathname);
  if (!methods) {
    log(req, 404, "path not allowlisted");
    return deny(res, 404, `Not found: ${pathname} is not proxied by this gateway.`);
  }
  if (!methods.includes(req.method || "")) {
    log(req, 405);
    return deny(res, 405, `Method ${req.method} not allowed for ${pathname}.`);
  }

  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) {
    log(req, 413, `${declared} bytes`);
    return deny(res, 413, `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
  }

  const hasBody = req.method === "POST";
  try {
    const upstream = await fetch(`${UPSTREAM}${pathname}${url.search}`, {
      method: req.method,
      headers: {
        // Rebuilt rather than forwarded: the client's Authorization is our
        // secret and has no meaning upstream, and hop-by-hop headers
        // (connection, transfer-encoding) must not be relayed.
        "Content-Type": req.headers["content-type"] || "application/json",
        Accept: req.headers["accept"] || "application/json",
      },
      body: hasBody ? Readable.toWeb(req) : undefined,
      duplex: hasBody ? "half" : undefined,
    });

    // Stream rather than buffer: `stream: true` completions arrive as SSE and
    // buffering them would defeat the point of streaming and blow memory on
    // long generations.
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    log(req, upstream.status);
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    // Reaching here means LM Studio itself is down or refused the connection —
    // the tunnel and auth layer are fine, so say so explicitly.
    log(req, 502, err?.message || "upstream failed");
    deny(
      res,
      502,
      `Cannot reach LM Studio at ${UPSTREAM}. Open LM Studio → Developer → Start Server ` +
        `(port ${UPSTREAM_PORT}) and load a model. Cause: ${err?.message || err}`,
    );
  }
});

if (process.argv.includes("--print-secret")) {
  process.stdout.write(`${SECRET}\n`);
  process.exit(0);
}

// 127.0.0.1, never 0.0.0.0: cloudflared runs on this machine and connects over
// loopback, so binding wider would expose the gateway to the local network for
// no benefit.
server.listen(LISTEN_PORT, "127.0.0.1", () => {
  console.log(`lmstudio-gateway listening on http://127.0.0.1:${LISTEN_PORT}`);
  console.log(`  → forwarding authenticated requests to ${UPSTREAM}`);
  console.log(`  → secret loaded from ${process.env.LMSTUDIO_TUNNEL_SECRET ? "LMSTUDIO_TUNNEL_SECRET" : SECRET_FILE}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
