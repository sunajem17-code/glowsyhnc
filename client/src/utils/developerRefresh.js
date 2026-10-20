import { isLocalDeveloperPreview } from './developerUnlock.js'

export function isDeveloperRefreshAvailable(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return isLocalDeveloperPreview(isDev, hostname)
}

// Clear test/session progress while retaining identity, entitlement, and all
// onboarding choices. The caller persists this partial state through Zustand.
export function getDeveloperRefreshState() {
  return {
    scans: [],
    currentScan: null,
    currentPlan: null,
    checkins: [],
    todayCheckin: null,
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
    achievements: [],
    pendingAchievement: null,
    assignedPhase: null,
  }
}

