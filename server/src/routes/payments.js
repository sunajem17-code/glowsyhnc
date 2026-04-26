const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById, getSupabase } = require('../supabase')

const router = express.Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE', {
  httpClient: Stripe.createFetchHttpClient(),
  maxNetworkRetries: 1,
})

const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_monthly_placeholder',
  annual:  process.env.STRIPE_PRICE_ANNUAL  || 'price_annual_placeholder',
}

// Create Stripe Checkout session
router.post('/create-checkout', authMiddleware, async (req, res) => {
  const { plan, noTrial } = req.body // plan: 'monthly' | 'annual', noTrial: bool
  if (!PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' })

  // Look up user in Supabase (primary) or SQLite (fallback)
  let user = await getUserById(req.userId)
  if (!user) user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.userId)
  // Fallback: if account was lost (SQLite wipe before Supabase migration), use email from JWT
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
      try { db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id) } catch {}
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      subscription_data: {
        ...(noTrial ? {} : { trial_period_days: 2 }),
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
    res.status(500).json({ error: err.message, type: err.type, code: err.code })
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
    console.log('[Webhook]   ✅ Step 1 — userId from metadata.userId:', uid1)
    return { userId: uid1, resolvedBy: 'metadata.userId' }
  }
  console.log('[Webhook]   ⬜ Step 1 — no userId in metadata.userId')

  // ── Step 2: metadata.user_id ─────────────────────────────────────────────────
  const uid2 = metadata?.user_id || null
  if (uid2) {
    console.log('[Webhook]   ✅ Step 2 — userId from metadata.user_id:', uid2)
    return { userId: uid2, resolvedBy: 'metadata.user_id' }
  }
  console.log('[Webhook]   ⬜ Step 2 — no userId in metadata.user_id')

  // ── Step 3: Stripe customer metadata ─────────────────────────────────────────
  if (customerId) {
    console.log('[Webhook]   🔍 Step 3 — fetching Stripe customer:', customerId)
    try {
      const customer = await stripe.customers.retrieve(customerId)
      const uid3camel = customer.metadata?.userId  || null
      const uid3snake = customer.metadata?.user_id || null
      const uid3 = uid3camel || uid3snake
      if (uid3) {
        const via = uid3camel ? 'customer.metadata.userId' : 'customer.metadata.user_id'
        console.log(`[Webhook]   ✅ Step 3 — userId from ${via}:`, uid3)
        return { userId: uid3, resolvedBy: via }
      }
      console.log('[Webhook]   ⬜ Step 3 — no userId/user_id in customer metadata:', JSON.stringify(customer.metadata))
    } catch (e) {
      console.error('[Webhook]   ❌ Step 3 — customer fetch failed:', e.message)
    }
  } else {
    console.log('[Webhook]   ⬜ Step 3 — skipped (no customerId)')
  }

  // ── Step 4: Supabase WHERE stripe_customer_id = customerId ────────────────────
  if (customerId) {
    console.log('[Webhook]   🔍 Step 4 — querying Supabase by stripe_customer_id:', customerId)
    try {
      const supabase = getSupabase()
      if (supabase) {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (!error && data?.id) {
          console.log('[Webhook]   ✅ Step 4 — userId from Supabase by stripe_customer_id:', data.id)
          return { userId: data.id, resolvedBy: 'supabase.stripe_customer_id' }
        }
        console.log('[Webhook]   ⬜ Step 4 — no Supabase match:', error?.message || 'no row found')
      } else {
        console.log('[Webhook]   ⬜ Step 4 — Supabase not configured')
      }
    } catch (e) {
      console.error('[Webhook]   ❌ Step 4 — Supabase lookup failed:', e.message)
    }
  } else {
    console.log('[Webhook]   ⬜ Step 4 — skipped (no customerId)')
  }

  return { userId: null, resolvedBy: null }
}

// ── Stripe webhook handler (exported so index.js can mount at /webhook) ──────
async function handleWebhook(req, res) {
  console.log('=== [Webhook] REQUEST RECEIVED ===')
  console.log('[Webhook] URL:', req.originalUrl)
  console.log('[Webhook] rawBody present:', !!req.rawBody, '| is Buffer:', Buffer.isBuffer(req.rawBody), '| length:', req.rawBody?.length)
  const sig = req.headers['stripe-signature']
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim()

  // express.raw() sets req.body to a Buffer — that's what constructEvent needs
  console.log('[Webhook] sig present:', !!sig)
  console.log('[Webhook] secret length:', secret.length, '| starts:', secret.slice(0, 12))
  console.log('[Webhook] body is Buffer:', Buffer.isBuffer(req.body), '| length:', req.body?.length)

  let event
  try {
    if (secret) {
      event = stripe.webhooks.constructEvent(req.body, sig, secret)
      console.log('[Webhook] ✅ Signature verified')
    } else {
      event = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body
      console.warn('[Webhook] ⚠️  No STRIPE_WEBHOOK_SECRET — skipping sig verification')
    }
  } catch (err) {
    console.error('[Webhook] ❌ Signature verification FAILED:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  console.log('[Webhook] Event type:', event.type, '| Event id:', event.id)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const subscriptionId = session.subscription || null
    const customerEmail  = session.customer_details?.email || session.customer_email || '(none)'
    console.log('[Webhook] checkout.session.completed | session.id:', session.id)
    console.log('[Webhook]   customer:', session.customer, '| email:', customerEmail)
    console.log('[Webhook]   subscriptionId:', subscriptionId)
    console.log('[Webhook]   session.metadata:', JSON.stringify(session.metadata))

    const { userId, resolvedBy } = await resolveUserId(session.metadata, session.customer)

    if (userId) {
      console.log('[Webhook]   userId resolved via:', resolvedBy)
      try {
        await updateUserById(userId, {
          subscription_tier: 'premium',
          is_pro: true,
          stripe_subscription_id: subscriptionId,
        })
        console.log('[Webhook] ✅ Supabase updated (checkout) for userId:', userId)
      } catch (e) {
        console.error('[Webhook] ❌ Supabase update failed (checkout):', e.message)
      }
      try {
        db.prepare("UPDATE users SET subscription_tier = 'premium', stripe_subscription_id = ? WHERE id = ?")
          .run(subscriptionId, userId)
        console.log('[Webhook] ✅ SQLite updated (checkout) for userId:', userId)
      } catch (e) {
        console.error('[Webhook] SQLite update failed (non-critical):', e.message)
      }
    } else {
      console.error('[Webhook] ❌ All 4 fallbacks exhausted for checkout.session.completed — full session object:')
      console.error(JSON.stringify(session, null, 2))
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object
    console.log('[Webhook] invoice.payment_succeeded | invoice.id:', invoice.id)
    console.log('[Webhook]   invoice.customer:', invoice.customer)
    console.log('[Webhook]   invoice.subscription:', invoice.subscription)
    console.log('[Webhook]   invoice.metadata:', JSON.stringify(invoice.metadata))

    const { userId, resolvedBy } = await resolveUserId(invoice.metadata, invoice.customer)

    if (userId) {
      console.log('[Webhook]   userId resolved via:', resolvedBy)
      try {
        await updateUserById(userId, { subscription_tier: 'premium', is_pro: true })
        console.log('[Webhook] ✅ Supabase updated (invoice) for userId:', userId)
      } catch (e) {
        console.error('[Webhook] ❌ Supabase update failed (invoice):', e.message)
      }
      try {
        db.prepare("UPDATE users SET subscription_tier = 'premium' WHERE id = ?").run(userId)
        console.log('[Webhook] ✅ SQLite updated (invoice) for userId:', userId)
      } catch (e) {
        console.error('[Webhook] SQLite update failed (non-critical):', e.message)
      }
    } else {
      console.error('[Webhook] ❌ All 4 fallbacks exhausted for invoice.payment_succeeded — full invoice object:')
      console.error(JSON.stringify(invoice, null, 2))
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = event.data.object.metadata?.userId
    console.log('[Webhook] subscription.deleted userId:', userId)
    if (userId) {
      try { await updateUserById(userId, { subscription_tier: 'free', is_pro: false, stripe_subscription_id: null }) } catch {}
      try { db.prepare("UPDATE users SET subscription_tier = 'free', stripe_subscription_id = NULL WHERE id = ?").run(userId) } catch {}
    }
  }

  console.log('=== [Webhook] DONE — responded { received: true } ===')
  res.json({ received: true })
}

// Keep route in this router for /api/payments/webhook (raw body handled in index.js)
router.post('/webhook', handleWebhook)

// Open Stripe Customer Portal (manage/cancel subscription)
router.post('/portal', authMiddleware, async (req, res) => {
  let user = await getUserById(req.userId)
  if (!user) user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId)
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
    res.status(500).json({ error: err.message })
  }
})

// Check premium status (called after redirect back from Stripe)
router.get('/status', authMiddleware, async (req, res) => {
  let tier = 'free'
  const sbUser = await getUserById(req.userId).catch(() => null)
  if (sbUser) {
    tier = sbUser.subscription_tier || 'free'
  } else {
    const row = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.userId)
    tier = row?.subscription_tier || 'free'
  }
  const isPro = sbUser?.is_pro === true
  res.json({ isPremium: tier === 'premium' || isPro })
})

router.handleWebhook = handleWebhook
module.exports = router
