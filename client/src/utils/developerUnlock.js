import { isLocalScanOrigin } from './localScanValidation.js'

export function isLocalDeveloperPreview(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDev && isLocalScanOrigin(hostname))
}

export function hasPremiumUiAccess(isPremium, developerPreviewUnlocked) {
  return Boolean(isPremium || developerPreviewUnlocked)
}

export function hasUnlockedScanUiAccess(isPremium, developerPreviewUnlocked, scan) {
  return Boolean(hasPremiumUiAccess(isPremium, developerPreviewUnlocked) || scan?.resultsUnlocked)
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
