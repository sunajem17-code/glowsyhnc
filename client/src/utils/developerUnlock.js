import { isLocalScanOrigin } from './localScanValidation.js'

export function isLocalDeveloperPreview(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDev && isLocalScanOrigin(hostname))
}

export function isLocalProPreviewEnabled(previewEnabled, isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(previewEnabled && isLocalDeveloperPreview(isDev, hostname))
}

export function shouldAutoUnlockLocalScanResults(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return isLocalDeveloperPreview(isDev, hostname)
}

export function isLocalGuestSession(state) {
  return Boolean(
    state.isGuest ||
    state.token === 'demo-token' ||
    (state.user?.id && !state.user?.email && !state.user?.subscriptionTier && !state.user?.subscription_tier && state.user?.is_pro !== true),
  )
}

export function getLocalProPreviewResetState(state) {
  const isGuest = isLocalGuestSession(state)
  return {
    isLocalProPreview: false,
    isLocalProPreviewConfigured: true,
    // Older local scan flows wrote their one-scan preview into global
    // isPremium. A guest cannot have a paid entitlement, so never restore
    // that stale local value when Pro Preview is switched off.
    isPremium: isGuest ? false : state._premiumBeforeLocalPreview,
    _premiumBeforeLocalPreview: false,
  }
}

export function hasPremiumUiAccess(isPremium) {
  return Boolean(isPremium)
}

// A local UI preview only. Never use this value for server authorization,
// purchases, subscription management, or any request that grants paid access.
export function hasLocalPremiumUiAccess(isPremium) {
  return Boolean(isPremium)
}

export function hasUnlockedScanUiAccess(isPremium, scan) {
  return Boolean(hasPremiumUiAccess(isPremium) || scan?.resultsUnlocked)
}

export function hasLocalUnlockedScanUiAccess(isPremium, scan) {
  return Boolean(hasLocalPremiumUiAccess(isPremium) || scan?.resultsUnlocked)
}

export function markScanResultsUnlocked(state, scanId) {
  if (!scanId) return state
  const mark = scan => scan?.id === scanId ? { ...scan, resultsUnlocked: true } : scan
  return {
    ...state,
    currentScan: mark(state.currentScan),
    scans: state.scans.map(mark),
  }
}
