// Development only; never print tokens, receipts, email, or full identifiers.
export function premiumDiagnostic(stage, { accountId, rcId, nativeActive, serverActive, restored = false, status } = {}) {
  if (!import.meta.env.DEV) return
  const tag = value => value ? `…${String(value).slice(-4)}` : 'none'
  console.debug('[premium]', { stage, account: tag(accountId), revenueCat: tag(rcId), identityMatches: Boolean(accountId && accountId === rcId), nativeActive, serverActive, restored, status })
}
