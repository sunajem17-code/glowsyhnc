// RevenueCat rejects these shared placeholder identities. Never replace one
// with another hardcoded ID: purchases must belong to a real app account.
const blockedIds = new Set(['no_user', 'null', 'none', 'nil', '(null)', 'nan', '', 'unidentified', 'undefined', 'unknown', 'anonymous', 'guest', '-1', '0', '[]', '{}', '[object object]'])
export function validRevenueCatUserId(value) {
  return typeof value === 'string' && value.length <= 100
    && value === value.trim() && !blockedIds.has(value.toLowerCase())
    && !/[\x00/]/.test(value)
}

// Read only the current identity. Recovering device purchases belongs to
// the explicit Restore Purchases action, never a new-account status check.
export function createProCustomerInfoReader({ purchases, initialize, entitlementId }) {
  const pending = new Map()
  return function read(userId) {
    const key = userId || 'current'
    if (pending.has(key)) return pending.get(key)
    const operation = (async () => {
      await initialize(userId)
      const { appUserID } = await purchases.getAppUserID()
      if (userId && appUserID !== userId) throw new Error('Your account changed. Please retry.')
      await purchases.invalidateCustomerInfoCache()
      const { customerInfo } = await purchases.getCustomerInfo()
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
  const initialize = function(userId) {
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
      } else if (!desiredId && !appUserID.startsWith('$RCAnonymousID:')) {
        // Signed-out app sessions must not retain an identified SDK account.
        await purchases.logOut()
      }
    })
    pending = operation.catch(() => {})
    return operation
  }
  // Serialize disconnection with configuration/login to prevent a delayed
  // old-account login from winning after logout or deletion.
  initialize.disconnect = function() {
    const operation = pending.then(async () => {
      if (!initialized) return
      const { appUserID } = await purchases.getAppUserID()
      if (!appUserID.startsWith('$RCAnonymousID:')) await purchases.logOut()
    })
    pending = operation.catch(() => {})
    return operation
  }
  return initialize
}

// A store receipt is not account-wide access until this same authenticated
// account is confirmed by the backend. Shared by purchase and explicit restore.
export async function finishAccountPurchase({ expectedId, customerInfo, entitlementId, getSession, getIdentity, sync, refresh }) {
  if (!customerInfo?.entitlements?.active?.[entitlementId]) return false
  const initial = getSession()
  if (!initial.token || initial.user?.id !== expectedId || await getIdentity() !== expectedId) throw new Error('Your account changed. Please retry restoration.')
  const sameAccount = () => getSession().token === initial.token && getSession().user?.id === expectedId
  if (!sameAccount()) throw new Error('Your account changed. Please retry restoration.')
  await sync()
  if (!sameAccount()) throw new Error('Your account changed. Please retry restoration.')
  await refresh()
  if (!sameAccount()) throw new Error('Your account changed. Please retry restoration.')
  if (getSession().subscriptionStatus !== 'active') throw new Error('Your purchase is pending account verification. Please use Restore Purchases to retry.')
  return true
}
