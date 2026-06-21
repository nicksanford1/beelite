#!/usr/bin/env bash
#
# One-command production deploy for the Elite Installation Services site.
#
#   npm run deploy
#
# What it does, in order, and STOPS on the first failure:
#   1. Type-checks (catches errors `next dev` silently ignores)
#   2. Builds locally from a clean .next (so the build can't fail on Vercel
#      for something we didn't see locally)
#   3. Deploys to production with --force (never reuse a stale build cache)
#   4. Verifies the live site is serving the exact build we just made, by
#      checking the homepage references the CSS hash from our local build
#
set -euo pipefail
cd "$(dirname "$0")/.."

SCOPE="eliteinstall"
ALIAS="https://beelite-eliteinstall.vercel.app"

# --- Load the Vercel token (kept out of git in .vercel.token) ---------------
if [ -f .vercel.token ]; then
  set -a; . ./.vercel.token; set +a
fi
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "✗ VERCEL_TOKEN not set. Put it in .vercel.token as: VERCEL_TOKEN=vcp_..." >&2
  exit 1
fi

echo "▶ 1/4  Type-checking…"
npm run typecheck

echo "▶ 2/4  Building locally from a clean .next…"
# A running `next dev` writes into .next and collides with the clean build.
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
rm -rf .next
npm run build

# The largest CSS file is globals.css — its content hash changes whenever our
# styles change, so it's the marker that proves the live site is fresh.
LOCAL_CSS="$(basename "$(ls -S .next/static/css/*.css | head -1)")"
echo "        local build marker: $LOCAL_CSS"

echo "▶ 3/4  Deploying to production (forced, no cache)…"
npx vercel deploy --prod --yes --force --scope "$SCOPE" --token "$VERCEL_TOKEN"

echo "▶ 4/4  Verifying the live site…"
for i in 1 2 3 4 5 6; do
  HTML="$(curl -s "$ALIAS/")"
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$ALIAS/")"
  if echo "$HTML" | grep -q "$LOCAL_CSS"; then
    echo "✅ Live ($CODE) and serving the build you just made."
    echo "   $ALIAS"
    exit 0
  fi
  echo "        attempt $i: live=$CODE, build not visible yet, waiting…"
  sleep 5
done

echo "⚠️  Deploy finished but the live homepage still doesn't reference"
echo "    $LOCAL_CSS after 30s. The production alias may point at an older"
echo "    deployment, or the CDN is still propagating. Check:"
echo "    npx vercel ls beelite --scope $SCOPE --token \$VERCEL_TOKEN"
exit 1
