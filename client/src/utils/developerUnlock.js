import { isLocalScanOrigin } from './localScanValidation.js'

export function isLocalDeveloperPreview(isDev = import.meta.env?.DEV, hostname = globalThis.location?.hostname) {
  return Boolean(isDev && isLocalScanOrigin(hostname))
}
