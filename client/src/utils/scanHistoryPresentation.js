export function getProgressStatPresentation(value, unlocked) {
  return unlocked
    ? { locked: false, value }
    : { locked: true, value: null }
}

export function getScanHistoryViewState({ scanCount = 0, loading = false, error = null } = {}) {
  if (scanCount > 0) return 'list'
  if (loading) return 'loading'
  if (error) return 'error'
  return 'empty'
}
