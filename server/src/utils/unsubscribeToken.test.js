'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { UNSUBSCRIBE_TOKEN_TTL_SECONDS, createUnsubscribeToken, verifyUnsubscribeToken } = require('./unsubscribeToken')

test('unsubscribe token verifies only for its purpose and before expiry', () => {
  const now = Date.UTC(2026, 0, 1)
  const token = createUnsubscribeToken('user-123', now)
  assert.equal(verifyUnsubscribeToken(token, now), 'user-123')
  assert.equal(verifyUnsubscribeToken(token, now + UNSUBSCRIBE_TOKEN_TTL_SECONDS * 1000), null)
})

test('unsubscribe token rejects tampering and malformed values', () => {
  const now = Date.UTC(2026, 0, 1)
  const token = createUnsubscribeToken('user-123', now)
  const [payload, signature] = token.split('.')
  assert.equal(verifyUnsubscribeToken(`${payload.slice(0, -1)}A.${signature}`, now), null)
  assert.equal(verifyUnsubscribeToken(`${payload}.${signature.slice(0, -1)}A`, now), null)
  assert.equal(verifyUnsubscribeToken('user-123', now), null)
  assert.equal(verifyUnsubscribeToken(`${token}${'x'.repeat(2048)}`, now), null)
})

test('unsubscribe token requires a bounded nonempty user ID', () => {
  assert.throws(() => createUnsubscribeToken('', 0), TypeError)
  assert.throws(() => createUnsubscribeToken('x'.repeat(201), 0), TypeError)
})
