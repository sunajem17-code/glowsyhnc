import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'
import { Capacitor } from '@capacitor/core'
import { isThreeDayFreeTrial, eligibleExitTrial, EXIT_TRIAL_PRODUCT_ID } from './scanTrial'
import { createRevenueCatInitializer, validRevenueCatUserId } from './revenueCatIdentity'

// RevenueCat iOS public key — rotate in RevenueCat dashboard if compromised
const REVENUECAT_API_KEY = 'appl_LIKxNXBwFteqKVMvOUvkansTrdr'

// Entitlement identifier — must match exactly what's in RevenueCat dashboard
const ENTITLEMENT_ID = 'Ascendus Pro'

let legacyGuestRepair = null
const initializeIdentity = createRevenueCatInitializer({
  purchases: Purchases,
  apiKey: REVENUECAT_API_KEY,
  resolveUserId: async requestedId => {
    const { default: useStore } = await import('../store/useStore')
    let state = useStore.getState()
    if (state.token === 'demo-token' && ['guest', 'demo'].includes(state.user?.id)) {
      // Old onboarding builds persisted a shared fake login. Replace it with
      // a server-issued guest account before contacting RevenueCat.
      if (!legacyGuestRepair) legacyGuestRepair = import('./api')
        .then(({ api }) => api.auth.guest())
        .then(({ userId, token }) => {
          if (!validRevenueCatUserId(userId) || !token) throw new Error('Unable to create your subscription account. Please sign in again.')
          const latest = useStore.getState()
          if (latest.token === 'demo-token' && ['guest', 'demo'].includes(latest.user?.id)) latest.setGuestSession(userId, token)
        }).finally(() => { legacyGuestRepair = null })
      await legacyGuestRepair
      state = useStore.getState()
      return state.user?.id ?? null
    }
    return requestedId ?? state.user?.id ?? null
  },
})

export const isNative = () => Capacitor.isNativePlatform()

export async function getEligibleScanTrial(productId = EXIT_TRIAL_PRODUCT_ID) {
  if (!isNative()) throw new Error('Start your free trial from the iPhone app.')
  if (productId !== EXIT_TRIAL_PRODUCT_ID) throw new Error('This exit offer is no longer available.')
  await initRevenueCat()
  const offerings = await Purchases.getOfferings()
  const availableOfferings = [offerings.current, ...Object.values(offerings.all || {})].filter(Boolean)
  const packages = [...new Map(
    availableOfferings.flatMap(offering => offering.availablePackages || [])
      .map(pkg => [pkg.product?.identifier, pkg])
      .filter(([identifier]) => identifier)
  ).values()]
  const candidates = packages.filter(p => p.product?.identifier === productId && isThreeDayFreeTrial(p.product))
  if (!candidates.length) throw new Error('The exit offer is not configured with a 3-day trial in the store yet. Please try again later.')
  const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility({
    productIdentifiers: candidates.map(p => p.product.identifier),
  })
  const eligible = eligibleExitTrial(candidates, eligibility)
  if (eligible) return eligible
  const selected = productId ? candidates.filter(pkg => pkg.product.identifier === productId) : candidates
  if (!selected.length) throw new Error('This trial offer is no longer available.')
  if (selected.every(pkg => eligibility[pkg.product.identifier]?.status === 1)) return null
  throw new Error('Apple could not confirm this trial offer. Please check again in a moment.')
}

export async function purchaseScanTrial(productId) {
  const pkg = await getEligibleScanTrial(productId)
  if (!pkg || pkg.product.identifier !== productId) throw new Error('This free trial is no longer available.')
  try {
    const result = await Purchases.purchasePackage({ aPackage: pkg })
    return { success: !!result.customerInfo?.entitlements?.active?.[ENTITLEMENT_ID], customerInfo: result.customerInfo }
  } catch (error) {
    if (isCancelError(error)) return { success: false, reason: 'cancelled' }
    throw error
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initRevenueCat(userId) {
  if (!isNative()) return
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG })
    await initializeIdentity(userId)
  } catch (e) {
    console.error('[RC] initRevenueCat failed:', e?.code, e?.message)
    throw e
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
// plan: 'monthly' | 'yearly' | 'annual' | 'weekly'
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
    const isWeekly = plan === 'weekly'
    // Never fall back to "whichever package happens to be listed first" —
    // that can silently substitute a different billing cycle than the one
    // requested. If the "current" offering's typed convenience getter
    // (.monthly / .annual / .weekly) isn't populated — e.g. the package in the
    // RevenueCat dashboard is tagged CUSTOM instead of MONTHLY/ANNUAL/WEEKLY —
    // search every package in the offering by its actual packageType or
    // product identifier instead, and fail loudly if the requested plan
    // truly isn't there rather than buying whatever's first.
    const pkg = isWeekly
      ? (offerings.current.weekly ??
         offerings.current.availablePackages?.find(p =>
           p.packageType === 'WEEKLY' || /week/i.test(p.product?.identifier ?? '')
         ))
      : isYearly
        ? (offerings.current.annual ??
           offerings.current.availablePackages?.find(p =>
             p.packageType === 'ANNUAL' || /year|annual/i.test(p.product?.identifier ?? '')
           ))
        : (offerings.current.monthly ??
           offerings.current.availablePackages?.find(p =>
             p.packageType === 'MONTHLY' || /month/i.test(p.product?.identifier ?? '')
           ))

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
export const purchaseWeekly = () => purchasePro('weekly')

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
