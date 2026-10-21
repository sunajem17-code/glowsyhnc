import { isLocalScanOrigin } from './localScanValidation.js'

export function isLocalDeveloperPreview(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDev && isLocalScanOrigin(hostname))
}

export function isLocalProPreviewEnabled(previewEnabled, isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(previewEnabled && isLocalDeveloperPreview(isDev, hostname))
}

export function hasPremiumUiAccess(isPremium, developerPreviewUnlocked) {
  return Boolean(isPremium || developerPreviewUnlocked)
}

// A local UI preview only. Never use this value for server authorization,
// purchases, subscription management, or any request that grants paid access.
export function hasLocalPremiumUiAccess(isPremium, developerPreviewUnlocked, isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isPremium || (developerPreviewUnlocked && isLocalDeveloperPreview(isDev, hostname)))
}

export function hasUnlockedScanUiAccess(isPremium, developerPreviewUnlocked, scan) {
  return Boolean(hasPremiumUiAccess(isPremium, developerPreviewUnlocked) || scan?.resultsUnlocked)
}

export function hasLocalUnlockedScanUiAccess(isPremium, developerPreviewUnlocked, scan, isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(hasLocalPremiumUiAccess(isPremium, developerPreviewUnlocked, isDev, hostname) || scan?.resultsUnlocked)
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
