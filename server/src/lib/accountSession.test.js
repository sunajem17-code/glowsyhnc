const test=require('node:test'),assert=require('node:assert/strict'),express=require('express')
function stub(name,exports){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports}}
let exists=true,unavailable=false
stub('../supabase',{isConfigured:()=>true,getUserById:async id=>{if(unavailable)throw Error('db unavailable');return exists?{id}:null},getSupabase:()=>null})
stub('../db',{prepare:()=>{throw Error('production must not fallback')}})
stub('../middleware/ratelimit',{createLimiter:()=>async()=>true})
stub('./aiBudget',{runWithBudgetUser:(_id,next)=>next(),monthlyBudgetStatus:async()=>({spentMicros:0,reservedMicros:0,limitMicros:100})})
const {authMiddleware,signToken}=require('../middleware/auth')
const {verifyToken}=require('../middleware/claudeGate')
test('deletion revokes the same signed JWT on normal and Coach endpoints; database outages are 503',async()=>{
 const app=express();app.get('/profile',authMiddleware,(_q,r)=>r.json({ok:true}));app.get('/coach',verifyToken,(_q,r)=>r.json({ok:true}))
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,headers={authorization:'Bearer '+signToken('owner')}
 try {
  for(const path of ['/profile','/coach'])assert.equal((await fetch(base+path,{headers})).status,200)
  exists=false
  for(const path of ['/profile','/coach'])assert.equal((await fetch(base+path,{headers})).status,401)
  unavailable=true
  for(const path of ['/profile','/coach'])assert.equal((await fetch(base+path,{headers})).status,503)
  exists=true;unavailable=false
  assert.equal((await fetch(base+'/coach',{headers:{authorization:'Bearer '+signToken('new-owner')}})).status,200)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})
