export function getProgressCardReturnTo(routeState) {
  if (routeState?.source !== 'progress-card') return null
  return routeState.returnTo === '/history' ? '/history' : '/timeline'
}

export function getSavedProgressResultPresentation({ savedProgressCard = false, isPremium = false, hasUnlockedAccess = false } = {}) {
  return {
    blurResultCard: Boolean(savedProgressCard && !isPremium),
    showUnlockedChrome: Boolean(hasUnlockedAccess),
  }
}
