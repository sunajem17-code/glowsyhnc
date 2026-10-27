const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById, getSupabase, isConfigured, isWebhookProcessed, markWebhookProcessed } = require('../supabase')
const { authenticatedRevenueCatUserId } = require('../utils/revenueCatIdentity')

// NOTE: This endpoint is for web purchases only.
// iOS uses Apple In-App Purchases via RevenueCat (@revenuecat/purchases-capacitor).
// Do NOT call these endpoints from the iOS app — Apple will reject the app.
const router = express.Router()

if (!process.env.STRIPE_SECRET_KEY) console.warn('[Stripe] STRIPE_SECRET_KEY env var is not set — Stripe payment endpoints will be unavailable.')
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 1,
    })
  : null

const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
  annual:  process.env.STRIPE_PRICE_ANNUAL  || 'price_annual_placeholder',
}

// Create Stripe Checkout session
router.post('/create-checkout', authMiddleware, async (req, res) => {
  const { plan } = req.body // plan: 'monthly' | 'annual'
  if (!PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' })

  // Fail fast with a clear log if the real price ID was never configured —
  // this used to reach Stripe, fail with an opaque API error, and surface a
  // raw 'internal_error' code straight to the user.
  if (PRICES[plan].endsWith('_placeholder')) {
    console.error(`[Stripe] STRIPE_PRICE_${plan.toUpperCase()} env var is not set — checkout cannot run until it's configured.`)
    return res.status(500).json({ error: 'Checkout is temporarily unavailable. Please try again later.' })
  }

  // Look up user in Supabase (primary) or SQLite (fallback)
  let user = await getUserById(req.userId)
  if (!user && !isConfigured()) user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.userId)
  // Fallback: if account was lost, use email from JWT
  if (!user && req.userEmail) {
    user = { id: req.userId, email: req.userEmail }
  }
  if (!user) return res.status(404).json({ error: 'Session expired. Please log out and log in again.' })

  try {
    // Get or create a Stripe customer tied to this user
    let customerId = user.stripe_customer_id || null
    if (!customerId) {
      // Check if a customer already exists for this email
      const existing = await stripe.customers.list({ email: user.email, limit: 1 })
      if (existing.data.length) {
        customerId = existing.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        })
        customerId = customer.id
      }
      // Persist stripe_customer_id so we don't create duplicates
      try { await updateUserById(user.id, { stripe_customer_id: customerId }) } catch {}
      if (!isConfigured()) {
        try { db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id) } catch {}
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      subscription_data: {
        metadata: { userId: user.id, plan },
      },
      metadata: { userId: user.id, plan },
      success_url: `${req.headers.origin || process.env.CLIENT_URL || 'https://ascendus.store'}/payment-success`,
      cancel_url:  `${req.headers.origin || process.env.CLIENT_URL || 'https://ascendus.store'}/premium`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe] checkout error:', err.type, err.code, err.message)
    console.error('[Stripe] price used:', PRICES[plan])
    res.status(500).json({ error: 'Unable to start checkout. Please try again.' })
  }
})

// ── Shared userId resolver ────────────────────────────────────────────────────
// Runs the same 4-step fallback chain for any Stripe webhook event.
// Returns { userId: string|null, resolvedBy: string|null }
//
//   Step 1 — metadata.userId       (camelCase — what we set at checkout creation)
//   Step 2 — metadata.user_id      (snake_case — Stripe sometimes normalises keys)
//   Step 3 — customer.metadata.userId / customer.metadata.user_id
//   Step 4 — Supabase users WHERE stripe_customer_id = customerId
//
async function resolveUserId(metadata, customerId) {
  // ── Step 1: metadata.userId ──────────────────────────────────────────────────
  const uid1 = metadata?.userId || null
  if (uid1) {
    console.log('[Webhook] Customer account resolved from checkout metadata')
    return { userId: uid1, resolvedBy: 'metadata.userId' }
  }

  // ── Step 2: metadata.user_id ─────────────────────────────────────────────────
  const uid2 = metadata?.user_id || null
  if (uid2) {
    console.log('[Webhook] Customer account resolved from normalized checkout metadata')
    return { userId: uid2, resolvedBy: 'metadata.user_id' }
  }

  // ── Step 3: Stripe customer metadata ─────────────────────────────────────────
  if (customerId) {
    console.log('[Webhook] Checking customer account metadata')
    try {
      const customer = await stripe.customers.retrieve(customerId)
      const uid3camel = customer.metadata?.userId  || null
      const uid3snake = customer.metadata?.user_id || null
      const uid3 = uid3camel || uid3snake
      if (uid3) {
        const via = uid3camel ? 'customer.metadata.userId' : 'customer.metadata.user_id'
        console.log('[Webhook] Customer account resolved from customer metadata')
        return { userId: uid3, resolvedBy: via }
      }
      console.log('[Webhook] Customer metadata did not identify an account')
    } catch (e) {
      console.error('[Webhook] Customer account lookup failed:', e.type || e.name || 'unknown error')
    }
  } else {
  }

  // ── Step 4: Supabase WHERE stripe_customer_id = customerId ────────────────────
  if (customerId) {
    console.log('[Webhook] Checking customer account link')
    try {
      const supabase = getSupabase()
      if (supabase) {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (!error && data?.id) {
          console.log('[Webhook] Customer account resolved from saved billing link')
          return { userId: data.id, resolvedBy: 'supabase.stripe_customer_id' }
        }
        console.log('[Webhook] No saved billing account link was found')
      } else {
        console.log('[Webhook] Billing account lookup is unavailable')
      }
    } catch (e) {
      console.error('[Webhook] Billing account lookup failed:', e.code || e.name || 'unknown error')
    }
  } else {
  }

  return { userId: null, resolvedBy: null }
}

// ── Stripe webhook handler (exported so index.js can mount at /webhook) ──────
async function handleWebhook(req, res) {
  console.log('=== [Webhook] REQUEST RECEIVED ===')
  const sig = req.headers['stripe-signature']
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()

  // express.raw() sets req.body to a Buffer — that's what constructEvent needs
  console.log('[Webhook] sig present:', !!sig)

  // Reject immediately if webhook secret is not configured — never process unverified events
  if (!secret) {
    console.error('[Webhook] ❌ STRIPE_WEBHOOK_SECRET is not set — refusing unverified webhook')
    return res.status(400).json({ error: 'Webhook not configured' })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
    console.log('[Webhook] ✅ Signature verified')
  } catch (err) {
    console.error('[Webhook] Stripe signature verification failed:', err.type || err.name || 'unknown error')
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  console.log('[Webhook] Event type:', event.type)

  // Idempotency guard — Stripe delivers events at-least-once; skip duplicates
  if (await isWebhookProcessed(event.id)) {
    console.log('[Webhook] Duplicate event ignored')
    return res.json({ received: true })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const subscriptionId = session.subscription || null
    console.log('[Webhook] Checkout event received | hasCustomer:', !!session.customer, '| hasSubscription:', !!subscriptionId)

    const { userId } = await resolveUserId(session.metadata, session.customer)

    if (userId) {
      try {
        await updateUserById(userId, {
          subscription_tier: 'premium',
          is_pro: true,
          stripe_subscription_id: subscriptionId,
        })
        console.log('[Webhook] Supabase subscription updated')
      } catch (e) {
        console.error('[Webhook] Supabase update failed (checkout):', e.code || e.name || 'unknown error')
      }
      if (!isConfigured()) {
        try {
          db.prepare("UPDATE users SET subscription_tier = 'premium', stripe_subscription_id = ? WHERE id = ?")
            .run(subscriptionId, userId)
          console.log('[Webhook] Local billing account updated (checkout)')
        } catch (e) {
          console.error('[Webhook] Local billing update failed:', e.code || e.name || 'unknown error')
        }
      }
    } else {
      console.error('[Webhook] No account matched checkout completion')
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object
    console.log('[Webhook] Invoice payment succeeded')

    const { userId } = await resolveUserId(invoice.metadata, invoice.customer)

    if (userId) {
      try {
        await updateUserById(userId, { subscription_tier: 'premium', is_pro: true })
        console.log('[Webhook] Billing account updated (invoice)')
      } catch (e) {
        console.error('[Webhook] Supabase update failed (invoice):', e.code || e.name || 'unknown error')
      }
      if (!isConfigured()) {
        try {
          db.prepare("UPDATE users SET subscription_tier = 'premium' WHERE id = ?").run(userId)
          console.log('[Webhook] Local billing account updated (invoice)')
        } catch (e) {
          console.error('[Webhook] Local billing update failed:', e.code || e.name || 'unknown error')
        }
      }
    } else {
      console.error('[Webhook] No account matched invoice payment')
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    // Was reading event.data.object.metadata?.userId directly — silently did
    // nothing (user stayed Pro forever) for any subscription where that exact
    // key was missing: legacy subs, dashboard-created subs, or metadata keyed
    // as user_id instead of userId. Use the same 3-step fallback chain
    // (metadata.userId → metadata.user_id → customer.metadata) the other two
    // handlers above already use, so a cancellation can't silently no-op.
    const subscription = event.data.object
    const { userId } = await resolveUserId(subscription.metadata, subscription.customer)
    console.log('[Webhook] Subscription cancellation received')
    if (userId) {
      try { await updateUserById(userId, { subscription_tier: 'free', is_pro: false, stripe_subscription_id: null }) } catch {}
      if (!isConfigured()) {
        try { db.prepare("UPDATE users SET subscription_tier = 'free', stripe_subscription_id = NULL WHERE id = ?").run(userId) } catch {}
      }
    } else {
      console.error('[Webhook] No account matched subscription cancellation')
    }
  }

  // Mark this event as processed so Stripe re-deliveries are skipped
  await markWebhookProcessed(event.id, event.type)

  console.log('=== [Webhook] DONE — responded { received: true } ===')
  res.json({ received: true })
}

// Keep route in this router for /api/payments/webhook (raw body handled in index.js)
router.post('/webhook', handleWebhook)

// Open Stripe Customer Portal (manage/cancel subscription)
router.post('/portal', authMiddleware, async (req, res) => {
  let user = await getUserById(req.userId)
  if (!user && !isConfigured()) user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  try {
    let customerId = user.stripe_customer_id || null
    if (!customerId) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 })
      if (!customers.data.length) return res.status(404).json({ error: 'No billing record found' })
      customerId = customers.data[0].id
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.headers.origin || process.env.CLIENT_URL || 'https://ascendus.store'}/profile`,
    })
    res.json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: 'internal_error' })
  }
})

// Check premium status (called after redirect back from Stripe)
router.get('/status', authMiddleware, async (req, res) => {
  const sbUser = await getUserById(req.userId).catch(() => null)
  let tier = sbUser?.subscription_tier || 'free'
  if (!sbUser && !isConfigured()) {
    const row = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.userId)
    tier = row?.subscription_tier || 'free'
  }
  const isPro = sbUser?.is_pro === true
  res.json({ isPremium: tier === 'premium' || isPro })
})

// Sync RevenueCat iOS purchase to server — called by client after a successful IAP.
// Verifies the subscription is actually active via RevenueCat REST API before granting Pro.
router.post('/sync-rc', authMiddleware, async (req, res) => {
  const rcApiKey = process.env.REVENUECAT_API_KEY
  const rcUserId = authenticatedRevenueCatUserId(req)

  // Server-side verification via RevenueCat REST API
  if (rcApiKey && rcUserId) {
    try {
      const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
        headers: { Authorization: `Bearer ${rcApiKey}`, 'Content-Type': 'application/json' },
      })
      if (!rcRes.ok) {
        console.warn(`[sync-rc] RevenueCat lookup failed: HTTP ${rcRes.status}`)
        return res.status(402).json({ error: 'Could not verify purchase — please restore purchases or contact support.' })
      }
      const data = await rcRes.json()
      const subscriber = data.subscriber
      const entitlements = subscriber?.entitlements ?? {}
      const isPro = Object.values(entitlements).some(e => e.expires_date == null || new Date(e.expires_date) > new Date())
      if (!isPro) {
        console.warn('[sync-rc] No active entitlement')
        return res.status(402).json({ error: 'No active subscription found — please complete your purchase first.' })
      }
      console.log('[sync-rc] RevenueCat verified an active entitlement')
    } catch (err) {
      // If RevenueCat is unreachable, fail safe — do not grant Pro
      console.error(`[sync-rc] RevenueCat verification failed: ${err.name || 'Error'}`)
      return res.status(503).json({ error: 'Purchase verification unavailable — please try again in a moment.' })
    }
  } else {
    // No RC key configured — log loudly but do not grant Pro silently
    console.error('[sync-rc] REVENUECAT_API_KEY not set or rcUserId missing — purchase NOT granted. Set REVENUECAT_API_KEY in Railway.')
    return res.status(503).json({ error: 'Server configuration error — contact support.' })
  }

  // Verified — grant Pro
  try {
    await updateUserById(req.userId, { subscription_tier: 'premium', is_pro: true })
  } catch {
    try {
      db.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1 WHERE id = ?").run(req.userId)
    } catch {}
  }
  res.json({ ok: true })
})

router.handleWebhook = handleWebhook
module.exports = router
