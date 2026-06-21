#!/usr/bin/env bash
# Deploys the livekitToken Edge Function to Supabase and sets the required
# secrets. Run this once from the recruiter-x1 directory:
#
#   ./scripts/deploy-livekit.sh   wss://talentstack-cv606gc8.livekit.cloud   APIxxxxx   secretxxxxx
#
# Args:
#   $1  LIVEKIT_URL          wss://<project>.livekit.cloud
#   $2  LIVEKIT_API_KEY      starts with "API" — from cloud.livekit.io project settings
#   $3  LIVEKIT_API_SECRET   the long random string — from the same settings page

set -euo pipefail

LIVEKIT_URL="${1:-}"
LIVEKIT_API_KEY="${2:-}"
LIVEKIT_API_SECRET="${3:-}"

if [[ -z "$LIVEKIT_URL" || -z "$LIVEKIT_API_KEY" || -z "$LIVEKIT_API_SECRET" ]]; then
  echo "usage: $0 <livekit_wss_url> <api_key> <api_secret>"
  exit 1
fi

PROJECT_REF="bwjfglerixssibenkjse"

echo "▶ Logging in (browser will open if needed)…"
npx -y supabase@latest login

echo "▶ Linking project ${PROJECT_REF}…"
npx -y supabase@latest link --project-ref "$PROJECT_REF"

echo "▶ Setting function secrets…"
npx -y supabase@latest secrets set \
  LIVEKIT_URL="$LIVEKIT_URL" \
  LIVEKIT_API_KEY="$LIVEKIT_API_KEY" \
  LIVEKIT_API_SECRET="$LIVEKIT_API_SECRET"

echo "▶ Deploying livekitToken Edge Function…"
npx -y supabase@latest functions deploy livekitToken --no-verify-jwt

echo
echo "✅ Done. Test from the running app: /VideoCall → Join Call."
