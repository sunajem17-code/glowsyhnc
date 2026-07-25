// ─────────────────────────────────────────────────────────────────────────────
// RevenueCat webhook — keeps Supabase's users.is_pro/subscription_tier in sync
// with real entitlement state for native (iOS) subscribers. Before this
// existed, that row was only ever written once, at initial purchase, via
// POST /payments/sync-rc — nothing ever updated it again when a subscription
// later renewed, was cancelled, or expired. That's exactly the gap the
// refreshProStatus() investigation surfaced: the client-side RevenueCat check
// would correctly compute the real current state, only for the second,
// server-side check (reading this permanently-stale row) to overwrite it
// right back.
// ─────────────────────────────────────────────────────────────────────────────
const express = require('express')
const crypto = require('crypto')
const { getUserById, updateUserById, isWebhookProcessed, markWebhookProcessed } = require('../supabase')

const router = express.Router()

// ── Auth ──────────────────────────────────────────────────────────────────────
// RevenueCat webhooks don't support HMAC request signing the way Stripe's do
// (see handleWebhook in payments.js, which verifies a signature over the raw
// body) — the only authenticity mechanism RevenueCat actually offers is a
// fixed secret string you set once in their dashboard (Project Settings →
// Integrations → Webhooks → "Authorization header value"), which they then
// echo back verbatim as the Authorization header on every request. This
// compares it with crypto.timingSafeEqual rather than a plain !== (the
// pattern email-webhooks.js already uses for its own shared-secret check) so
// a byte-by-byte timing attack can't leak the secret one character at a
// time — the most rigorous check available for the weaker primitive
// RevenueCat gives us, matching Stripe's rigor in spirit if not in mechanism.
function isAuthorized(req) {
  const expected = (process.env.REVENUECAT_WEBHOOK_SECRET || '').trim()
  if (!expected) return false
  const provided = (req.headers['authorization'] || '').trim()
  const expectedBuf = Buffer.from(expected)
  const providedBuf = Buffer.from(provided)
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

// Re-verifies a subscriber's actual current entitlement against RevenueCat's
// own REST API — the same call POST /payments/sync-rc already makes to
// verify a fresh purchase. Every event re-checks this instead of branching
// on what each event *type* is supposed to mean, on purpose: CANCELLATION,
// for instance, only means auto-renew was turned off — the user keeps their
// entitlement until the paid period actually ends, which RevenueCat reports
// as a separate EXPIRATION event later. Trying to hand-map every event type
// to "entitled" or "not entitled" risks getting exactly that distinction
// wrong (and revoking access someone already paid for); asking "are they
// actually entitled right now" can't make that mistake, for any event type,
// including ones RevenueCat adds in the future.
async function fetchIsEntitled(appUserId) {
  const rcApiKey = process.env.REVENUECAT_API_KEY
  if (!rcApiKey) throw new Error('REVENUECAT_API_KEY not configured')
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${rcApiKey}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`RevenueCat subscriber lookup failed: HTTP ${res.status}`)
  const data = await res.json()
  const entitlements = data.subscriber?.entitlements ?? {}
  return Object.values(entitlements).some(e => e.expires_date == null || new Date(e.expires_date) > new Date())
}

// ── POST /api/webhooks/revenuecat ─────────────────────────────────────────────
router.post('/revenuecat', async (req, res) => {
  if (!isAuthorized(req)) {
    console.error('[RC Webhook] ❌ Unauthorized — missing or mismatched Authorization header')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const event = req.body?.event
  if (!event) {
    console.error('[RC Webhook] ❌ Missing event payload:', JSON.stringify(req.body))
    return res.status(400).json({ error: 'Missing event' })
  }

  console.log('[RC Webhook] Event type:', event.type, '| id:', event.id, '| app_user_id:', event.app_user_id, '| product:', event.product_id, '| environment:', event.environment)

  // Idempotency — RevenueCat, like Stripe, delivers at-least-once and can redeliver
  if (event.id && await isWebhookProcessed(event.id)) {
    console.log('[RC Webhook] ⏭️  Already processed event id:', event.id, '— skipping')
    return res.json({ received: true })
  }

  const appUserId = event.app_user_id

  // app_user_id is our own Supabase user UUID for any purchase made by a
  // logged-in user — utils/iap.js's initRevenueCat() calls
  // Purchases.logIn({ appUserID: userId }) with that exact UUID as soon as
  // the user authenticates, before onboarding ever reaches a purchase
  // screen (this is also exactly how POST /payments/sync-rc's rcUserId
  // lines up with our own user records — same mapping, no separate lookup
  // table needed). RevenueCat's own anonymous IDs (issued before logIn is
  // ever called) look like "$RCAnonymousID:..." and can't map to a Supabase
  // row — shouldn't happen given this app's flow, but check rather than
  // silently writing to a lookup with a bad key.
  if (!appUserId || appUserId.startsWith('$RCAnonymousID:')) {
    console.warn('[RC Webhook] ⚠️  app_user_id missing or anonymous, cannot map to a Supabase user:', appUserId)
    if (event.id) await markWebhookProcessed(event.id, event.type)
    return res.json({ received: true })
  }

  const user = await getUserById(appUserId).catch(() => null)
  if (!user) {
    console.warn('[RC Webhook] ⚠️  No Supabase user found for app_user_id:', appUserId)
    if (event.id) await markWebhookProcessed(event.id, event.type)
    return res.json({ received: true })
  }

  try {
    const isEntitled = await fetchIsEntitled(appUserId)
    await updateUserById(appUserId, {
      subscription_tier: isEntitled ? 'premium' : 'free',
      is_pro: isEntitled,
    })
    console.log(`[RC Webhook] ✅ userId=${appUserId} → is_pro=${isEntitled} (triggered by ${event.type})`)
  } catch (err) {
    console.error('[RC Webhook] ❌ Failed to verify/update entitlement:', err.message)
    // Don't mark as processed on failure — let RevenueCat's retry redeliver
    return res.status(500).json({ error: 'internal_error' })
  }

  if (event.id) await markWebhookProcessed(event.id, event.type)
  res.json({ received: true })
})

module.exports = router
