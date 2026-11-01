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
