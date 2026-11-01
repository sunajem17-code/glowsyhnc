export function getProgressCardReturnTo(routeState) {
  if (routeState?.source !== 'progress-card') return null
  return routeState.returnTo === '/history' ? '/history' : '/timeline'
}

export function getSavedProgressResultPresentation({ savedProgressCard = false, isPremium = false, hasUnlockedAccess = false } = {}) {
  return {
    // A saved card may also be temporarily unlocked by the successful
    // purchase flow before the persisted premium state refreshes.
    blurResultCard: Boolean(savedProgressCard && !isPremium && !hasUnlockedAccess),
    showUnlockedChrome: Boolean(hasUnlockedAccess),
  }
}
