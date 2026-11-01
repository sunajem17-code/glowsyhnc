import { isLocalScanOrigin } from './localScanValidation.js'

export function isDeveloperRefreshAvailable(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDev && isLocalScanOrigin(hostname))
}

// Reset only the local Pro scan window; history and all other store data remain intact.
export function getScanLimitResetState() {
  return { proScanCount: 0, proScanDate: null, proScanFirstAt: null }
}

// Clear test/session progress while retaining identity, entitlement, and all
// onboarding choices. The caller persists this partial state through Zustand.
export function getDeveloperRefreshState() {
  return {
    scans: [],
    currentScan: null,
    currentPlan: null,
    checkins: [],
    streak: { current: 0, longest: 0, lastDate: null },
    pendingFacePhoto: null,
    pendingBodyPhoto: null,
    lastFaceScanImage: null,
    lastFaceScanLandmarks2D: null,
    lastFaceScanFaceMetrics: null,
    scanCount: 0,
    lastScanDate: null,
    proScanCount: 0,
    proScanDate: null,
    proScanFirstAt: null,
    assignedPhase: null,
  }
}
