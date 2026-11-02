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
