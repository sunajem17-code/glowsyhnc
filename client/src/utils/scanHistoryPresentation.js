export function getProgressStatPresentation(value, canAccessProUi) {
  return canAccessProUi
    ? { locked: false, value }
    : { locked: true, value: null }
}

export function shouldShowProgressData() {
  return true
}

export function getProgressTrendPresentation(canAccessProUi) {
  return { locked: !canAccessProUi }
}

export function getScanHistoryRowPresentation(canAccessProUi) {
  return { blurRating: !canAccessProUi }
}

export function getScanHistoryViewState({ scanCount = 0, loading = false, error = null } = {}) {
  if (scanCount > 0) return 'list'
  if (loading) return 'loading'
  if (error) return 'error'
  return 'empty'
}
