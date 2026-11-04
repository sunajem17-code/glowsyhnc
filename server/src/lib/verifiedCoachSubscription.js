// RevenueCat lookup is always scoped to the authenticated application account.
const ENTITLEMENT_ID = 'Ascendus Pro'
function hasProEntitlement(subscriber, now = Date.now()) {
  const entitlement = subscriber?.entitlements?.[ENTITLEMENT_ID]
  return Boolean(entitlement && (entitlement.expires_date == null || Date.parse(entitlement.expires_date) > now))
}
async function verifyCoachSubscription(userId, { apiKey = process.env.REVENUECAT_API_KEY, fetcher = fetch } = {}) {
  if (!userId || !apiKey) throw new Error('Subscription verification unavailable')
  const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000),
  })
  if (response.status === 404) return false
  if (!response.ok) throw new Error('Subscription verification unavailable')
  const data = await response.json()
  if (!data.subscriber || typeof data.subscriber !== 'object') throw new Error('Subscription verification unavailable')
  return hasProEntitlement(data.subscriber)
}
// Persisted iOS flags are a mirror, not proof: a missed expiry webhook must
// not authorize a subscription forever. Web billing and dated trials retain
// their existing server-managed authorization.
async function resolveSubscription(userId, { user, verify = verifyCoachSubscription } = {}) {
  const trial = user?.subscription_tier === 'trial' && Date.parse(user.pro_trial_expires_at) > Date.now()
  const web = user?.stripe_subscription_id && (user.subscription_tier === 'premium' || user.is_pro === true || user.is_pro === 1)
  if (trial || web) return { isPro: true, status: 'active', source: trial ? 'trial' : 'stripe' }
  const isPro = await verify(userId)
  return { isPro, status: isPro ? 'active' : 'inactive', source: 'revenuecat' }
}
module.exports = { ENTITLEMENT_ID, hasProEntitlement, verifyCoachSubscription, resolveSubscription }
