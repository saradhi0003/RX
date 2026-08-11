#!/usr/bin/env bash
# Keep the LM Studio tunnel alive, and keep Supabase pointed at it.
#
#   ./scripts/tunnel-supervisor.sh              # run in the foreground
#   nohup ./scripts/tunnel-supervisor.sh >/tmp/rx-tunnel-supervisor.log 2>&1 &
#
# WHY THIS EXISTS
# A trycloudflare quick tunnel dies on its own schedule — twice in one ~2h
# session — and it dies in the least obvious way possible: the local
# `cloudflared` process stays alive and healthy-looking while the PUBLIC
# hostname stops resolving (NXDOMAIN). So `pgrep cloudflared` says "fine"
# while every Edge Function call from Supabase fails DNS.
#
# That matters because the app's server-side models are `local/…` ids pointing
# at this tunnel. When it dies, _shared/llm.ts's fallback chain quietly reroutes
# to DeepSeek — the app keeps working, so nothing looks broken, and you just
# start paying for inference that was supposed to be free. The only visible
# symptom is a `deepseek-chat` row in llm_usage where a `local/…` row belongs.
#
# WHAT IT CHECKS, AND WHY THAT SPECIFIC THING
# It polls healthCheck's `local_fleet` probe rather than curling the tunnel
# from this machine. That is deliberate: the failure mode is "Supabase's edge
# can't resolve this hostname", and this laptop's resolver is not a witness to
# that. healthCheck runs *inside* Supabase, so it sees exactly what llmProxy
# sees. A local curl would have reported the tunnel healthy through the second
# outage of the session.
#
# RECYCLE = restart tunnel-lmstudio.sh, read the new hostname, push it to
# OPENAI_COMPATIBLE_BASE_URL, then wait for DNS to propagate before believing
# it worked (a fresh trycloudflare hostname took ~25-45s to become resolvable
# from Supabase's edge — declaring success immediately reports a false failure).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF_OVERRIDE:-bwjfglerixssibenkjse}"
HEALTH_URL="https://${PROJECT_REF}.supabase.co/functions/v1/healthCheck"

CHECK_INTERVAL="${CHECK_INTERVAL:-60}"     # seconds between health polls
FAIL_THRESHOLD="${FAIL_THRESHOLD:-2}"      # consecutive failures before recycling
PROPAGATION_TRIES="${PROPAGATION_TRIES:-10}"   # health polls to allow after a recycle
PROPAGATION_WAIT="${PROPAGATION_WAIT:-15}"     # seconds between those polls
LOCKFILE="/tmp/rx-tunnel-supervisor.lock"

# cloudflared lives in ~/.local/bin, which a non-interactive shell won't have.
export PATH="$HOME/.local/bin:$PATH"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# Single instance — two supervisors would fight over the same tunnel, each
# recycling the hostname the other just published.
if [[ -e "$LOCKFILE" ]] && kill -0 "$(cat "$LOCKFILE" 2>/dev/null)" 2>/dev/null; then
  log "another supervisor is already running (pid $(cat "$LOCKFILE")) — exiting"
  exit 1
fi
echo $$ > "$LOCKFILE"

cleanup() {
  log "supervisor stopping — leaving the tunnel running"
  rm -f "$LOCKFILE"
}
trap cleanup EXIT INT TERM

require_token() {
  SUPABASE_ACCESS_TOKEN="$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local 2>/dev/null | cut -d= -f2- | tr -d '"'"'"' \r\n')"
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    log "FATAL: SUPABASE_ACCESS_TOKEN not found in .env.local — cannot update the secret on recycle"
    exit 1
  fi
  export SUPABASE_ACCESS_TOKEN
}

# true when Supabase itself can reach the fleet.
fleet_healthy() {
  curl -s -m 45 "$HEALTH_URL" 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const c = JSON.parse(s).checks.local_fleet;
        process.exit(c && c.ok ? 0 : 1);
      } catch { process.exit(1); }
    });
  ' 2>/dev/null
}

lmstudio_up() { curl -sf -m 5 "http://localhost:1234/v1/models" >/dev/null 2>&1; }

recycle() {
  log "RECYCLE: restarting the tunnel"
  pkill -f 'cloudflared tunnel' 2>/dev/null
  pkill -f 'lmstudio-gateway.mjs' 2>/dev/null
  sleep 3

  local logfile; logfile="$(mktemp -t rx-tunnel)"
  nohup "$REPO_ROOT/scripts/tunnel-lmstudio.sh" >"$logfile" 2>&1 &

  # Read the hostname off tunnel-lmstudio.sh's own "Tunnel live:" banner, not
  # off any trycloudflare.com string in the log. cloudflared's control-plane
  # endpoint `api.trycloudflare.com` appears in that same output, and a loose
  # match happily picked it up and published it as the tunnel — a URL that
  # answers 405 to everything, which is how a "recovered" tunnel ended up
  # pointing Supabase at Cloudflare's API for ~2h.
  local url=""
  for _ in $(seq 1 150); do
    url="$(grep -oE 'Tunnel live: +https://[a-zA-Z0-9_-]+\.trycloudflare\.com' "$logfile" 2>/dev/null \
             | grep -oE 'https://[a-zA-Z0-9_-]+\.trycloudflare\.com' | head -1)"
    [[ -n "$url" ]] && break
    grep -q '❌' "$logfile" 2>/dev/null && { log "RECYCLE FAILED: $(grep '❌' "$logfile" | head -1)"; return 1; }
    sleep 1
  done
  [[ -z "$url" ]] && { log "RECYCLE FAILED: no tunnel URL after 150s"; return 1; }
  if [[ "$url" == "https://api.trycloudflare.com" ]]; then
    log "RECYCLE FAILED: parsed the control-plane endpoint, not a tunnel hostname"
    return 1
  fi
  log "new hostname: $url"

  # Prove the hostname actually serves OUR gateway before it goes anywhere near
  # the secret. A wrong URL in OPENAI_COMPATIBLE_BASE_URL breaks every
  # server-side LLM call until a human notices, so publishing an unverified one
  # is worse than staying down: at least a down tunnel fails over to cloud.
  #
  # Retried, not one-shot: a brand-new hostname is not resolvable immediately
  # even from this machine (observed ~1-3 min of curl exit 6 / HTTP 000 while
  # `host` already answered). A single probe would reject a perfectly good
  # tunnel and abort every recycle.
  local secret; secret="$(cat "$REPO_ROOT/.lmstudio-tunnel.local" 2>/dev/null)"
  local probe="000"
  for _ in $(seq 1 12); do
    probe="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$url/v1/models" -H "Authorization: Bearer $secret" 2>/dev/null)"
    [[ "$probe" == "200" ]] && break
    sleep 15
  done
  if [[ "$probe" != "200" ]]; then
    log "RECYCLE FAILED: $url did not serve the gateway (last HTTP $probe) — secret left untouched"
    return 1
  fi
  log "verified $url serves the gateway (HTTP 200)"

  require_token
  if ! supabase secrets set --project-ref "$PROJECT_REF" \
        OPENAI_COMPATIBLE_BASE_URL="$url/v1" >/dev/null 2>&1; then
    log "RECYCLE FAILED: could not update OPENAI_COMPATIBLE_BASE_URL"
    return 1
  fi
  log "secret updated — waiting for DNS to propagate to Supabase's edge"

  for i in $(seq 1 "$PROPAGATION_TRIES"); do
    sleep "$PROPAGATION_WAIT"
    if fleet_healthy; then
      log "RECOVERED: local fleet reachable again (after ${i} check(s))"
      return 0
    fi
    log "  not yet resolvable (${i}/${PROPAGATION_TRIES})"
  done
  log "RECYCLE INCOMPLETE: tunnel is up but Supabase still can't resolve it"
  return 1
}

require_token
log "supervisor started — polling every ${CHECK_INTERVAL}s, recycling after ${FAIL_THRESHOLD} consecutive failures"
log "watching: $HEALTH_URL (local_fleet)"

fails=0
while true; do
  if ! lmstudio_up; then
    # Nothing to publish. Recycling the tunnel cannot fix a stopped LM Studio,
    # and doing it anyway would burn a hostname per minute for no reason.
    log "LM Studio is not running on :1234 — skipping (start it; no recycle attempted)"
    fails=0
  elif fleet_healthy; then
    [[ $fails -gt 0 ]] && log "recovered on its own"
    fails=0
  else
    fails=$((fails + 1))
    log "local_fleet unhealthy (${fails}/${FAIL_THRESHOLD})"
    if [[ $fails -ge $FAIL_THRESHOLD ]]; then
      if recycle; then fails=0; else
        # Back off after a failed recycle so a persistent outage (LM Studio
        # wedged, Cloudflare down, network gone) doesn't spin hostnames.
        log "backing off 5 minutes after a failed recycle"
        sleep 300
        fails=0
      fi
    fi
  fi
  sleep "$CHECK_INTERVAL"
done
