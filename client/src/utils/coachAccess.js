export const LOCAL_PRO_PREVIEW_COACH_NOTICE = 'Local Pro Preview only previews the Max interface. Live AI Coach replies require a server-confirmed Ascendus Max subscription.'

export function getCoachAccessMode({ isPremium }) {
  if (isPremium === true) return 'server'
  if (isPremium == null) return 'loading'
  return 'paywall'
}

// Keep coach access server-authorized while reconciling existing App Store purchases.
export async function loadCoachAccess({ native, userId, claimedPremium = false, checkPurchase, syncPurchase, loadContext }) {
  let context, contextError
  try { context = await loadContext() } catch (error) { contextError = error }
  if (context?.isPro === true) return context
  if (!userId || (!native && !claimedPremium)) {
    if (contextError) throw contextError
    return context
  }
  // A failed first context request must not prevent receipt reconciliation.
  // No loading/error response is converted to an unpaid access decision.
  const purchased = native ? await checkPurchase(userId) : false
  if (!purchased && !claimedPremium) {
    if (contextError) throw contextError
    return context
  }
  await syncPurchase(userId)
  const refreshed = await loadContext()
  if (refreshed?.isPro !== true) throw new Error('Your subscription is active, but coach access has not synced yet. Please retry in a moment.')
  return refreshed
}
