'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { authenticatedRevenueCatUserId } = require('./revenueCatIdentity')

test('RevenueCat identity comes from the authenticated account, not request body', () => {
  assert.equal(authenticatedRevenueCatUserId({
    userId: 'authenticated-user',
    body: { rcUserId: 'another-users-revenuecat-id' },
  }), 'authenticated-user')
})

test('RevenueCat identity rejects missing or malformed authenticated IDs', () => {
  assert.equal(authenticatedRevenueCatUserId({ body: { rcUserId: 'victim' } }), null)
  assert.equal(authenticatedRevenueCatUserId({ userId: 'x'.repeat(201) }), null)
})
