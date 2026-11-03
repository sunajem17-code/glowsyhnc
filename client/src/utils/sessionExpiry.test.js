import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldExpireSession } from './sessionExpiry.js'

test('an older failed request cannot sign out a freshly restored member', () => {
  assert.equal(shouldExpireSession('old-session', 'new-session', 'new-session'), false)
  assert.equal(shouldExpireSession('old-session', 'new-session', 'old-session'), false)
})
test('only the same current authenticated session can expire', () => {
  assert.equal(shouldExpireSession('expired', 'expired', 'expired'), true)
  assert.equal(shouldExpireSession('expired', null, null), false)
  assert.equal(shouldExpireSession('demo-token', 'demo-token', 'demo-token'), false)
})
