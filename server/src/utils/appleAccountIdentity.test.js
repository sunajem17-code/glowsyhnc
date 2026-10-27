'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { trustedAppleEmail } = require('./appleAccountIdentity')

test('Apple account linking uses email only when the verified token marks it verified', () => {
  assert.equal(trustedAppleEmail({ sub: 'apple-sub', email: 'owner@example.com', email_verified: true }), 'owner@example.com')
  assert.equal(trustedAppleEmail({ sub: 'apple-sub', email: 'attacker@example.com', email_verified: 'false' }), 'apple-sub@privaterelay.appleid.com')
  assert.equal(trustedAppleEmail({ sub: 'apple-sub', email: 'attacker@example.com' }), 'apple-sub@privaterelay.appleid.com')
  assert.equal(trustedAppleEmail({ email: 'attacker@example.com', email_verified: true }), null)
})
