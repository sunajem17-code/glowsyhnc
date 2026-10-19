export function validationFailure(error) {
  const code = error?.status === 401 ? 'validation_session_expired'
    : error?.status === 429 ? 'validation_rate_limited'
    : error?.status >= 500 || error?.errorCode === 'validation_not_configured' ? 'validation_unavailable'
    : 'validation_error'
  return {
    passed: false,
    state: 'ERROR',
    issues: [{ code, title: 'Photo check unavailable', advice: 'Try the same photo again when the service is available.', severity: 'critical' }],
  }
}
