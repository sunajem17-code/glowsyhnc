// RevenueCat lookup is always scoped to the authenticated application account.
const ENTITLEMENT_ID = 'Ascendus Pro'
function hasProEntitlement(subscriber, now = Date.now()) {
  const entitlement = subscriber?.entitlements?.[ENTITLEMENT_ID]
  return Boolean(entitlement && (entitlement.expires_date == null || Date.parse(entitlement.expires_date) > now))
}
async function verifyCoachSubscription(userId, { apiKey = process.env.REVENUECAT_API_KEY, fetcher = fetch } = {}) {
  if (!userId || !apiKey) throw new Error('Subscription verification unavailable')
  const signal = AbortSignal.timeout(8000)
  // StoreKit test purchases can be absent from the default/production response
  // even while RevenueCat reports an active sandbox entitlement. Check both
  // environments for this authenticated account; never take an RC ID or an
  // entitlement decision from a client request body.
  for (const sandbox of [false, true]) {
    const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'X-Is-Sandbox': String(sandbox) }, signal,
    })
    if (response.status === 404) continue
    if (!response.ok) throw new Error('Subscription verification unavailable')
    const data = await response.json()
    if (!data.subscriber || typeof data.subscriber !== 'object') throw new Error('Subscription verification unavailable')
    if (hasProEntitlement(data.subscriber)) return true
  }
  return false
}
async function verifyStripeSubscription(subscriptionId, { stripeClient } = {}) {
  if (!subscriptionId) return false
  const Stripe = require('stripe')
  const stripe = stripeClient || (process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 1 })
    : null)
  if (!stripe) throw new Error('Subscription verification unavailable')
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const active = subscription?.status === 'active' || subscription?.status === 'trialing'
  const periodEndsInFuture = Number(subscription?.current_period_end) * 1000 > Date.now()
  return Boolean(active && periodEndsInFuture)
}
// Persisted iOS flags are a mirror, not proof: a missed expiry webhook must
// not authorize a subscription forever. Stripe subscriptions are rechecked
// live; dated trials are issued and expire on the server.
async function resolveSubscription(userId, { user, verify = verifyCoachSubscription, verifyStripe = verifyStripeSubscription } = {}) {
  const trial = user?.subscription_tier === 'trial' && Date.parse(user.pro_trial_expires_at) > Date.now()
  if (trial) return { isPro: true, status: 'active', source: 'trial' }
  if (user?.stripe_subscription_id && await verifyStripe(user.stripe_subscription_id)) {
    return { isPro: true, status: 'active', source: 'stripe' }
  }
  const isPro = await verify(userId)
  if (process.env.NODE_ENV !== 'production') console.debug('[premium]', { account: `…${String(userId).slice(-4)}`, source: 'revenuecat', serverActive: isPro, reason: isPro ? 'active-entitlement' : 'missing-or-expired-entitlement' })
  return { isPro, status: isPro ? 'active' : 'inactive', source: 'revenuecat' }
}
module.exports = { ENTITLEMENT_ID, hasProEntitlement, verifyCoachSubscription, verifyStripeSubscription, resolveSubscription }
