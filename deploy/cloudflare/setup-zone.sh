#!/usr/bin/env bash
# One-off zone setup for NewsMapp (ADR 0007). Idempotent: every call replaces the same rules.
#
#   1. Cache Rule: bypass cache on /api/*, /go/*, /admin* (dynamic, per-request responses).
#   2. WAF rate limit on /api/* (webhooks excluded: LemonSqueezy retries must not be blocked).
#   3. Bot Fight Mode on.
#   4. Cloudflare Access application for /admin* and /api/admin/* (only if ADMIN_EMAIL is set).
#
# Usage (owner, from the repo root):
#   ZONE_ID=... ACCOUNT_ID=... DOMAIN=example.com ADMIN_EMAIL=you@example.com \
#     ./deploy/cloudflare/setup-zone.sh            # applies
#   DRY_RUN=1 DOMAIN=example.com ./deploy/cloudflare/setup-zone.sh   # prints the payloads only
#
# The API token is read from a hidden prompt (never pass it as an argument). Create a temporary
# token with: Zone → Cache Rules Edit, Zone WAF Edit, Zone Settings Edit, Bot Management Edit
# (zone: your domain only) and Account → Access: Apps and Policies Edit. Delete it afterwards.
set -euo pipefail

DOMAIN="${DOMAIN:?set DOMAIN, e.g. DOMAIN=example.com}"
DRY_RUN="${DRY_RUN:-0}"
API="https://api.cloudflare.com/client/v4"

# Free plan: one rate-limiting rule, 10 s period, 10 s block. 30 requests / 10 s per IP and colo
# is well above a real visitor; the Worker also limits per IP (FORM_LIMITER, CLICK_LIMITER).
RATE_REQUESTS="${RATE_REQUESTS:-30}"

cache_rules=$(jq -n '{
  rules: [{
    description: "NewsMapp: never cache dynamic routes",
    expression: "starts_with(http.request.uri.path, \"/api/\") or starts_with(http.request.uri.path, \"/go/\") or starts_with(http.request.uri.path, \"/admin\")",
    action: "set_cache_settings",
    action_parameters: { cache: false }
  }]
}')

rate_limit=$(jq -n --argjson n "$RATE_REQUESTS" '{
  rules: [{
    description: "NewsMapp: rate limit /api/* (webhooks excluded)",
    expression: "starts_with(http.request.uri.path, \"/api/\") and not starts_with(http.request.uri.path, \"/api/webhooks/\")",
    action: "block",
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period: 10,
      requests_per_period: $n,
      mitigation_timeout: 10
    }
  }]
}')

bot_fight='{"fight_mode": true}'

access_app=$(jq -n --arg d "$DOMAIN" --arg e "${ADMIN_EMAIL:-owner@example.com}" '{
  name: "NewsMapp admin",
  type: "self_hosted",
  domain: ($d + "/admin"),
  destinations: [
    { type: "public", uri: ($d + "/admin") },
    { type: "public", uri: ($d + "/api/admin") }
  ],
  session_duration: "24h",
  app_launcher_visible: false,
  policies: [{
    name: "Owner only",
    decision: "allow",
    include: [{ email: { email: $e } }]
  }]
}')

if [[ "$DRY_RUN" == "1" ]]; then
  printf '## PUT zones/<ZONE_ID>/rulesets/phases/http_request_cache_settings/entrypoint\n%s\n' "$cache_rules"
  printf '## PUT zones/<ZONE_ID>/rulesets/phases/http_ratelimit/entrypoint\n%s\n' "$rate_limit"
  printf '## PUT zones/<ZONE_ID>/bot_management\n%s\n' "$bot_fight"
  printf '## POST|PUT accounts/<ACCOUNT_ID>/access/apps\n%s\n' "$access_app"
  exit 0
fi

ZONE_ID="${ZONE_ID:?set ZONE_ID (Dashboard → your domain → Overview → API)}"
read -rsp 'Cloudflare API token (input hidden): ' TOKEN
echo

call() { # method path [json]
  local response
  response=$(curl -sS -X "$1" "$API/$2" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    ${3:+--data "$3"})
  if [[ "$(jq -r '.success' <<<"$response")" != "true" ]]; then
    echo "FAILED $1 $2: $(jq -c '.errors' <<<"$response")" >&2
    return 1
  fi
  printf '%s' "$response"
}

call PUT "zones/<ZONE_ID>/rulesets/phases/http_request_cache_settings/entrypoint" "$cache_rules" >/dev/null
echo 'OK  Cache Rule: bypass /api/*, /go/*, /admin*'
call PUT "zones/<ZONE_ID>/rulesets/phases/http_ratelimit/entrypoint" "$rate_limit" >/dev/null
echo "OK  Rate limit: $RATE_REQUESTS req / 10 s per IP on /api/* (webhooks excluded)"
call PUT "zones/<ZONE_ID>/bot_management" "$bot_fight" >/dev/null
echo 'OK  Bot Fight Mode on (check webhook deliveries afterwards, see docs/runbooks/deploy.md)'

if [[ -n "${ADMIN_EMAIL:-}" ]]; then
  ACCOUNT_ID="${ACCOUNT_ID:?set ACCOUNT_ID to create the Access application}"
  existing=$(call GET "accounts/<ACCOUNT_ID>/access/apps" |
    jq -r '.result[] | select(.name == "NewsMapp admin" or .name == "NewsMap admin") | .id' | head -1)
  if [[ -n "$existing" ]]; then
    app=$(call PUT "accounts/<ACCOUNT_ID>/access/apps/$existing" "$access_app")
  else
    app=$(call POST "accounts/<ACCOUNT_ID>/access/apps" "$access_app")
  fi
  echo 'OK  Access application "NewsMapp admin" protects /admin* and /api/admin/*'
  echo "    Set it on the Worker: wrangler secret put CF_ACCESS_AUD   (value: $(jq -r '.result.aud' <<<"$app"))"
  echo '    and: wrangler secret put CF_ACCESS_TEAM_DOMAIN   (value: <team>.cloudflareaccess.com)'
else
  echo 'SKIP Access application (set ADMIN_EMAIL to create it)'
fi
