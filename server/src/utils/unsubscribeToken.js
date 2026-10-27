'use strict'

const crypto = require('crypto')
const { JWT_SECRET } = require('../middleware/auth')

const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

function signPayload(payload) {
  return crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url')
}

function createUnsubscribeToken(userId, now = Date.now()) {
  if (typeof userId !== 'string' || userId.length < 1 || userId.length > 200) {
    throw new TypeError('A valid user ID is required')
  }
  const payload = Buffer.from(JSON.stringify({
    purpose: 'email-unsubscribe',
    sub: userId,
    exp: Math.floor(now / 1000) + UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  })).toString('base64url')
  return `${payload}.${signPayload(payload)}`
}

function verifyUnsubscribeToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null

  const expected = Buffer.from(signPayload(parts[0]))
  const supplied = Buffer.from(parts[1])
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null

  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const nowSeconds = Math.floor(now / 1000)
    if (payload.purpose !== 'email-unsubscribe' || typeof payload.sub !== 'string' || !payload.sub ||
        !Number.isSafeInteger(payload.exp) || payload.exp <= nowSeconds ||
        payload.exp > nowSeconds + UNSUBSCRIBE_TOKEN_TTL_SECONDS + 1) return null
    return payload.sub
  } catch {
    return null
  }
}

module.exports = { UNSUBSCRIBE_TOKEN_TTL_SECONDS, createUnsubscribeToken, verifyUnsubscribeToken }
