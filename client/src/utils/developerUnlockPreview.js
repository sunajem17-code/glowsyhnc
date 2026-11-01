import { isLocalScanOrigin } from './localScanValidation.js'

/** Local scan-reveal testing only; this never changes subscription state. */
export function isDeveloperUnlockAvailable(isDevelopment) {
  return isDevelopment === true
}

/** Local Pro UI preview is restricted to a development build on localhost. */
export function isLocalProPreviewAvailable(isDevelopment = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDevelopment && isLocalScanOrigin(hostname))
}
