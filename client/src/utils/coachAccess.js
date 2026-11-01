import { isLocalProPreviewAvailable } from './developerUnlockPreview.js'

export function getCoachAccessMode(
  { isPremium, localPreviewEnabled },
  isDevelopment = import.meta.env?.DEV,
  hostname = globalThis.location?.hostname,
) {
  if (isPremium === true) return 'server'
  // Local Pro Preview only enables the client to try the coach endpoint in a
  // local dev build. The server still verifies the configured preview owner;
  // never substitute canned replies for the real scan-aware coach.
  if (localPreviewEnabled && isLocalProPreviewAvailable(isDevelopment, hostname)) return 'server'
  return 'paywall'
}

// Keep coach access server-authorized while reconciling existing App Store purchases.
export async function loadCoachAccess({ native, userId, checkPurchase, syncPurchase, loadContext }) {
  const context = await loadContext()
  if (context?.isPro === true || !native || !userId) return context
  if (!await checkPurchase(userId)) return context
  await syncPurchase(userId)
  const refreshed = await loadContext()
  if (refreshed?.isPro !== true) throw new Error('Your subscription is active, but coach access has not synced yet. Please retry in a moment.')
  return refreshed
}
