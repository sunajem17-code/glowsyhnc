const ANONYMOUS_REVENUECAT_ID = /^\$RCAnonymousID:/i

// RevenueCat TRANSFER events use transferred_from/transferred_to arrays; they
// do not populate event.app_user_id like purchase and renewal events do.
function transferredAppUserIds(event) {
  if (event?.type !== 'TRANSFER') return []
  return [...new Set([
    ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
    ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
  ].filter(id => typeof id === 'string' && id.trim() === id && id.length > 0 && id.length <= 100 && !ANONYMOUS_REVENUECAT_ID.test(id)))]
}

module.exports = { transferredAppUserIds }
