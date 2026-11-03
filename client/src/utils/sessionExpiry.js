export function shouldExpireSession(requestToken, currentToken, persistedToken) {
  return Boolean(requestToken && requestToken !== 'demo-token'
    && requestToken === currentToken && requestToken === persistedToken)
}
