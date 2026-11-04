const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename:id, loaded:true, exports } }
const users = new Map()
const active = new Set(['paid', 'trial', 'sandbox-paid'])
let outage = false, replies = 0, scanLoads = 0, lookups = []
stub('../db', { prepare:()=>({get:()=>null,run:()=>({changes:1})}) })
stub('../supabase', {
  getUserById:async id=>users.get(id)||{id,subscription_tier:'free'},
  updateUserById:async(id,patch)=>users.set(id,{id,...patch}),
  isConfigured:()=>true,getSupabase:()=>null,
})
stub('../middleware/ratelimit',{createLimiter:()=>async()=>true})
stub('./aiBudget',{monthlyBudgetStatus:async()=>({allowed:true}),budgetError:()=>null,runWithBudgetUser:(_id,next)=>next()})
stub('./coachScanContext',{
  loadContext:async id=>{scanLoads++;return {status:'completed',latest:{id:'scan-'+id,owner:id,metrics:{symmetry:7.5}},previous:[]}},
  ownedCoachScan:async(id,owner)=>id==='scan-'+owner?{scan:{id,owner,metrics:{symmetry:7.5}}}:null,
  clean:x=>x,parseProvidedImage:()=>null,
})
stub('./coachIntelligence',{answer:async({userId,context,isPro})=>{assert.equal(isPro,true);assert.equal(context.latest.owner,userId);assert.equal(context.latest.metrics.symmetry,7.5);replies++;return {reply:'Fixture reply using owned metrics'}}})
const nativeFetch = global.fetch
global.fetch = async (url, options) => {
  const id = decodeURIComponent(String(url).split('/').pop());lookups.push(id)
  if (outage) throw new Error('fixture network failure')
  const entitled = active.has(id) && (id !== 'sandbox-paid' || options.headers['X-Is-Sandbox'] === 'true')
  return {ok:true,json:async()=>({subscriber:{entitlements:entitled?{'Ascendus Pro':{expires_date:new Date(Date.now()+60000).toISOString(), period_type: id === 'trial' ? 'trial' : 'normal'}}:{}}})}
}
process.env.REVENUECAT_API_KEY='test-only-key'
const { signToken } = require('../middleware/auth')
const app=express();app.use(express.json());app.use('/api/coach',require('../routes/coach'));app.use('/api/payments',require('../routes/payments'))
app.use('/api/swipemaxx',require('../routes/swipemaxx'))
app.use('/api/tindermaxx',require('../routes/tindermaxx'))
const { verifyToken, resolvePro, scanLimit, requirePro } = require('../middleware/claudeGate')
const scanProbe = express.Router()
scanProbe.get('/membership-check', verifyToken, resolvePro, scanLimit, (req,res)=>res.json({isPro:req.isPro}))
app.use('/api/ai',scanProbe)
const communityProbe = express.Router()
communityProbe.get('/membership-check', verifyToken, requirePro, (req,res)=>res.json({isPro:req.isPro}))
app.use('/api/community',communityProbe)
test('JWT-owned subscription authorizes coach messages and owned metrics across sync, reopen, outage and expiry', async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`
 const call=(path,id,body)=>nativeFetch(base+path,{method:body?'POST':'GET',headers:{...(id?{Authorization:'Bearer '+signToken(id)}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 try {
  // A valid subscriber must unlock every middleware family even before a
  // webhook/sync has updated this account's free database row.
  for (const id of ['paid','trial','sandbox-paid']) {
    assert.equal((await (await call('/api/ai/membership-check',id)).json()).isPro,true)
    assert.equal((await (await call('/api/community/membership-check',id)).json()).isPro,true)
    for (const feature of ['swipemaxx','tindermaxx']) {
      const response=await call(`/api/${feature}/rank`,id,{photos:[]})
      // Input validation is reached after passing the real route's Pro gate;
      // no paid external AI request is made by this test.
      assert.equal(response.status,400)
      assert.match((await response.json()).error,/between 2 and 6 photos/)
    }
  }
  assert.equal((await call('/api/coach/context')).status,401)
  assert.equal((await (await call('/api/coach/context','paid')).json()).isPro,true)
  // A new signed JWT (re-login/reopen) resolves the same owner.
  assert.equal((await (await call('/api/coach/context','paid')).json()).isPro,true)
  assert.equal((await call('/api/payments/sync-rc','paid',{})).status,200)
  assert.equal((await call('/api/payments/sync-rc','sandbox-paid',{})).status,200)
  const sandboxStatus = await call('/api/payments/status','sandbox-paid')
  assert.equal(sandboxStatus.headers.get('cache-control'),'no-store')
  assert.equal((await sandboxStatus.json()).isPremium,true)
  assert.equal((await (await call('/api/coach/context','sandbox-paid')).json()).isPro,true)
  active.delete('sandbox-paid')
  assert.equal((await call('/api/coach/context','sandbox-paid')).status,403)
  assert.equal((await call('/api/coach/message','paid',{messages:[{role:'user',content:'What do my scan metrics mean?'}],scanId:'scan-paid'})).status,200)
  assert.equal(replies,1)
  assert.equal((await call('/api/coach/message','trial',{messages:[{role:'user',content:'Trial member question'}],scanId:'scan-trial'})).status,200)
  assert.equal(replies,2)
  assert.equal((await call('/api/coach/message','paid',{messages:[{role:'user',content:'test'}],scanId:'scan-other'})).status,404)
  // A free caller cannot claim a paid RC customer via request body.
  assert.equal((await call('/api/payments/sync-rc','free',{rcUserId:'paid'})).status,402)
  assert.equal(lookups.at(-1),'free')
  const loadsBeforeFreeRequests = scanLoads
  assert.equal((await call('/api/coach/context','free')).status,403)
  assert.equal((await call('/api/coach/appearance','free',{scanId:'scan-free'})).status,403)
  assert.equal((await call('/api/coach/message','free',{messages:[{role:'user',content:'test'}]})).status,403)
  assert.equal(scanLoads,loadsBeforeFreeRequests)
  outage=true
  assert.equal((await call('/api/ai/membership-check','paid')).status,503)
  assert.equal((await call('/api/community/membership-check','paid')).status,503)
  assert.equal((await call('/api/coach/context','paid')).status,503)
  assert.equal((await call('/api/payments/status','paid')).status,503)
  outage=false;active.delete('paid')
  assert.equal((await (await call('/api/ai/membership-check','paid')).json()).isPro,false)
  assert.equal((await call('/api/community/membership-check','paid')).status,403)
  assert.equal((await call('/api/swipemaxx/rank','paid',{photos:[]})).status,403)
  assert.equal((await call('/api/tindermaxx/rank','paid',{photos:[]})).status,403)
  // Persisted premium after a successful sync cannot mask expiry.
  assert.equal((await call('/api/coach/context','paid')).status,403)
  assert.equal((await call('/api/coach/message','paid',{messages:[{role:'user',content:'test'}]})).status,403)
  assert.equal(replies,2)
 } finally {global.fetch=nativeFetch;server.closeAllConnections();await new Promise(r=>server.close(r))}
})
