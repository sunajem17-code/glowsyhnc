// RevenueCat rejects these shared placeholder identities. Never replace one
// with another hardcoded ID: purchases must belong to a real app account.
const blockedIds = new Set(['no_user', 'null', 'none', 'nil', '(null)', 'nan', '', 'unidentified', 'undefined', 'unknown', 'anonymous', 'guest', '-1', '0', '[]', '{}', '[object object]'])
export function validRevenueCatUserId(value) {
  return typeof value === 'string' && value.length <= 100
    && value === value.trim() && !blockedIds.has(value.toLowerCase())
    && !/[\x00/]/.test(value)
}

export function createRevenueCatInitializer({ purchases, apiKey, resolveUserId }) {
  let initialized = false
  let pending = Promise.resolve()
  return function initialize(userId) {
    const operation = pending.then(async () => {
      const desiredId = await resolveUserId(userId)
      if (desiredId != null && !validRevenueCatUserId(desiredId)) {
        throw new Error('Please sign in again to connect your subscription account.')
      }
      if (!initialized) {
        await purchases.configure({ apiKey, ...(desiredId ? { appUserID: desiredId } : {}) })
        initialized = true
      }
      const { appUserID } = await purchases.getAppUserID()
      if (desiredId && appUserID !== desiredId) {
        await purchases.logIn({ appUserID: desiredId })
      } else if (!desiredId && !validRevenueCatUserId(appUserID)) {
        // Repair a legacy cached placeholder only. A legitimate ID rejected by
        // the backend must surface its error, never be rotated to evade a block.
        await purchases.logOut()
      }
    })
    pending = operation.catch(() => {})
    return operation
  }
}
