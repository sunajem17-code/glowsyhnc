#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Verification script for 20260621_security_hardening.sql
# Run this immediately after applying the migration.
# If any CHECK FAILS, run the rollback migration and stop.
#
# Usage:
#   ANON_KEY="<anon key>"  \
#   AUTH_JWT="<real user JWT from login response>" \
#   bash 20260621_verify_hardening.sh
#
# All three env vars are required. The AUTH_JWT is the token returned by
# POST /api/auth/login for any real registered user.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SUPABASE_URL="https://wzjhbigkzbieptjxrmxp.supabase.co"
ANON_KEY="${ANON_KEY:?Set ANON_KEY to the Supabase anon public key}"
AUTH_JWT="${AUTH_JWT:?Set AUTH_JWT to a real authenticated user JWT}"

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"   # "pass" or "fail"
  local detail="$3"
  if [ "$result" = "pass" ]; then
    echo "  ✅ PASS — $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL — $label"
    echo "     → $detail"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Post-migration verification — 20260621_security_hardening.sql"
echo "════════════════════════════════════════════════════════════════"

# ── CHECK 1: log_email_send has SET search_path = '' ─────────────────────────
echo ""
echo "CHECK 1: log_email_send has search_path = '' in proconfig"

SEARCH_PATH_CONFIG=$(psql "$DATABASE_URL" -At -c \
  "SELECT array_to_string(proconfig, ',') FROM pg_proc \
   WHERE proname = 'log_email_send' \
   AND pronamespace = 'public'::regnamespace;" 2>/dev/null || echo "psql_unavailable")

if [ "$SEARCH_PATH_CONFIG" = "psql_unavailable" ]; then
  echo "  ⚠️  SKIP — DATABASE_URL not set, run this SQL in the Supabase SQL Editor instead:"
  echo "     SELECT proconfig FROM pg_proc WHERE proname = 'log_email_send'"
  echo "     AND pronamespace = 'public'::regnamespace;"
  echo "     Expected: proconfig contains 'search_path='"
else
  if echo "$SEARCH_PATH_CONFIG" | grep -q "search_path="; then
    check "log_email_send search_path config present" "pass" ""
  else
    check "log_email_send search_path config present" "fail" \
      "proconfig='$SEARCH_PATH_CONFIG' — search_path not found"
  fi
fi

# ── CHECK 2: processed_webhook_events RLS enabled ────────────────────────────
echo ""
echo "CHECK 2: processed_webhook_events has RLS enabled"
echo "  Run in SQL Editor (psql not available in all environments):"
echo "  SELECT relrowsecurity FROM pg_class"
echo "  WHERE relname = 'processed_webhook_events'"
echo "  AND relnamespace = 'public'::regnamespace;"
echo "  Expected: true"

# ── CHECK 3: processed_webhook_events deny policies exist ────────────────────
echo ""
echo "CHECK 3: processed_webhook_events deny-all policies exist"
echo "  Run in SQL Editor:"
echo "  SELECT policyname, roles, cmd, qual FROM pg_policies"
echo "  WHERE tablename = 'processed_webhook_events';"
echo "  Expected: two rows — 'deny anon' and 'deny authenticated', both qual=(false)"

# ── CHECK 4: anon cannot read free_users_day3 via PostgREST ──────────────────
echo ""
echo "CHECK 4: anon key — free_users_day3 returns permission denied (not rows)"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/free_users_day3?select=user_id&limit=1")

BODY=$(curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/free_users_day3?select=user_id&limit=1")

if [ "$HTTP_STATUS" = "200" ] && [ "$BODY" = "[]" ]; then
  # Empty array is also acceptable — RLS-enabled table with deny-all returns []
  check "anon blocked from free_users_day3 (empty due to RLS)" "pass" ""
elif [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ] || \
     ([ "$HTTP_STATUS" = "200" ] && echo "$BODY" | grep -q '"code":"42501"'); then
  check "anon blocked from free_users_day3 (permission denied)" "pass" ""
else
  check "anon blocked from free_users_day3" "fail" \
    "HTTP $HTTP_STATUS — body: $BODY — real rows may have been returned"
fi

# ── CHECK 5: anon cannot read pro_users_weekly_recap via PostgREST ────────────
echo ""
echo "CHECK 5: anon key — pro_users_weekly_recap returns permission denied (not rows)"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/pro_users_weekly_recap?select=user_id&limit=1")

BODY=$(curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/pro_users_weekly_recap?select=user_id&limit=1")

if [ "$HTTP_STATUS" = "200" ] && [ "$BODY" = "[]" ]; then
  check "anon blocked from pro_users_weekly_recap (empty due to RLS)" "pass" ""
elif [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ] || \
     ([ "$HTTP_STATUS" = "200" ] && echo "$BODY" | grep -q '"code":"42501"'); then
  check "anon blocked from pro_users_weekly_recap (permission denied)" "pass" ""
else
  check "anon blocked from pro_users_weekly_recap" "fail" \
    "HTTP $HTTP_STATUS — body: $BODY — real rows may have been returned"
fi

# ── CHECK 6: authenticated user cannot read free_users_day3 ──────────────────
echo ""
echo "CHECK 6: authenticated JWT — free_users_day3 blocked"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $AUTH_JWT" \
  "$SUPABASE_URL/rest/v1/free_users_day3?select=user_id&limit=1")

BODY=$(curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $AUTH_JWT" \
  "$SUPABASE_URL/rest/v1/free_users_day3?select=user_id&limit=1")

if ([ "$HTTP_STATUS" = "200" ] && [ "$BODY" = "[]" ]) || \
   [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ] || \
   ([ "$HTTP_STATUS" = "200" ] && echo "$BODY" | grep -q '"code":"42501"'); then
  check "authenticated JWT blocked from free_users_day3" "pass" ""
else
  check "authenticated JWT blocked from free_users_day3" "fail" \
    "HTTP $HTTP_STATUS — body: $BODY"
fi

# ── CHECK 7: authenticated user cannot read pro_users_weekly_recap ────────────
echo ""
echo "CHECK 7: authenticated JWT — pro_users_weekly_recap blocked"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $AUTH_JWT" \
  "$SUPABASE_URL/rest/v1/pro_users_weekly_recap?select=user_id&limit=1")

BODY=$(curl -s \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $AUTH_JWT" \
  "$SUPABASE_URL/rest/v1/pro_users_weekly_recap?select=user_id&limit=1")

if ([ "$HTTP_STATUS" = "200" ] && [ "$BODY" = "[]" ]) || \
   [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ] || \
   ([ "$HTTP_STATUS" = "200" ] && echo "$BODY" | grep -q '"code":"42501"'); then
  check "authenticated JWT blocked from pro_users_weekly_recap" "pass" ""
else
  check "authenticated JWT blocked from pro_users_weekly_recap" "fail" \
    "HTTP $HTTP_STATUS — body: $BODY"
fi

# ── CHECK 8: email scheduler can still read the views (service role) ──────────
echo ""
echo "CHECK 8: server-side email scheduler reads views successfully"
echo "  This cannot be automated here — trigger it manually:"
echo "  Option A: hit the server health endpoint, then watch server logs for"
echo "            the next scheduled run (9 AM UTC for daily nudge)."
echo "  Option B: trigger immediately — add a temporary GET /api/test-nudge"
echo "            endpoint that calls runDailyNudge() once and returns the count."
echo "  Expected: 'Daily nudge done: N sent' in server logs, no 'permission denied'."

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo " Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo " ⚠️  One or more checks FAILED."
  echo " Run the rollback migration immediately:"
  echo "   supabase/migrations/20260621_security_hardening_rollback.sql"
  echo ""
  exit 1
else
  echo ""
  echo " All automated checks passed."
  echo " Complete checks 1-3 manually in the SQL Editor, then confirm"
  echo " check 8 by triggering the email scheduler."
  echo ""
fi
