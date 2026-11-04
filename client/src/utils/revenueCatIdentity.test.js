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
test('new accounts never recover device receipts as a side effect of reading status', async () => {
  const fixture = purchaseReader()
  assert.deepEqual(await Promise.all([fixture.read('member'), fixture.read('member')]), [null, null])
  assert.equal(fixture.syncs(), 0)
})
test('current account membership is read without restoring another identity', async () => {
  const fixture = purchaseReader({ paid: true })
  assert.equal(await fixture.read('member'), paidInfo)
  assert.equal(fixture.syncs(), 0)
})
test('native network failure stays unavailable instead of becoming free', async () => {
  const fixture = purchaseReader()
  fixture.purchases.getCustomerInfo = async () => { throw new Error('Store unavailable') }
  await assert.rejects(fixture.read('member'), /Store unavailable/)
})
test('an account change during status read cannot grant the next user access', async () => {
  const fixture = purchaseReader({ paid: true })
  fixture.purchases.getCustomerInfo = async () => { fixture.switchAccount(); return { customerInfo: paidInfo } }
  await assert.rejects(fixture.read('member'), /account changed/)
})
test('deletion disconnects a pending login before a new account can initialize', async () => {
  const purchases = sdk()
  let owner = 'old'
  const initialize = createRevenueCatInitializer({ purchases, apiKey: 'fixture', resolveUserId: async () => owner })
  const oldLogin = initialize()
  const logout = initialize.disconnect()
  await Promise.all([oldLogin, logout])
  assert.equal((await purchases.getAppUserID()).appUserID, '$RCAnonymousID:new')
  owner = 'new'
  await initialize()
  assert.equal((await purchases.getAppUserID()).appUserID, 'new')
  assert.deepEqual(purchases.calls.map(([op])=>op), ['configure','logout','login'])
})
test('an unauthenticated startup disconnects a custom identity retained by the SDK', async () => {
  const purchases = sdk('deleted')
  const initialize = createRevenueCatInitializer({ purchases, apiKey: 'fixture', resolveUserId: async () => null })
  await initialize()
  assert.equal((await purchases.getAppUserID()).appUserID, '$RCAnonymousID:new')
})

test('an unrelated active entitlement does not unlock Pro', async () => {
  const fixture = purchaseReader()
  fixture.purchases.syncPurchases = async () => {}
  fixture.purchases.getCustomerInfo = async () => ({ customerInfo: { entitlements: { active: { Other: {} } } } })
  assert.equal(await fixture.read('member'), null)
})

import { finishAccountPurchase } from './revenueCatIdentity.js'
test('purchase and restore complete only for the same server-verified account', async()=>{
 let session={user:{id:'owner'},token:'token',subscriptionStatus:'loading'},synced=0
 const options={expectedId:'owner',customerInfo:paidInfo,entitlementId:'Ascendus Pro',getSession:()=>session,getIdentity:async()=>session.user.id,sync:async()=>{synced++},refresh:async()=>{session={...session,subscriptionStatus:'active'}}}
 assert.equal(await finishAccountPurchase(options),true);assert.equal(synced,1)
 session={...session,subscriptionStatus:'inactive'}
 await assert.rejects(finishAccountPurchase({...options,refresh:async()=>{}}),/verification/)
 session={...session,subscriptionStatus:'loading'}
 await assert.rejects(finishAccountPurchase({...options,sync:async()=>{session={user:{id:'new'},token:'new-token'}}}),/account changed/)
})
test('a native-only, unrelated or unowned entitlement never completes purchase/restoration',async()=>{
 const options={expectedId:'owner',customerInfo:paidInfo,entitlementId:'Ascendus Pro',getSession:()=>({user:{id:'other'},token:'token'}),getIdentity:async()=>'owner',sync:()=>assert.fail('unowned sync')}
 await assert.rejects(finishAccountPurchase(options),/account changed/)
 assert.equal(await finishAccountPurchase({...options,customerInfo:{entitlements:{active:{Other:{}}}}}),false)
})
