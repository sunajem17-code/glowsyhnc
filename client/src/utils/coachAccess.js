export const LOCAL_PRO_PREVIEW_COACH_NOTICE = 'Local Pro Preview only previews the Max interface. Live AI Coach replies require a server-confirmed Ascendus Max subscription.'

export function getCoachAccessMode({ isPremium }) {
  if (isPremium === true) return 'server'
  return 'paywall'
}

// Keep coach access server-authorized while reconciling existing App Store purchases.
export async function loadCoachAccess({ native, userId, claimedPremium = false, checkPurchase, syncPurchase, loadContext }) {
  const context = await loadContext()
  if (context?.isPro === true || (!native && !claimedPremium) || !userId) return context
  if (native && !await checkPurchase(userId) && !claimedPremium) return context
  await syncPurchase(userId)
  const refreshed = await loadContext()
  if (refreshed?.isPro !== true) throw new Error('Your subscription is active, but coach access has not synced yet. Please retry in a moment.')
  return refreshed
}
