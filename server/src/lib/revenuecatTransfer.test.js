const test = require('node:test')
const assert = require('node:assert/strict')
const { transferredAppUserIds } = require('./revenuecatTransfer')

test('extracts both sides of a RevenueCat transfer and removes duplicate IDs', () => {
  assert.deepEqual(transferredAppUserIds({
    type: 'TRANSFER',
    transferred_from: ['old-user', 'same-user'],
    transferred_to: ['new-user', 'same-user'],
  }), ['old-user', 'same-user', 'new-user'])
})

test('ignores anonymous, malformed, or non-transfer identifiers', () => {
  assert.deepEqual(transferredAppUserIds({
    type: 'TRANSFER',
    transferred_from: ['$RCAnonymousID:abc', null, ''],
    transferred_to: ['$rcanonymousid:def', ' user-with-spaces ', 3],
  }), [])
  assert.deepEqual(transferredAppUserIds({ type: 'INITIAL_PURCHASE', app_user_id: 'user-1' }), [])
})
