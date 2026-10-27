const POST_AUTH_DESTINATIONS = new Set(['/scan', '/dashboard', '/progress', '/extras', '/unlock?paywall=1'])

export function getSafePostAuthDestination(destination) {
  return POST_AUTH_DESTINATIONS.has(destination) ? destination : '/scan'
}

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
