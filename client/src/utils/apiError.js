export function apiErrorMessage(errorBody) {
  const reason = typeof errorBody?.diagnosticReason === 'string' ? errorBody.diagnosticReason.trim() : ''
  if (!reason) return null
  return `Scan assessment failed: ${reason}`
}
