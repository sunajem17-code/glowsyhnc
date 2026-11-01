/**
 * A negative status from an in-flight entitlement refresh must not undo a
 * later purchase or account entitlement update.
 */
export function canApplyNegativePremiumRefresh({
  revisionAtStart,
  currentRevision,
  nativePremiumStatus = null,
  serverStatus = null,
}) {
  if (revisionAtStart !== currentRevision || nativePremiumStatus === true) return false
  return serverStatus === false || (serverStatus == null && nativePremiumStatus === false)
}
