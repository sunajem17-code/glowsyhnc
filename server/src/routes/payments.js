const express = require('express')
const Stripe = require('stripe')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById, getSupabase } = require('../supabase')

const router = express.Router()

const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_YOUR_KEY_HERE')

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
  if (!user) return res.status(404).json({ error: 'User not found' })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
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
    res.status(500).json({ error: err.message })
  }
})

// Stripe webhook — activates premium after successful payment
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body)
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
    const userId = event.data.object.metadata?.userId
    if (userId) {
      // Update Supabase (primary) + SQLite (fallback)
      try { await updateUserById(userId, { subscription_tier: 'premium', is_pro: true }) } catch {}
      try { db.prepare("UPDATE users SET subscription_tier = 'premium' WHERE id = ?").run(userId) } catch {}
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const userId = event.data.object.metadata?.userId
    if (userId) {
      try { await updateUserById(userId, { subscription_tier: 'free', is_pro: false }) } catch {}
      try { db.prepare("UPDATE users SET subscription_tier = 'free' WHERE id = ?").run(userId) } catch {}
    }
  }

  res.json({ received: true })
})

// Open Stripe Customer Portal (manage/cancel subscription)
router.post('/portal', authMiddleware, async (req, res) => {
  let user = await getUserById(req.userId)
  if (!user) user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  try {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 })
    if (!customers.data.length) return res.status(404).json({ error: 'No billing record found' })

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
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
  res.json({ isPremium: tier === 'premium' })
})

module.exports = router
