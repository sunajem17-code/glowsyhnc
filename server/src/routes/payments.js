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
  const { plan } = req.body // 'monthly' | 'annual'
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
        trial_period_days: 7,
        metadata: { userId: user.id, plan },
      },
      metadata: { userId: user.id, plan },
      success_url: `${process.env.CLIENT_URL || 'https://glowsyhnc.vercel.app'}/payment-success`,
      cancel_url:  `${process.env.CLIENT_URL || 'https://glowsyhnc.vercel.app'}/premium`,
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[Stripe] checkout error:', err.type, err.code, err.message)
    console.error('[Stripe] price used:', PRICES[plan])
    res.status(500).json({ error: err.message, type: err.type, code: err.code })
  }
})

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
    const userId = session.metadata?.userId
    const customerEmail = session.customer_details?.email || session.customer_email || '(none)'
    const subscriptionId = session.subscription || null
    console.log('[Webhook] checkout.session.completed')
    console.log('[Webhook]   userId from metadata:', userId)
    console.log('[Webhook]   customer email:', customerEmail)
    console.log('[Webhook]   subscriptionId:', subscriptionId)
    console.log('[Webhook]   full metadata:', JSON.stringify(session.metadata))

    if (userId) {
      // Update Supabase
      try {
        const result = await updateUserById(userId, {
          subscription_tier: 'premium',
          is_pro: true,
          stripe_subscription_id: subscriptionId,
        })
        console.log('[Webhook] ✅ Supabase update SUCCESS for userId:', userId)
        console.log('[Webhook]   Supabase result:', JSON.stringify(result))
      } catch (e) {
        console.error('[Webhook] ❌ Supabase update FAILED:', e.message)
        console.error('[Webhook]   Full error:', e)
      }
      // Update SQLite
      try {
        db.prepare("UPDATE users SET subscription_tier = 'premium', stripe_subscription_id = ? WHERE id = ?")
          .run(subscriptionId, userId)
        console.log('[Webhook] ✅ SQLite update done')
      } catch (e) {
        console.error('[Webhook] SQLite update failed (non-critical):', e.message)
      }
    } else {
      console.error('[Webhook] ❌ NO userId in session metadata — cannot activate premium!')
      console.error('[Webhook]   session.id:', session.id)
      console.error('[Webhook]   session.customer:', session.customer)
      console.error('[Webhook]   All metadata:', JSON.stringify(session.metadata))
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object
    console.log('[Webhook] invoice.payment_succeeded | invoice.id:', invoice.id)
    let userId = invoice.metadata?.userId
    console.log('[Webhook]   userId from invoice metadata:', userId)
    if (!userId && invoice.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription)
        userId = sub.metadata?.userId
        console.log('[Webhook]   userId from subscription metadata:', userId)
      } catch (e) { console.error('[Webhook] sub lookup failed:', e.message) }
    }
    if (userId) {
      try {
        await updateUserById(userId, { subscription_tier: 'premium', is_pro: true })
        console.log('[Webhook] ✅ Supabase updated (invoice) for userId:', userId)
      } catch (e) { console.error('[Webhook] ❌ Supabase update failed (invoice):', e.message) }
      try { db.prepare("UPDATE users SET subscription_tier = 'premium' WHERE id = ?").run(userId) } catch {}
    } else {
      console.error('[Webhook] ❌ Could not find userId for invoice:', invoice.id)
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
      return_url: `${process.env.CLIENT_URL || 'https://glowsyhnc.vercel.app'}/profile`,
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
