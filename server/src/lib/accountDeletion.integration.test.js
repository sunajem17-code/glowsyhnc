const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),Database=require('better-sqlite3')
const database=new Database(':memory:')
database.exec('CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES (\'old\')')
function stub(name,exports){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports}}
stub('../db',database)
stub('../supabase',{getUserById:async()=>null,getSupabase:()=>null,isConfigured:()=>false})
let cleared
stub('./coachIntelligence',{clearAccountContext:id=>{cleared=id}})
const {signToken,authMiddleware}=require('../middleware/auth')
const app=express();app.use('/user',require('../routes/user'));app.get('/private',authMiddleware,(_q,r)=>r.json({ok:true}))
test('HTTP account deletion invalidates old tokens without claiming to cancel Apple billing; a new account gets its own session',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`,headers={authorization:'Bearer '+signToken('old')}
 try{
  const deletion=await fetch(base+'/user/account',{method:'DELETE',headers});assert.equal(deletion.status,200);assert.deepEqual(await deletion.json(),{success:true,appleSubscriptionCancelled:false});assert.equal(cleared,'old')
  assert.equal((await fetch(base+'/private',{headers})).status,401)
  assert.equal((await fetch(base+'/user/account',{method:'DELETE',headers})).status,401)
  database.prepare('INSERT INTO users VALUES (?)').run('new')
  assert.equal((await fetch(base+'/private',{headers:{authorization:'Bearer '+signToken('new')}})).status,200)
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));database.close()}
})
