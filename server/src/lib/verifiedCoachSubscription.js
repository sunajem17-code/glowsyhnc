// Server-only fallback for App Store members whose database entitlement is stale.
async function verifyCoachSubscription(userId, { apiKey = process.env.REVENUECAT_API_KEY, fetcher = fetch } = {}) {
  if (!userId || !apiKey) return false
  const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000),
  })
  if (response.status === 404) return false
  if (!response.ok) throw new Error('Subscription verification unavailable')
  const data = await response.json()
  const entitlement = data.subscriber?.entitlements?.['Ascendus Pro']
  return Boolean(entitlement && (entitlement.expires_date == null || Date.parse(entitlement.expires_date) > Date.now()))
}
module.exports = { verifyCoachSubscription }
