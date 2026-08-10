#!/usr/bin/env bash
# DEPRECATED — superseded by ./scripts/tunnel-lmstudio.sh
#
# This script used to run `cloudflared tunnel --url http://localhost:1234` and
# tell you to set OPENAI_COMPATIBLE_API_KEY=not-needed. That published the whole
# local model fleet to the internet with no authentication: trycloudflare
# hostnames appear in Certificate Transparency logs, so the URL was never a
# secret, and anyone holding it could run prompts against your machine — in this
# app, against candidate PII.
#
# The replacement puts a shared-secret gateway in front of LM Studio and points
# the tunnel at that instead. It is otherwise a drop-in.
set -euo pipefail
echo "⚠  tunnel-qwen.sh is deprecated — running ./scripts/tunnel-lmstudio.sh instead."
echo "   (the old version exposed LM Studio with no auth; see this file's header)"
echo ""
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tunnel-lmstudio.sh" "$@"
