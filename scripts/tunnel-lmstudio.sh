#!/usr/bin/env bash
# Publish the local LM Studio fleet to the Supabase Edge Functions, behind a
# shared secret.
#
#   ./scripts/tunnel-lmstudio.sh
#
# WHAT IT STARTS
#   1. scripts/lmstudio-gateway.mjs on 127.0.0.1:1235 — checks
#      `Authorization: Bearer <secret>` and forwards to LM Studio on :1234.
#   2. `cloudflared tunnel` pointed at the *gateway*, never at LM Studio.
#
# WHY THE GATEWAY IS NOT OPTIONAL
#   A bare `cloudflared tunnel --url http://localhost:1234` is world-readable.
#   trycloudflare hostnames show up in Certificate Transparency logs, so the URL
#   is not a secret and anyone holding it can run prompts against your machine —
#   which in this app means candidate PII. See the header of lmstudio-gateway.mjs.
#
# WHEN TO GRADUATE TO CLOUDFLARE ACCESS
#   Quick tunnels get a fresh random hostname on every restart, so each restart
#   means re-setting the Supabase secret. Once this is more than a dev
#   convenience, move to a *named* tunnel on your own domain with Cloudflare
#   Access service tokens: stable URL, revocable credentials, real audit log.
#
# Requirements: LM Studio server running on :1234, cloudflared, node.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_PORT="${LMSTUDIO_PORT:-1234}"
GATEWAY_PORT="${GATEWAY_PORT:-1235}"
UPSTREAM="http://localhost:${UPSTREAM_PORT}"

command -v cloudflared >/dev/null || {
  echo "❌ cloudflared not found."
  echo "   brew install cloudflared — or grab the binary:"
  echo "   https://github.com/cloudflare/cloudflared/releases/latest"
  exit 1
}
command -v node >/dev/null || { echo "❌ node not found."; exit 1; }

echo "Checking LM Studio at ${UPSTREAM}/v1/models ..."
if ! curl -sf "${UPSTREAM}/v1/models" >/dev/null; then
  echo "❌ LM Studio is not reachable at ${UPSTREAM}"
  echo "   Open LM Studio → Developer → Start Server (port ${UPSTREAM_PORT}) and load a model."
  exit 1
fi
echo "✅ LM Studio is up."

# Resolve (or create) the shared secret before anything binds a port, so a
# failure here doesn't leave a half-started stack behind.
SECRET="$(node "${REPO_ROOT}/scripts/lmstudio-gateway.mjs" --print-secret)"

cleanup() {
  [[ -n "${GATEWAY_PID:-}" ]] && kill "${GATEWAY_PID}" 2>/dev/null || true
  [[ -n "${TUNNEL_PID:-}" ]] && kill "${TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting auth gateway on 127.0.0.1:${GATEWAY_PORT} ..."
node "${REPO_ROOT}/scripts/lmstudio-gateway.mjs" &
GATEWAY_PID=$!

# Wait for the listener rather than sleeping a fixed interval — a cold node
# start on a loaded machine is easily slower than any guess.
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://127.0.0.1:${GATEWAY_PORT}/v1/models"; then break; fi
  sleep 0.1
done
if ! kill -0 "${GATEWAY_PID}" 2>/dev/null; then
  echo "❌ Gateway failed to start."
  exit 1
fi
echo "✅ Gateway is up (401s without the bearer token — that is the point)."

TUNNEL_LOG="$(mktemp -t lmstudio-tunnel)"
echo "Starting Cloudflare Tunnel ..."
cloudflared tunnel --url "http://127.0.0.1:${GATEWAY_PORT}" >"${TUNNEL_LOG}" 2>&1 &
TUNNEL_PID=$!

# cloudflared prints the hostname a second or two after boot; poll the log.
PUBLIC_URL=""
for _ in $(seq 1 100); do
  # `api.trycloudflare.com` is the control-plane endpoint cloudflared itself
  # calls, and it appears in this same log — matching it and treating it as the
  # tunnel hostname publishes a URL that answers 405 to everything. Exclude it
  # explicitly rather than relying on the real hostname appearing first.
  PUBLIC_URL="$(grep -oE 'https://[a-zA-Z0-9_-]+\.trycloudflare\.com' "${TUNNEL_LOG}" \
                  | grep -v '^https://api\.trycloudflare\.com$' | head -1 || true)"
  [[ -n "${PUBLIC_URL}" ]] && break
  if ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    echo "❌ cloudflared exited. Log:"; cat "${TUNNEL_LOG}"; exit 1
  fi
  sleep 0.2
done

if [[ -z "${PUBLIC_URL}" ]]; then
  echo "❌ Timed out waiting for a tunnel URL. Log:"; cat "${TUNNEL_LOG}"; exit 1
fi

PUBLIC_V1="${PUBLIC_URL}/v1"
MODEL_ID="$(curl -sf "${UPSTREAM}/v1/models" | node -e \
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s).data||[];console.log(m[0]?.id||"")}catch{console.log("")}})' || true)"
[[ -z "${MODEL_ID}" ]] && MODEL_ID="<model-id-from-/v1/models>"

cat <<EOF

═══════════════════════════════════════════════════════════════════
🌐 Tunnel live:  ${PUBLIC_V1}
🔑 Shared secret is in .lmstudio-tunnel.local (gitignored via *.local)
═══════════════════════════════════════════════════════════════════

Set the Edge Function secrets so llmProxy and the aiRecruiter* chain can
reach this fleet:

supabase secrets set \\
  OPENAI_COMPATIBLE_BASE_URL=${PUBLIC_V1} \\
  OPENAI_COMPATIBLE_API_KEY=${SECRET} \\
  OPENAI_COMPATIBLE_DEFAULT_MODEL=${MODEL_ID}

Then address the fleet from any task by prefixing the model id with 'local/':

  invokeLLM({ prompt, task: "resume_parse", model: "local/${MODEL_ID}" })

or set a per-task model to 'local/${MODEL_ID}' in AI Recruiter Settings.
The prefix is what routes a call here instead of to DeepSeek/DashScope, and
it keeps the run priced at \$0 in llm_usage.

⚠ The browser does NOT need any of this. Keep VITE_LLM_PROVIDER=lmstudio and
  it will keep calling http://localhost:1234 directly. Never put this secret
  in a VITE_* var — those are inlined into the public bundle at build time.

Quick check from another terminal:
  curl -s ${PUBLIC_V1}/models -H "Authorization: Bearer \$(cat .lmstudio-tunnel.local)" | head -c 200
  curl -s -o /dev/null -w '%{http_code}\\n' ${PUBLIC_V1}/models     # expect 401

Ctrl+C stops both the tunnel and the gateway.
EOF

wait "${TUNNEL_PID}"
