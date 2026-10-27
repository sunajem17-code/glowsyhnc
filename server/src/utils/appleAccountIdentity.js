'use strict'

function trustedAppleEmail(payload) {
  if (!payload || typeof payload.sub !== 'string' || !payload.sub) return null
  const verified = payload.email_verified === true || payload.email_verified === 'true'
  return verified && typeof payload.email === 'string' && payload.email
    ? payload.email
    : `${payload.sub}@privaterelay.appleid.com`
}

module.exports = { trustedAppleEmail }
