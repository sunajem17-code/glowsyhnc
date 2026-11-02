/** Local scan-reveal testing only; this never changes subscription state. */
export function isDeveloperUnlockAvailable(isDevelopment) {
  return isDevelopment === true
}

/**
 * Local Pro UI preview is available in development builds, including Xcode
 * live-reload sessions served from a LAN address. Production builds remain
 * excluded, and the flag never grants server-side subscription access.
 */
export function isLocalProPreviewAvailable(isDevelopment = import.meta.env?.DEV) {
  return isDevelopment === true
}
