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
  } catch (e) {
    console.error('[RC] initRevenueCat failed:', e?.code, e?.message, e)
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
    // Never fall back to "whichever package happens to be listed first" —
    // that can silently substitute a different billing cycle than the one
    // requested. If the "current" offering's typed convenience getter
    // (.monthly / .annual) isn't populated — e.g. the package in the
    // RevenueCat dashboard is tagged CUSTOM instead of MONTHLY/ANNUAL —
    // search every package in the offering by its actual packageType or
    // product identifier instead, and fail loudly if the requested plan
    // truly isn't there rather than buying whatever's first.
    const pkg =
      (isYearly ? offerings.current.annual : offerings.current.monthly) ??
      offerings.current.availablePackages?.find(p =>
        isYearly
          ? p.packageType === 'ANNUAL' || /year|annual/i.test(p.product?.identifier ?? '')
          : p.packageType === 'MONTHLY' || /month/i.test(p.product?.identifier ?? '')
      )

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
    // Log full RC/StoreKit error for diagnostics — code, message, and raw object
    console.error('[RC] purchasePro failed — code:', e?.code, '| msg:', e?.message, '| full:', e)
    throw new Error('Unable to complete purchase. Please try again.')
  }
}

export const purchaseMonthly = () => purchasePro('monthly')

// ── Discounted annual (exit-intent offer) ─────────────────────────────────────
// A separate, differently-priced product from the standard monthly/annual
// slots above, so it can't be reached via purchasePro('annual') — that only
// ever resolves offerings.current.annual (the $49.99/yr product). This
// searches every package across every configured offering for the one whose
// underlying store product matches the real product ID, since RevenueCat
// commonly puts a promotional product in its own offering rather than the
// default one.
const DISCOUNT_ANNUAL_PRODUCT_ID = 'com.ascendus.app.yearly.discount'

export async function purchaseDiscountedAnnual() {
  if (!isNative()) return { success: false, reason: 'web' }
  try {
    await initRevenueCat()

    let offerings
    try {
      offerings = await Purchases.getOfferings()
    } catch {
      throw new Error('Unable to load subscription options. Please check your internet connection and try again.')
    }

    const searchSpace = [offerings?.current, ...Object.values(offerings?.all ?? {})].filter(Boolean)
    let pkg = null
    for (const offering of searchSpace) {
      pkg = offering.availablePackages?.find(p => p.product?.identifier === DISCOUNT_ANNUAL_PRODUCT_ID)
      if (pkg) break
    }

    // Genuinely missing from RevenueCat's config (product not created there
    // yet, or not attached to any offering) — distinct reason so callers can
    // show a real "not available" message instead of a generic purchase error.
    if (!pkg) return { success: false, reason: 'not_configured' }

    const result = await Purchases.purchasePackage({ aPackage: pkg })
    const active = result?.customerInfo?.entitlements?.active ?? {}
    const isPro = !!active[ENTITLEMENT_ID]
    return { success: isPro, customerInfo: result.customerInfo }
  } catch (e) {
    if (isCancelError(e)) {
      return { success: false, reason: 'cancelled' }
    }
    throw new Error('Unable to complete purchase. Please try again.')
  }
}

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
