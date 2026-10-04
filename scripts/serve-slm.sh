#!/usr/bin/env bash
# Serve the downloaded SLM on :1234, the port the app and the tunnel already use.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL="${ROOT}/models/smollm2-360m-instruct-q8_0.gguf"
SERVER="${ROOT}/models/llama-server"
PORT="${LMSTUDIO_PORT:-1234}"

if [[ ! -f "${MODEL}" ]]; then
  echo "Model missing. Run ./scripts/download-slm.sh first."
  exit 1
fi
if [[ ! -x "${SERVER}" ]]; then
  echo "llama-server missing. Open LM Studio, load ${MODEL}, and start the server on :${PORT}."
  exit 1
fi

echo "SLM on http://127.0.0.1:${PORT}/v1  (model id: smollm2-360m-instruct)"
exec "${SERVER}" -m "${MODEL}" --host 127.0.0.1 --port "${PORT}" -c 4096 --jinja
