const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const express = require('express')
// Isolate route tests from disk, external services, and live model calls.
const db = new Database(':memory:')
db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, subscription_tier TEXT, pro_trial_expires_at TEXT, is_pro INTEGER);
  INSERT INTO users VALUES('a','premium',NULL,1),('b','premium',NULL,1),('free','free',NULL,0);
  CREATE TABLE personalized_recommendations(user_id TEXT,context_key TEXT,payload TEXT,PRIMARY KEY(user_id,context_key));
  CREATE TABLE daily_checkins(id TEXT PRIMARY KEY,user_id TEXT,checkin_date TEXT,water_glasses INTEGER,skincare_am INTEGER,skincare_pm INTEGER,exercises_done INTEGER,mood_score INTEGER,UNIQUE(user_id,checkin_date));
  CREATE TABLE streaks(user_id TEXT PRIMARY KEY,current_streak INTEGER,longest_streak INTEGER,last_checkin_date TEXT);`)
const stub = (path, exports) => { require.cache[require.resolve(path)] = { id:require.resolve(path), filename:require.resolve(path), loaded:true, exports } }
stub('../db', db)
stub('../supabase', {getSupabase:()=>null, getUserById:async()=>null})
stub('../middleware/ratelimit', {createLimiter:()=>async()=>true})
let modelCalls = 0
stub('@anthropic-ai/sdk', class { messages = { create: async () => {
  modelCalls++
  return {content:[{text:JSON.stringify([{name:'Cleanser', description:'For acne', searchQuery:'CeraVe cleanser'}])}]}
} } })
process.env.ANTHROPIC_API_KEY = 'test-placeholder'
const { signToken } = require('../middleware/auth')
const app = express()
app.use(express.json())
app.use('/products', require('../routes/products'))
app.use('/checkin', require('../routes/checkin'))
let server
let base
const { before, after } = require('node:test')
before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve) })
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { await new Promise(resolve => server.close(resolve)); db.close() })
async function request(path, user, body = {}) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${signToken(user)}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}
test('authenticated routes reuse saved AI results, isolate accounts, enforce Pro, and reject invalid input', async () => {
  assert.equal((await request('/products/recommendations', null)).status,401)
  assert.equal((await request('/products/recommendations','free')).status,403)
  assert.equal((await request('/products/recommendations','a',{skinIssues:'bad'})).status,400)
  const input={scanId:'scan1', skinIssues:['acne'], skinScore:4}
  const first=await request('/products/recommendations','a',input)
  assert.equal(first.status,200)
  assert.equal(first.body.source,'ai')
  assert.ok(first.body.routine.pm.includes('Benzoyl Peroxide 2.5%'))
  assert.deepEqual((await request('/products/recommendations','a',input)).body,first.body)
  assert.equal(modelCalls,1)
  await request('/products/recommendations','b',{...input,userId:'a'})
  assert.equal(modelCalls,2)
  assert.equal(db.prepare('SELECT count(*) n FROM personalized_recommendations').get().n,2)
  const firstCheckin=await request('/checkin','a',{waterGlasses:2})
  assert.equal(firstCheckin.status,200)
  assert.equal((await request('/checkin','a',{waterGlasses:8,userId:'b'})).body.streak.current_streak,1)
  assert.equal(db.prepare("SELECT count(*) n FROM daily_checkins WHERE user_id='b'").get().n,0)
})
