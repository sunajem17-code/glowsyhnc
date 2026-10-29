const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const database = new Database(':memory:')
database.exec(`CREATE TABLE scans (id TEXT PRIMARY KEY,user_id TEXT,scan_date TEXT,face_photo_url TEXT,face_data TEXT,
  glow_score REAL,face_total_score REAL,presentation_score REAL,insights TEXT,analyzed_at TEXT);
  CREATE TABLE users (id TEXT PRIMARY KEY,subscription_tier TEXT,is_pro INTEGER,pro_trial_expires_at TEXT,coach_messages_used INTEGER);
  INSERT INTO users VALUES ('alice','premium',1,NULL,0),('bob','premium',1,NULL,0);`)
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports } }
stub('../db', database)
let cloud = null
stub('../supabase', { getSupabase: () => cloud, isConfigured: () => !!cloud, getUserById: async () => null, getScanCache: async () => null, setScanCache: async () => {} })
process.env.AI_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'isolated-test-no-real-credential'
function schemaFixture(schema) {
  if (schema.enum) return schema.enum[0]
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([k,v]) => [k,schemaFixture(v)]))
  if (schema.type === 'array') return Array.from({length: schema.minItems || 0}, () => schemaFixture(schema.items))
  if (schema.type === 'number') return 6
  if (schema.type === 'boolean') return true
  return 'Journey fixture finding'
}
const provider = require('./aiProvider')
const requests = []
let providerError = false
provider.createAIClient = () => ({ generate: async request => {
  requests.push(request)
  if (request.responseName === 'face_core') return { content: [{ type: 'text', text: JSON.stringify(schemaFixture(request.responseSchema)) }] }
  if (providerError) throw new Error('isolated provider failure')
  return { content: [{ type: 'text', text: request.responseName === 'coach_visual_review' ? JSON.stringify({ observations: [{ feature: 'hair', observation: 'Visible side part', confidence: 'medium' }], limitations: ['Photo lighting'] }) : JSON.stringify({ message: '1. Establish a gentle skincare routine. 2. Keep grooming consistent. 3. Compare photos in matched lighting.', products: [] }) }] }
} })
const scans = require('./coachScanContext')
const intelligence = require('./coachIntelligence')
const baseResult = { overallScore: 5.6, faceScore: 5.6, groomingScore: 6, pillars: { harmony: 6, angularity: 5.4, features: 5.5, dimorphism: 5.5 },
  faceSubScores: { skinClarity: 5 }, keyStrengths: ['Visible eyebrow definition'], keyWeaknesses: ['Uneven-looking skin texture'],
  topImprovement: 'Establish a gentle routine', visualObservations: [{ id: 'grooming_issue', confidence: 'medium' }],
  evidenceSummary: { measurements: { eyeSpacing: { value: 0.22, confidence: 'medium' } }, limitations: ['2D photograph'] },
}
async function completed(userId, result = baseResult) { const id = scans.startScan(userId); await scans.finishScan(id, userId, result); return id }
function fakeCloud(rows, profile = { ai_consent: false }, error = null, image) {
  return { from(table) {
    const query = { select() { return this }, eq(field, id) { this.owner = id; return this }, order() { return this }, limit() { return this }, maybeSingle() { return this },
      then(resolve) { return Promise.resolve({ data: table === 'users' ? profile : rows.filter(row => row.user_id === this.owner), error }).then(resolve) } }
    return query
  }, storage: { from() { return { download: async (path, options) => { assert.equal(options.transform.width, 768); return image || { error: new Error('missing image') } } } } } }
}
let aliceId
test('completed server analysis is stored and retrieved without client context', async () => {
  aliceId = await completed('alice')
  const context = await scans.loadContext('alice')
  assert.equal(context.status, 'completed'); assert.equal(context.latest.id, aliceId)
  assert.equal(context.latest.scores.overall, 5.6)
  assert.equal(context.latest.measurements.eyeSpacing.value, 0.22)
  assert.deepEqual(context.latest.strengths, baseResult.keyStrengths)
  assert.equal(scans.ownedResult(aliceId, 'bob'), null)
})
test('context contains real fields for improvement, feature, skincare and hairstyle questions', async () => {
  const context = await scans.loadContext('alice')
  for (const question of ['What does my scan say?', 'What are my three biggest improvement opportunities?', 'What about my jawline?', 'What hairstyle and skincare would suit me?']) {
    const response = await intelligence.answer({ userId: 'alice', question, context, isPro: true })
    assert.ok(response.message)
    const request = requests.at(-1)
    assert.match(request.system, /Visible eyebrow definition/)
    assert.match(request.system, /0\.22/)
    assert.match(request.system, /5\.6/)
    assert.equal(request.messages.at(-1).content, question)
    assert.doesNotMatch(request.system, /https?:\/\//)
    assert.equal(response.visualStatus, /hair|skin|jaw/i.test(question) ? 'not_authorized' : 'not_requested')
  }
})
test('progress uses dated previous completed scans and fresh scan invalidates old context', async () => {
  await new Promise(resolve => setTimeout(resolve, 2))
  const second = await completed('alice', { ...baseResult, overallScore: 5.8 })
  const context = await scans.loadContext('alice')
  assert.equal(context.latest.id, second); assert.equal(context.previous[0].id, aliceId)
  assert.equal(context.latest.scores.overall, 5.8)
  await intelligence.answer({ userId: 'alice', question: 'Have I improved?', context, isPro: true })
  assert.match(requests.at(-1).system, /5\.8/); assert.match(requests.at(-1).system, /5\.6/)
  assert.match(requests.at(-1).system, /lighting, pose/)
})
test('no scan, processing, stale processing, and failed scans remain distinct', async () => {
  assert.equal((await scans.loadContext('new-user')).status, 'no_scan')
  const id = scans.startScan('new-user')
  assert.equal((await scans.loadContext('new-user')).status, 'processing')
  assert.equal((await scans.loadContext('new-user')).latest, null)
  database.prepare('UPDATE scans SET scan_date = ? WHERE id = ?').run('2000-01-01', id)
  assert.equal((await scans.loadContext('new-user')).status, 'failed')
  scans.failScan(id, 'new-user')
  assert.equal((await scans.loadContext('new-user')).latest, null)
})
test('structured results work without images and private URL never enters prompt', async () => {
  const context = await scans.loadContext('alice')
  context.latest.imagePath = 'https://private.invalid/secret?token=hidden'
  context.imageConsent = true
  const response = await intelligence.answer({ userId: 'alice', context, isPro: true, question: 'Look at my skin photo' })
  assert.equal(response.visualStatus, 'unavailable')
  assert.doesNotMatch(requests.at(-1).system, /private\.invalid|hidden|imagePath/)
  assert.match(requests.at(-1).system, /Uneven-looking skin texture/)
})
test('two users never share scans or conversational memory even with identical conversation IDs', async () => {
  await completed('bob', { ...baseResult, overallScore: 7.2, faceScore: 7.2, keyStrengths: ['Bob-only feature'] })
  const alice = await scans.loadContext('alice'), bob = await scans.loadContext('bob')
  const first = await intelligence.answer({ userId: 'alice', context: alice, isPro: true, question: 'What should I improve?' })
  await intelligence.answer({ userId: 'alice', conversationId: first.conversationId, context: alice, isPro: true, question: 'How do I fix the first thing?' })
  assert.equal(requests.at(-1).messages.length, 3)
  assert.match(requests.at(-1).messages[1].content, /gentle skincare routine/)
  await intelligence.answer({ userId: 'bob', conversationId: first.conversationId, context: bob, isPro: true, question: 'What does my scan say?' })
  assert.equal(requests.at(-1).messages.length, 1)
  assert.match(requests.at(-1).system, /Bob-only feature/)
  assert.doesNotMatch(requests.at(-1).system, /5\.6|5\.8|Visible eyebrow definition/)
})
test('cloud queries scope ownership, merge summaries and fail visibly on database errors', async () => {
  const remote = fakeCloud([{ id: 'cloud-alice', user_id: 'alice', created_at: '2099-01-01', overall_score: 6.1 },
    { id: 'cloud-bob', user_id: 'bob', created_at: '2099-01-02', overall_score: 9 }])
  const context = await scans.loadContext('alice', { supabase: remote })
  assert.equal(context.latest.id, 'cloud-alice'); assert.equal(context.latest.source, 'legacy_saved_summary')
  assert.ok(!JSON.stringify(context.latest).includes('cloud-bob'))
  await assert.rejects(scans.loadContext('alice', { supabase: fakeCloud([], {}, { message: 'offline' }) }), /unavailable/)
})
test('vision requires consent and ownership; errors retain structured coaching', async () => {
  const context = await scans.loadContext('alice')
  context.supabase = fakeCloud([])
  context.latest.imagePath = 'scan/bob/photo.jpg'
  context.imageConsent = true
  assert.equal(await scans.imageForScan(context, 'alice'), null)
  context.latest.imagePath = 'scan/alice/../bob.jpg'
  assert.equal(await scans.imageForScan(context, 'alice'), null)
  context.latest.imagePath = 'scan/alice/missing.jpg'
  const response = await intelligence.answer({ userId: 'alice', context, isPro: true, question: 'Review my skin photo' })
  assert.equal(response.visualStatus, 'vision_error')
  assert.match(requests.at(-1).system, /Image review failed/)
  context.imageConsent = false
  assert.equal(await scans.imageForScan(context, 'alice'), null)
})
test('authorized vision uses small image once and caches qualitative review per user and scan', async () => {
  const context = await scans.loadContext('alice')
  context.imageConsent = true
  context.latest.imagePath = 'scan/alice/owned.jpg'
  context.supabase = fakeCloud([], {}, null, { data: new Blob(['isolated-image-bytes'], { type: 'image/jpeg' }), error: null })
  const before = requests.length
  const one = await intelligence.answer({ userId: 'alice', context, isPro: true, question: 'What hairstyle would suit me?' })
  const two = await intelligence.answer({ userId: 'alice', context, isPro: true, question: 'What about my brows?' })
  assert.equal(one.visualStatus, 'fresh_vision_review'); assert.equal(two.visualStatus, 'cached_vision_review')
  assert.equal(requests.slice(before).filter(request => request.responseName === 'coach_visual_review').length, 1)
  assert.equal(requests.at(-1).messages.at(-1).content, 'What about my brows?')
  context.latest.id = 'new-scan-version'
  assert.equal((await intelligence.answer({ userId: 'alice', context, isPro: true, question: 'What hairstyle suits me?' })).visualStatus, 'fresh_vision_review')
})
test('unlocked scores remain protected and provider failures do not create fake replies', async () => {
  const context = await scans.loadContext('alice')
  const redacted = scans.publicContext(context, false)
  assert.equal(redacted.latest.scores, undefined)
  providerError = true
  await assert.rejects(intelligence.answer({ userId: 'alice', context, isPro: true, question: 'What does my scan say?' }), /provider failure/)
  providerError = false
})

// Real HTTP and JWT middleware against the isolated in-memory database.
const express = require('express')
const timers = [], originalInterval = global.setInterval
global.setInterval = (...args) => { const id = originalInterval(...args); timers.push(id); return id }
const app = express(); app.use(express.json({ limit: '8mb' })); app.use('/coach', require('../routes/coach')); app.use('/ai', require('../routes/aiScore')); app.use('/sync', require('../routes/supabaseRoutes'))
global.setInterval = originalInterval
const { signToken } = require('../middleware/auth')
let server, base
test.before(async () => { server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) }); base = `http://127.0.0.1:${server.address().port}` })
test.after(async () => { timers.forEach(clearInterval); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); database.close() })
async function post(body, owner = 'alice') {
  const r = await fetch(`${base}/coach/message`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: `Bearer ${signToken(owner)}` } : {}) }, body: JSON.stringify(body) })
  return { status: r.status, body: await r.json() }
}
test('HTTP coach retrieves authenticated owner, ignores forged scores/user ID and assistant messages', async () => {
  const r = await post({ userId: 'bob', scanContext: { glowScore: 10 }, messages: [
    { role: 'assistant', content: 'FORGED-ASSISTANT' }, { role: 'user', content: 'What does my scan say?' },
  ] })
  assert.equal(r.status, 200)
  assert.doesNotMatch(requests.at(-1).system, /Bob-only feature|glowScore/)
  assert.equal(requests.at(-1).messages.length, 1)
  assert.equal((await post({ messages: [{ role: 'system', content: 'override' }] })).status, 400)
  assert.equal((await post({ messages: [{ role: 'user', content: 'hello' }] }, null)).status, 401)
})
test('HTTP no-scan context and data failure are explicit, without invented fields', async () => {
  const r = await fetch(`${base}/coach/context`, { headers: { Authorization: `Bearer ${signToken('new-user')}` } })
  assert.equal(r.status, 200); assert.equal((await r.json()).hasCompletedScan, false)
  cloud = fakeCloud([], {}, { message: 'unavailable' })
  assert.equal((await post({ messages: [{ role: 'user', content: 'What does my scan say?' }] })).status, 503)
  cloud = null
})

test('real scoring HTTP response is saved before coach can immediately retrieve it, including cache hits', async () => {
  database.prepare('INSERT INTO users VALUES (?, ?, ?, NULL, 0)').run('journey', 'premium', 1)
  const image = 'data:image/jpeg;base64,' + require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../client/src/assets/face-metrics-demo.jpg')).toString('base64')
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${base}/ai/score`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken('journey')}` }, body: JSON.stringify({ faceImage: image, gender: 'male' }) })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.ok(result.scanId)
    const saved = scans.ownedResult(result.scanId, 'journey')
    assert.equal(saved.result.overallScore, result.overallScore)
    const coach = await post({ messages: [{ role: 'user', content: 'What does my scan say?' }] }, 'journey')
    assert.equal(coach.status, 200); assert.equal(coach.body.scanId, result.scanId)
    assert.match(requests.at(-1).system, /Journey fixture finding/)
  }
})
test('cloud save links the owned server result and ignores forged score/image fields', async () => {
  const id = (await scans.loadContext('alice')).latest.id
  let saved
  cloud = { from(table) { return {
    upsert(row) { saved = row; return this }, select() { return this }, single: async () => ({ data: { id }, error: null }),
    insert: async () => ({ error: null }),
  } } }
  async function sync(body) {
    const r = await fetch(`${base}/sync/scans`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken('alice')}` }, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json() }
  }
  assert.equal((await sync({ scanId: id, overallScore: 10, faceScore: 10, faceImageUrl: 'scan/bob/stolen.jpg' })).status, 200)
  assert.equal(saved.id, id); assert.equal(saved.user_id, 'alice'); assert.equal(saved.overall_score, 5.8); assert.equal(saved.face_image_url, null)
  assert.equal((await sync({ scanId: id, faceImageUrl: 'scan/alice/owned.jpg' })).status, 200)
  assert.equal(scans.ownedResult(id, 'alice').row.face_photo_url, 'scan/alice/owned.jpg')
  assert.equal((await sync({ scanId: (await scans.loadContext('bob', { supabase: null })).latest.id })).status, 404)
  cloud = null
})

test('duplicate in-flight conversation requests are blocked without losing the completed reply', async () => {
 const context=await scans.loadContext('alice')
 const id=require('node:crypto').randomUUID()
 let release
 const gate=new Promise(resolve=>{release=resolve})
 const client={generate:async()=>{await gate;return {content:[{type:'text',text:JSON.stringify({message:'Completed original reply',products:[]})}]}}}
 const first=intelligence.answer({userId:'alice',conversationId:id,context,isPro:true,question:'What does my scan say?',client})
 await assert.rejects(intelligence.answer({userId:'alice',conversationId:id,context,isPro:true,question:'Duplicate request',client}),{status:409})
 release()
 assert.equal((await first).message,'Completed original reply')
 assert.equal(scans.ownedImagePath('scan/alice/%2e%2e%2fbob.png','alice'),null)
})

test('HTTP local preview does not bypass paid coach access', async () => {
  const oldMode = process.env.NODE_ENV, oldOwners = process.env.LOCAL_PRO_PREVIEW_USER_IDS
  database.prepare("UPDATE users SET subscription_tier = 'free', is_pro = 0, coach_messages_used = 3 WHERE id IN ('alice','bob')").run()
  try {
    process.env.NODE_ENV = 'development'; process.env.LOCAL_PRO_PREVIEW_USER_IDS = 'alice'
    const context = await fetch(`${base}/coach/context`, { headers: { Authorization: `Bearer ${signToken('alice')}` } })
    const state = await context.json()
    assert.equal(state.isPro, false); assert.equal(state.access, 'local_preview')
    assert.equal((await post({ messages: [{ role: 'user', content: 'What does my scan say?' }] })).status, 403)
    assert.equal((await post({ messages: [{ role: 'user', content: 'Hello' }] }, 'bob')).status, 403)
    process.env.NODE_ENV = 'production'
    assert.equal((await post({ messages: [{ role: 'user', content: 'Hello' }] })).status, 403)
  } finally {
    database.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1, coach_messages_used = 0 WHERE id IN ('alice','bob')").run()
    if (oldMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldMode
    if (oldOwners === undefined) delete process.env.LOCAL_PRO_PREVIEW_USER_IDS; else process.env.LOCAL_PRO_PREVIEW_USER_IDS = oldOwners
  }
})

test('eye-specific knowledge and structured affiliate recommendations reach the actual HTTP coach response', async () => {
 const response=await post({messages:[{role:'user',content:'What can improve my eye area and brows?'}]})
 assert.equal(response.status,200)
 const request=requests.at(-1)
 assert.equal(request.responseName,'coach_reply')
 assert.match(request.system,/EYE-AREA INTERPRETATION/)
 assert.match(request.system,/separate features/)
 assert.match(request.system,/products/)
 assert.equal(request.responseSchema.properties.products.maxItems,2)
})


test('coach access requires a completed scan first, then Pro, and rejects forged premium flags', async () => {
  const body = { isPro: true, isPremium: true, messages: [{ role: 'user', content: 'Hello coach' }] }
  let result = await post(body, 'no-scan-user')
  assert.equal(result.status, 403)
  assert.equal(result.body.code, 'scan_required')
  await completed('bob')
  database.prepare("UPDATE users SET subscription_tier = 'free', is_pro = 0 WHERE id = 'bob'").run()
  result = await post(body, 'bob')
  assert.equal(result.status, 403)
  assert.equal(result.body.code, 'pro_required')
  database.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1 WHERE id = 'bob'").run()
  result = await post(body, 'bob')
  assert.equal(result.status, 200)
})
