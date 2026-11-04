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
// Persisted iOS flags are a mirror, not proof: a missed expiry webhook must
// not authorize a subscription forever. Web billing and dated trials retain
// their existing server-managed authorization.
async function resolveSubscription(userId, { user, verify = verifyCoachSubscription } = {}) {
  const trial = user?.subscription_tier === 'trial' && Date.parse(user.pro_trial_expires_at) > Date.now()
  const web = user?.stripe_subscription_id && (user.subscription_tier === 'premium' || user.is_pro === true || user.is_pro === 1)
  if (trial || web) return { isPro: true, status: 'active', source: trial ? 'trial' : 'stripe' }
  const isPro = await verify(userId)
  if (process.env.NODE_ENV !== 'production') console.debug('[premium]', { account: `…${String(userId).slice(-4)}`, source: 'revenuecat', serverActive: isPro, reason: isPro ? 'active-entitlement' : 'missing-or-expired-entitlement' })
  return { isPro, status: isPro ? 'active' : 'inactive', source: 'revenuecat' }
}
module.exports = { ENTITLEMENT_ID, hasProEntitlement, verifyCoachSubscription, resolveSubscription }
