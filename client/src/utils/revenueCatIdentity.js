// RevenueCat rejects these shared placeholder identities. Never replace one
// with another hardcoded ID: purchases must belong to a real app account.
const blockedIds = new Set(['no_user', 'null', 'none', 'nil', '(null)', 'nan', '', 'unidentified', 'undefined', 'unknown', 'anonymous', 'guest', '-1', '0', '[]', '{}', '[object object]'])
export function validRevenueCatUserId(value) {
  return typeof value === 'string' && value.length <= 100
    && value === value.trim() && !blockedIds.has(value.toLowerCase())
    && !/[\x00/]/.test(value)
}

// Reconcile receipts on this device once per account before treating a
// cached CustomerInfo as proof of access. This also resubmits receipts after
// store validation configuration changes.
export function createProCustomerInfoReader({ purchases, initialize, entitlementId }) {
  const reconciled = new Set()
  const pending = new Map()
  return function read(userId) {
    const key = userId || 'current'
    if (pending.has(key)) return pending.get(key)
    const operation = (async () => {
      await initialize(userId)
      const { appUserID } = await purchases.getAppUserID()
      if (userId && appUserID !== userId) throw new Error('Your account changed. Please retry.')
      await purchases.invalidateCustomerInfoCache()
      let { customerInfo } = await purchases.getCustomerInfo()
      if (!reconciled.has(appUserID)) {
        await purchases.syncPurchases()
        reconciled.add(appUserID)
        await purchases.invalidateCustomerInfoCache()
        customerInfo = (await purchases.getCustomerInfo()).customerInfo
      }
      if ((await purchases.getAppUserID()).appUserID !== appUserID) throw new Error('Your account changed. Please retry.')
      return customerInfo?.entitlements?.active?.[entitlementId] ? customerInfo : null
    })().finally(() => pending.delete(key))
    pending.set(key, operation)
    return operation
  }
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
