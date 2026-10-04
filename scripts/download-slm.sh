#!/usr/bin/env bash
# Download the on-device SLM and a llama.cpp server so Recruiter X does not
# depend on a disposable trycloudflare hostname.
#
#   ./scripts/download-slm.sh
#
# Result:
#   models/smollm2-360m-instruct-q8_0.gguf
#   models/llama-server
#
# Then: ./scripts/serve-slm.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS="${ROOT}/models"
mkdir -p "${MODELS}"

MODEL_FILE="smollm2-360m-instruct-q8_0.gguf"
MODEL_URL="https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/${MODEL_FILE}"
DEST="${MODELS}/${MODEL_FILE}"

if [[ ! -f "${DEST}" ]]; then
  echo "Downloading ${MODEL_FILE} (~386 MB) ..."
  curl -L --fail --retry 3 -o "${DEST}.partial" "${MODEL_URL}"
  mv "${DEST}.partial" "${DEST}"
else
  echo "Model already present: ${DEST}"
fi

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "${OS}-${ARCH}" in
  darwin-arm64) ASSET="llama-b4096-bin-macos-arm64.tar.gz" ;;
  darwin-x86_64) ASSET="llama-b4096-bin-macos-x64.tar.gz" ;;
  linux-x86_64) ASSET="llama-b4096-bin-ubuntu-x64.tar.gz" ;;
  linux-aarch64) ASSET="llama-b4096-bin-ubuntu-arm64.tar.gz" ;;
  *) echo "No llama.cpp build mapped for ${OS}-${ARCH}. Model is downloaded; run it in LM Studio and point the server at :1234."; exit 0 ;;
esac

if [[ ! -x "${MODELS}/llama-server" ]]; then
  echo "Downloading llama.cpp server (${ASSET}) ..."
  TMP="$(mktemp -d)"
  curl -L --fail --retry 3 -o "${TMP}/llama.tgz" \
    "https://github.com/ggml-org/llama.cpp/releases/download/b4096/${ASSET}"
  tar -xzf "${TMP}/llama.tgz" -C "${TMP}"
  BIN="$(find "${TMP}" -type f -name 'llama-server' | head -1)"
  if [[ -z "${BIN}" ]]; then
    echo "llama-server binary not found in the archive. Load the GGUF in LM Studio instead."
    exit 0
  fi
  cp "${BIN}" "${MODELS}/llama-server"
  chmod +x "${MODELS}/llama-server"
  rm -rf "${TMP}"
fi

echo "Ready. Start it with ./scripts/serve-slm.sh"
