const test = require('node:test')
const assert = require('node:assert/strict')
const { verifyCoachSubscription } = require('./verifiedCoachSubscription')
const verify = entitlements => verifyCoachSubscription('owner', {apiKey:'fixture',fetcher:async url=>{assert.match(url,/subscribers\/owner$/);return {ok:true,json:async()=>({subscriber:{entitlements}})}}})
test('only a current server-verified Pro entitlement grants coach access', async()=>{
 assert.equal(await verify({'Ascendus Pro':{expires_date:new Date(Date.now()+60000).toISOString()}}),true)
 assert.equal(await verify({'Ascendus Pro':{expires_date:'2020-01-01'}}),false)
 assert.equal(await verify({'Other product':{expires_date:null}}),false)
 assert.equal(await verify({}),false)
})
test('provider failure does not become a paywall or grant',async()=>{
 await assert.rejects(verifyCoachSubscription('owner',{apiKey:'fixture',fetcher:async()=>({ok:false,status:503})}),/unavailable/)
})

const { resolveSubscription } = require('./verifiedCoachSubscription')
test('stale iOS database flags cannot override expiry; active iOS recovers a free row', async () => {
  assert.equal((await resolveSubscription('owner', { user: { is_pro: true, subscription_tier: 'premium' }, verify: async () => false })).isPro, false)
  assert.equal((await resolveSubscription('owner', { user: { is_pro: false }, verify: async id => { assert.equal(id, 'owner'); return true } })).isPro, true)
})
test('provider outage preserves uncertainty instead of converting it to inactive', async () => {
  await assert.rejects(resolveSubscription('owner', { user: { is_pro: true }, verify: async () => { throw new Error('unavailable') } }), /unavailable/)
  await assert.rejects(verifyCoachSubscription('owner', { apiKey: '' }), /unavailable/)
})
test('web subscriptions and dated trials retain their independent server authorization', async () => {
  const verify = () => assert.fail('unexpected native lookup')
  assert.equal((await resolveSubscription('owner', {user:{stripe_subscription_id:'sub-fixture',subscription_tier:'premium'},verify})).source,'stripe')
  assert.equal((await resolveSubscription('owner', {user:{subscription_tier:'trial',pro_trial_expires_at:new Date(Date.now()+60000).toISOString()},verify})).source,'trial')
})
test('malformed provider response is unavailable, not an expiry', async () => {
  await assert.rejects(verifyCoachSubscription('owner',{apiKey:'fixture',fetcher:async()=>({ok:true,json:async()=>({})})}),/unavailable/)
})
