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
