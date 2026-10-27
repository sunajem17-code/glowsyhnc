'use strict'

// RevenueCat aliases can include anonymous IDs. Only ever query the identity
// bound to the authenticated Ascendus account; never trust a client-selected ID.
function authenticatedRevenueCatUserId(req) {
  const userId = req?.userId
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 200
    ? userId
    : null
}

module.exports = { authenticatedRevenueCatUserId }
