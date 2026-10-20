export function getProgressCardReturnTo(routeState) {
  if (routeState?.source !== 'progress-card') return null
  return routeState.returnTo === '/history' ? '/history' : '/timeline'
}
