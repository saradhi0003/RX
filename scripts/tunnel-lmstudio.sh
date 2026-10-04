#!/usr/bin/env bash
# Publish the local model fleet to Supabase Edge Functions, behind a shared secret.
#
#   ./scripts/serve-slm.sh
#   ./scripts/tunnel-lmstudio.sh
#
# Named tunnel (stable hostname):
#   CLOUDFLARE_TUNNEL_TOKEN=... RX_TUNNEL_HOSTNAME=llm.example.com ./scripts/tunnel-lmstudio.sh
# Same machine only:
#   RX_LOCAL_ONLY=1 ./scripts/tunnel-lmstudio.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_PORT="${LMSTUDIO_PORT:-1234}"
GATEWAY_PORT="${GATEWAY_PORT:-1235}"
UPSTREAM="http://localhost:${UPSTREAM_PORT}"

if [[ "${RX_LOCAL_ONLY:-}" != "1" ]]; then
  command -v cloudflared >/dev/null || {
    echo "cloudflared not found. brew install cloudflared"
    exit 1
  }
fi
command -v node >/dev/null || { echo "node not found."; exit 1; }

echo "Checking model server at ${UPSTREAM}/v1/models ..."
if ! curl -sf "${UPSTREAM}/v1/models" >/dev/null; then
  echo "Model server is not reachable at ${UPSTREAM}"
  echo "Start it with ./scripts/serve-slm.sh, or LM Studio on port ${UPSTREAM_PORT}."
  exit 1
fi
echo "Model server is up."

SECRET="$(node "${REPO_ROOT}/scripts/lmstudio-gateway.mjs" --print-secret)"

cleanup() {
  [[ -n "${GATEWAY_PID:-}" ]] && kill "${GATEWAY_PID}" 2>/dev/null || true
  [[ -n "${TUNNEL_PID:-}" ]] && kill "${TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting auth gateway on 127.0.0.1:${GATEWAY_PORT} ..."
node "${REPO_ROOT}/scripts/lmstudio-gateway.mjs" &
GATEWAY_PID=$!
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://127.0.0.1:${GATEWAY_PORT}/v1/models"; then break; fi
  sleep 0.1
done
if ! kill -0 "${GATEWAY_PID}" 2>/dev/null; then
  echo "Gateway failed to start."
  exit 1
fi

TUNNEL_LOG="$(mktemp -t lmstudio-tunnel)"
TUNNEL_PID=""
if [[ "${RX_LOCAL_ONLY:-}" == "1" ]]; then
  echo "RX_LOCAL_ONLY=1 — browser can use http://127.0.0.1:${GATEWAY_PORT}/v1"
  echo "http://127.0.0.1:${GATEWAY_PORT}" >"${TUNNEL_LOG}"
elif [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "Using named tunnel token."
  cloudflared tunnel run --token "${CLOUDFLARE_TUNNEL_TOKEN}" >"${TUNNEL_LOG}" 2>&1 &
  TUNNEL_PID=$!
else
  echo "No CLOUDFLARE_TUNNEL_TOKEN — falling back to a disposable quick tunnel."
  cloudflared tunnel --url "http://127.0.0.1:${GATEWAY_PORT}" >"${TUNNEL_LOG}" 2>&1 &
  TUNNEL_PID=$!
fi

PUBLIC_URL=""
for _ in $(seq 1 100); do
  PUBLIC_URL="$(grep -oE 'https://[a-zA-Z0-9._-]+' "${TUNNEL_LOG}" | grep -v 'api.trycloudflare.com' | head -1 || true)"
  if [[ -z "${PUBLIC_URL}" && -n "${RX_TUNNEL_HOSTNAME:-}" ]]; then
    PUBLIC_URL="https://${RX_TUNNEL_HOSTNAME}"
  fi
  [[ -n "${PUBLIC_URL}" ]] && break
  if [[ -n "${TUNNEL_PID}" ]] && ! kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    echo "cloudflared exited. Log:"; cat "${TUNNEL_LOG}"; exit 1
  fi
  sleep 0.2
done

if [[ -z "${PUBLIC_URL}" ]]; then
  echo "Timed out waiting for a tunnel URL. Log:"; cat "${TUNNEL_LOG}"; exit 1
fi

PUBLIC_V1="${PUBLIC_URL}/v1"
MODEL_ID="$(curl -sf "${UPSTREAM}/v1/models" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const m=JSON.parse(s).data||[];console.log(m[0]?.id||"")}catch{console.log("")}})' || true)"
[[ -z "${MODEL_ID}" ]] && MODEL_ID="smollm2-360m-instruct"

cat <<EOF
Tunnel live: ${PUBLIC_V1}
Secret is in .lmstudio-tunnel.local

supabase secrets set \\
  OPENAI_COMPATIBLE_BASE_URL=${PUBLIC_V1} \\
  OPENAI_COMPATIBLE_API_KEY=${SECRET} \\
  OPENAI_COMPATIBLE_DEFAULT_MODEL=${MODEL_ID}

Use model local/${MODEL_ID} in AI Recruiter Settings.
EOF

if [[ -n "${TUNNEL_PID}" ]]; then wait "${TUNNEL_PID}"; else wait "${GATEWAY_PID}"; fi
