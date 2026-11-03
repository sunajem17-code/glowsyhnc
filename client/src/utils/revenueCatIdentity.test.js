import test from 'node:test'
import assert from 'node:assert/strict'
import { createRevenueCatInitializer, validRevenueCatUserId } from './revenueCatIdentity.js'
const realId = 'b55e42ac-ef1f-4212-92e0-679a7110a0da'
function sdk(initial = '$RCAnonymousID:test') {
  const calls = []
  let current = initial
  return { calls,
    async configure(config) { calls.push(['configure', config]); if (config.appUserID) current = config.appUserID },
    async getAppUserID() { return { appUserID: current } },
    async logIn({ appUserID }) { calls.push(['login', appUserID]); current = appUserID },
    async logOut() { calls.push(['logout']); current = '$RCAnonymousID:new' },
  }
}
test('placeholder identities are rejected; real and SDK-generated identities are accepted', () => {
  for (const id of ['guest', 'undefined', 'null', '[object Object]', '0', 'a/b', '\x00', '', {}, 0]) assert.equal(validRevenueCatUserId(id), false)
  assert.equal(validRevenueCatUserId(realId), true)
  assert.equal(validRevenueCatUserId('$RCAnonymousID:test'), true)
})
test('parallel startup and purchase calls configure once with the resolved account', async () => {
  const purchases = sdk('guest')
  const initialize = createRevenueCatInitializer({ purchases, apiKey: 'test-key', resolveUserId: async () => realId })
  await Promise.all([initialize(), initialize(realId), initialize()])
  assert.deepEqual(purchases.calls, [['configure', { apiKey: 'test-key', appUserID: realId }]])
})
test('failed login is surfaced and retried without falling through to a purchase', async () => {
  const purchases = sdk()
  let id = null
  let attempts = 0
  purchases.logIn = async () => { attempts++; throw new Error('identity rejected') }
  const initialize = createRevenueCatInitializer({ purchases, apiKey: 'test-key', resolveUserId: async () => id })
  await initialize()
  id = realId
  await assert.rejects(initialize(), /identity rejected/)
  await assert.rejects(initialize(), /identity rejected/)
  assert.equal(attempts, 2)
  assert.equal(purchases.calls.filter(([op]) => op === 'logout').length, 0)
})
test('an invalid requested identity is never sent to RevenueCat', async () => {
  const purchases = sdk()
  const initialize = createRevenueCatInitializer({ purchases, apiKey: 'test-key', resolveUserId: async () => 'guest' })
  await assert.rejects(initialize(), /sign in again/)
  assert.deepEqual(purchases.calls, [])
})

import { createProCustomerInfoReader } from './revenueCatIdentity.js'
const paidInfo = { entitlements: { active: { 'Ascendus Pro': { productIdentifier: 'monthly' } } } }
function purchaseReader({ paid = false, syncError = null } = {}) {
  let current = 'member'
  let info = paid ? paidInfo : { entitlements: { active: {} } }
  let syncs = 0
  const purchases = {
    getAppUserID: async () => ({ appUserID: current }),
    invalidateCustomerInfoCache: async () => {},
    getCustomerInfo: async () => ({ customerInfo: info }),
    syncPurchases: async () => { syncs++; if (syncError) throw syncError; info = paidInfo },
  }
  return { purchases, read: createProCustomerInfoReader({ purchases, initialize: async () => {}, entitlementId: 'Ascendus Pro' }), syncs: () => syncs, switchAccount: () => { current = 'other' } }
}
test('a new app account recovers the device subscription before returning unpaid', async () => {
  const fixture = purchaseReader()
  const [a, b] = await Promise.all([fixture.read('member'), fixture.read('member')])
  assert.equal(a, paidInfo)
  assert.equal(b, paidInfo)
  assert.equal(fixture.syncs(), 1)
  assert.equal(await fixture.read('member'), paidInfo)
  assert.equal(fixture.syncs(), 1)
})
test('an existing cached member submits receipts once before access is returned', async () => {
  const fixture = purchaseReader({ paid: true })
  assert.equal(await fixture.read('member'), paidInfo)
  assert.equal(fixture.syncs(), 1)
})
test('receipt verification failure is retryable and is not a free membership result', async () => {
  const fixture = purchaseReader({ syncError: new Error('Store unavailable') })
  await assert.rejects(fixture.read('member'), /Store unavailable/)
  await assert.rejects(fixture.read('member'), /Store unavailable/)
  assert.equal(fixture.syncs(), 2)
})
test('an account change during receipt recovery cannot grant the next user access', async () => {
  const fixture = purchaseReader()
  fixture.purchases.syncPurchases = async () => fixture.switchAccount()
  await assert.rejects(fixture.read('member'), /account changed/)
})
test('an unrelated active entitlement does not unlock Pro', async () => {
  const fixture = purchaseReader()
  fixture.purchases.syncPurchases = async () => {}
  fixture.purchases.getCustomerInfo = async () => ({ customerInfo: { entitlements: { active: { Other: {} } } } })
  assert.equal(await fixture.read('member'), null)
})
