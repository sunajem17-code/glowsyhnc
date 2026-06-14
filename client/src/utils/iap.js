import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'

// RevenueCat iOS public key — rotate in RevenueCat dashboard if compromised
const REVENUECAT_API_KEY = 'appl_LIKxNXBwFteqKVMvOUvkansTrdr'

// Entitlement identifier — must match exactly what's in RevenueCat dashboard
const ENTITLEMENT_ID = 'Ascendus Pro'

let _initialized = false

export const isNative = () => Capacitor.isNativePlatform()

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initRevenueCat(userId) {
  if (!isNative()) return
  if (_initialized && !userId) return
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    if (!_initialized) {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY })
      _initialized = true
    }
    // Link purchases to the logged-in user so they appear in RC dashboard
    if (userId) {
      await Purchases.logIn({ appUserID: userId })
    }
  } catch {
    // RevenueCat init failure is non-fatal — purchases will still work on retry
  }
}

// Alias so existing callers (App.jsx, Premium.jsx) don't need to change
export const initPurchases = initRevenueCat

// ── Cancel detection — covers all RevenueCat + StoreKit cancel codes ─────────
function isCancelError(e) {
  if (!e) return false
  if (e.userCancelled === true) return true
  const code = e?.code ?? ''
  const msg  = (e?.message ?? '').toLowerCase()
  const CANCEL_CODES = [
    'PURCHASE_CANCELLED',   // RC Capacitor
    'purchaseCancelled',
    'USER_CANCELLED',
    '1001',                 // SKErrorDomain
    'E_USER_CANCELLED',
  ]
  if (CANCEL_CODES.includes(String(code))) return true
  if (msg.includes('cancel') || msg.includes('user cancel')) return true
  return false
}

// ── Unified purchase entry point ──────────────────────────────────────────────
// plan: 'monthly' | 'yearly' | 'annual'
export async function purchasePro(plan = 'monthly') {
  if (!isNative()) return { success: false, reason: 'web' }
  try {
    await initRevenueCat()

    // Fetch offerings — surfaces config errors early with a clear message
    let offerings
    try {
      offerings = await Purchases.getOfferings()
    } catch {
      throw new Error('Unable to load subscription options. Please check your internet connection and try again.')
    }

    if (!offerings?.current) {
      throw new Error('Subscription options are not available right now. Please try again later.')
    }

    const isYearly = plan === 'yearly' || plan === 'annual'
    const pkg =
      (isYearly ? offerings.current.annual : offerings.current.monthly) ??
      offerings.current.availablePackages?.[0]

    if (!pkg) {
      throw new Error('The selected subscription plan is not available. Please try again later.')
    }

    const result = await Purchases.purchasePackage({ aPackage: pkg })
    const active = result?.customerInfo?.entitlements?.active ?? {}
    const isPro = !!active[ENTITLEMENT_ID]
    return { success: isPro, customerInfo: result.customerInfo }
  } catch (e) {
    if (isCancelError(e)) {
      return { success: false, reason: 'cancelled' }
    }
    const raw = e?.message ?? ''
    if (raw.includes('not configured') || raw.includes('Cannot connect')) {
      throw new Error('In-app purchases are not available right now. Please try again later.')
    }
    throw e
  }
}

// Aliases for existing callers (Premium.jsx, Results.jsx, useStore.js)
export const purchaseMonthly = () => purchasePro('monthly')
export const purchaseYearly  = () => purchasePro('yearly')

// ── Restore ───────────────────────────────────────────────────────────────────
export async function restorePurchases() {
  if (!isNative()) return null
  await initRevenueCat()
  const result = await Purchases.restoreInAppPurchases()
  return result.customerInfo
}

// ── Status check ──────────────────────────────────────────────────────────────
export async function checkProStatus(userId) {
  if (!isNative()) return false
  await initRevenueCat(userId ?? null)
  const result = await Purchases.getCustomerInfo()
  return !!result.customerInfo.entitlements.active?.[ENTITLEMENT_ID]
}
