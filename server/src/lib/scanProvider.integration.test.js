const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const schemas = require('./aiSchemas')
const provider = require('./aiProvider')

// All persistence is isolated in memory. No real user/database/cache is touched.
const persistedScans = new Map()
const noQuery = { get: () => ({ subscription_tier: 'premium', is_pro: 1, coach_messages_used: 0 }), all: () => [], run: (...args) => {
  if (typeof args[0] === 'string' && args.length > 1) persistedScans.set(args[args.length - 2], args[0])
  return { changes: 1 }
} }
const dbPath = require.resolve('../db')
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prepare: () => noQuery } }
const supabasePath = require.resolve('../supabase')
const cacheKeys = []
let persistentCache = null
require.cache[supabasePath] = { id: supabasePath, filename: supabasePath, loaded: true, exports: {
  getSupabase: () => null, getUserById: async () => null,
  getScanCache: async key => { cacheKeys.push(key); return persistentCache }, setScanCache: async () => {},
} }

function fixture(schema) {
  if (schema.enum) return schema.enum[0]
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, fixture(value)]))
  if (schema.type === 'array') return Array.from({ length: schema.minItems || 0 }, () => fixture(schema.items))
  if (schema.type === 'integer') return schema.minimum ?? 1
  if (schema.type === 'number') return schema.maximum === 10 ? 6 : 1
  if (schema.type === 'boolean') return true
  return 'Isolated integration fixture'
}
const core = { ...fixture(schemas.core(true)), facial_structure: 'defined', hair_type: 'straight' }
const coreWithoutSide = { ...fixture(schemas.core(false)), facial_structure: 'defined', hair_type: 'straight' }
const supportedStrengths = ['Balanced symmetry', 'Cohesive facial proportions', 'Defined cheek contour', 'Open eye area', 'Even facial balance']
const supportedWeaknesses = ['Mild skin texture', 'Soft jaw definition', 'Under-eye contrast', 'Longer lower third', 'Hair presentation']
core.key_strengths = [...supportedStrengths]
core.key_weaknesses = [...supportedWeaknesses]
coreWithoutSide.key_strengths = [...supportedStrengths]
coreWithoutSide.key_weaknesses = [...supportedWeaknesses]
const metricFinding = (title, observation, metric_keys) => ({ title, observation,
  significance: 'This affects the visible balance of the face.',
  recommendation: 'Use a practical, low-risk next step.', metric_keys })
const detailedFindings = {
  strengths: [
    metricFinding('Balanced symmetry', 'The eyes and midline appear balanced.', ['sub_symmetry']),
    metricFinding('Defined jaw edge', 'The lower jaw edge is visible.', ['metric_jawline']),
    metricFinding('Cohesive proportions', 'The facial thirds appear balanced.', ['sub_facial_proportions']),
    metricFinding('Even cheek contour', 'The cheek contour reads evenly from the front.', ['metric_cheekbones']),
    metricFinding('Clear eye area', 'The eye area appears open in this lighting.', ['sub_eye_area']),
  ],
  improvement_opportunities: [
    metricFinding('Skin texture', 'Mild texture is visible in the supplied light.', ['metric_skin_quality']),
    metricFinding('Jaw definition', 'The jaw edge looks soft from the front.', ['sub_jawline_definition']),
    metricFinding('Facial thirds', 'The lower third appears slightly longer.', ['metric_facial_thirds']),
    metricFinding('Eye-area contrast', 'Under-eye contrast is visible in this photo.', ['sub_eye_area']),
    metricFinding('Grooming consistency', 'Hair styling appears less controlled here.', ['grooming_score']),
  ],
  positive_observations: [],
}
core.appearance_analysis = structuredClone(detailedFindings)
coreWithoutSide.appearance_analysis = structuredClone(detailedFindings)
const originalCreate = provider.createAIClient
const calls = []
let invalidCore = false
provider.createAIClient = () => originalCreate({
  env: process.env, logger: { info() {} },
  openai: { responses: { create: async request => {
    calls.push({ provider: 'openai', request })
    const name = request.text?.format?.name
    let data = fixture(request.text?.format?.schema || { type: 'string' })
    if (name === 'face_core') data = invalidCore ? {} : structuredClone(request.text.format.schema.properties.profile ? core : coreWithoutSide)
    if (name === 'photo_validation') data = { valid: true, faceCount: 1, issues: [] }
    if (name === 'workout_plan') data = { split: 'Full Body', trainingLevel: 'beginner', days: [] }
    return { status: 'completed', output_text: JSON.stringify(data), output: [], usage: { input_tokens: 100, output_tokens: 50 } }
  } } },
  anthropic: { messages: { create: async request => {
    calls.push({ provider: 'anthropic', request })
    return { content: [{ type: 'text', text: JSON.stringify(core) }] }
  } } },
})

const originalEnv = { AI_PROVIDER: process.env.AI_PROVIDER, OPENAI_API_KEY: process.env.OPENAI_API_KEY, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
process.env.AI_PROVIDER = 'openai'
process.env.OPENAI_API_KEY = 'isolated-test-no-real-credential'
process.env.ANTHROPIC_API_KEY = 'isolated-fallback-no-real-credential'
const app = express()
app.use(express.json({ limit: '8mb' }))
// Keep the production limiter intact while owning/cleaning up its maintenance
// timer in this isolated process. No background timer should strand the test.
const maintenanceTimers = []
const originalSetInterval = global.setInterval
global.setInterval = (...args) => { const timer = originalSetInterval(...args); maintenanceTimers.push(timer); return timer }
app.use('/api/ai', require('../routes/aiScore'))
app.use('/api/products', require('../routes/products'))
app.use('/api/swipemaxx', require('../routes/swipemaxx'))
app.use('/api/tindermaxx', require('../routes/tindermaxx'))
app.use('/api/hair', require('../routes/hair'))
app.use('/api/coach', require('../routes/coach'))
global.setInterval = originalSetInterval
let server, base, requestIdentity = 0
test.before(async () => {
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
  base = `http://127.0.0.1:${server.address().port}`
})
test.after(async () => {
  maintenanceTimers.forEach(clearInterval)
  server.closeAllConnections()
  server.closeIdleConnections()
  server.close()
  provider.createAIClient = originalCreate
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
})
async function post(endpoint, data, token = 'demo-token') {
  // Keep simulated production-style per-user quotas isolated between cases.
  if (token === 'demo-token') token = require('../middleware/auth').signToken(`isolated-provider-request-${++requestIdentity}`)
  const response = await fetch(`${base}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(data) })
  return { status: response.status, body: await response.json() }
}
const front = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(__dirname, '../../..', 'client/src/assets/face-metrics-demo.jpg')).toString('base64')
const side = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../../..', 'client/src/assets/side-profile-guide.png')).toString('base64')
const premiumToken = require('../middleware/auth').signToken('isolated-provider-test', 'test@example.invalid')

test('image payload -> real HTTP validation -> scoring -> unchanged client ratings contract', async () => {
  const checked = await post('/api/ai/validate-scan', { imageB64: front })
  assert.equal(checked.status, 200)
  assert.deepEqual(checked.body, { valid: true, faceCount: 1, issues: [] })
  const scored = await post('/api/ai/score', { faceImage: front, sideImage: side, gender: 'male' })
  assert.equal(scored.status, 200)
  assert.equal(scored.body.overallScore, 6)
  assert.equal(scored.body.potentialScore, 7.4)
  assert.equal(scored.body.faceMetrics.skinQuality.score, core.face_metrics.skin_quality.score)
  assert.equal(scored.body.faceMetrics.jawline.score, core.face_metrics.jawline.score)
  assert.equal(scored.body.profileScore, core.profile.profile_score)
  assert.deepEqual(Object.keys(scored.body.pillars), ['harmony', 'angularity', 'features', 'dimorphism'])
  assert.equal(scored.body.topImprovement, core.top_improvement)
  assert.deepEqual(scored.body.keyStrengths, core.key_strengths)
  assert.deepEqual(scored.body.keyWeaknesses, core.key_weaknesses)
  assert.equal(scored.body.keyStrengths.length, 5)
  assert.equal(scored.body.keyWeaknesses.length, 5)
  const savedFaceData = persistedScans.get(scored.body.scanId)
  assert.ok(savedFaceData, 'fresh scoring response is saved to the server scan history')
  const savedResult = JSON.parse(savedFaceData).result
  assert.equal(savedResult.appearanceAnalysis.strengths.length, 5)
  assert.equal(savedResult.appearanceAnalysis.improvementOpportunities.length, 5)
  assert.equal(savedResult.appearanceAnalysis.scanId, scored.body.scanId)
  assert.equal(scored.body.appearanceAnalysis.version, 10)
  assert.equal(scored.body.appearanceAnalysis.scanId, scored.body.scanId)
  assert.equal(scored.body.appearanceAnalysis.strengths.length, 5)
  assert.equal(scored.body.appearanceAnalysis.improvementOpportunities.length, 5)
  assert.equal(scored.body.appearanceAnalysis.strengths[0].title, 'Balanced symmetry')
  assert.equal(scored.body.appearanceAnalysis.strengths[0].scoreReferences[0].score, core.sub_scores.symmetry)
  assert.equal(scored.body.appearanceAnalysis.improvementOpportunities[0].scoreReferences[0].score, core.face_metrics.skin_quality.score)
  const coreCall = calls.find(call => call.request.text?.format?.name === 'face_core')
  assert.equal(coreCall.request.input[0].content.filter(block => block.type === 'input_image').length, 2)
  assert.match(coreCall.request.instructions, /Aim for 4–6 strengths and 4–6 improvement opportunities/)
})

test('core scoring schema permits expanded Pros and Cons instead of exactly two', () => {
  const schema = schemas.core(false).properties
  assert.equal(schema.key_strengths.minItems, undefined)
  assert.equal(schema.key_strengths.maxItems, 6)
  assert.equal(schema.key_weaknesses.maxItems, 6)
  assert.equal(schema.appearance_analysis.properties.strengths.maxItems, 6)
  assert.equal(schema.appearance_analysis.properties.improvement_opportunities.maxItems, 6)
})

test('a cached score is rebound to the ID of each newly saved scan', async () => {
  const before = calls.filter(call => call.request.text?.format?.name === 'face_core').length
  const first = await post('/api/ai/score', { faceImage: front, sideImage: side, gender: 'male' })
  const second = await post('/api/ai/score', { faceImage: front, sideImage: side, gender: 'male' })
  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.notEqual(first.body.scanId, second.body.scanId)
  assert.equal(first.body.appearanceAnalysis.scanId, first.body.scanId)
  assert.equal(second.body.appearanceAnalysis.scanId, second.body.scanId)
  assert.equal(calls.filter(call => call.request.text?.format?.name === 'face_core').length, before)
})

test('a cached score with the old two-point analysis version is rescored', async () => {
  persistentCache = { overallScore: 8, appearanceAnalysis: { version: 9, strengths: [{ title: 'Old point one', observation: 'Old text.' }, { title: 'Old point two', observation: 'Old text.' }], improvementOpportunities: [{ title: 'Old concern one', observation: 'Old text.' }, { title: 'Old concern two', observation: 'Old text.' }] } }
  const before = calls.filter(call => call.request.text?.format?.name === 'face_core').length
  const result = await post('/api/ai/score', { faceImage: front + 'unique-stale-cache', gender: 'male' })
  persistentCache = null
  assert.equal(result.status, 200)
  assert.equal(calls.filter(call => call.request.text?.format?.name === 'face_core').length, before + 1)
  assert.equal(result.body.appearanceAnalysis.version, 10)
})

test('switching to Anthropic does not reuse an OpenAI cached assessment', async () => {
  const before = calls.filter(call => call.provider === 'anthropic').length
  process.env.AI_PROVIDER = 'anthropic'
  const result = await post('/api/ai/score', { faceImage: front, sideImage: side, gender: 'male' })
  assert.equal(result.status, 200)
  assert.equal(calls.filter(call => call.provider === 'anthropic').length, before + 1)
  assert.notEqual(cacheKeys[0], cacheKeys[1])
  process.env.AI_PROVIDER = 'openai'
})

test('invalid structured scores fail without returning average/default scores', async () => {
  invalidCore = true
  const result = await post('/api/ai/score', { faceImage: front + 'different', gender: 'male' })
  invalidCore = false
  assert.equal(result.status, 500)
  assert.equal(result.body.overallScore, undefined)
  assert.equal(result.body.error, 'server_error')
})

test('original authentication is still required and missing payloads are rejected', async () => {
  assert.equal((await post('/api/ai/score', { faceImage: front }, null)).status, 401)
  assert.equal((await post('/api/ai/score', {})).status, 400)
})

test('OpenAI must have its own key even when the fallback key exists', async () => {
  delete process.env.OPENAI_API_KEY
  const result = await post('/api/ai/validate-scan', { imageB64: front })
  assert.equal(result.status, 503)
  assert.equal(result.body.code, 'validation_not_configured')
  process.env.OPENAI_API_KEY = 'isolated-test-no-real-credential'
})

test('extended and physique contracts retain the original metric names and calculation', async () => {
  const extended = await post('/api/ai/score/extended-metrics', { faceImage: front, gender: 'male' }, premiumToken)
  assert.equal(extended.status, 200)
  assert.equal(extended.body.extendedMetrics.eyes.canthalTilt.score, 6)
  assert.equal(extended.body.extendedMetrics.lowerThird.jawWidth.score, 6)
  const physique = await post('/api/ai/score/physique', { bodyImage: front, gender: 'male' }, premiumToken)
  assert.equal(physique.status, 200)
  assert.equal(physique.body.physiqueScore.overall, 6)
})

test('skincare products preserve the five-product response and existing issue context', async () => {
  const result = await post('/api/products/recommendations', { skinIssues: ['visible_acne'], weaknesses: ['skin texture'], gender: 'male' }, premiumToken)
  assert.equal(result.status, 200)
  assert.equal(result.body.source, 'ai')
  assert.equal(result.body.products.length, 5)
  assert.deepEqual(Object.keys(result.body.products[0]), ['name', 'description', 'searchQuery', 'amazonUrl'])
  assert.equal(new URL(result.body.products[0].amazonUrl).searchParams.get('tag'), 'ascendusapp05-20')
  const request = calls.find(call => call.request.text?.format?.name === 'product_recommendations').request
  assert.ok(request.input[0].content.includes('visible_acne'))
  assert.ok(request.input[0].content.includes('skin texture'))
})

test('hairstyle forced-tool output remains compatible with the existing catalog route', async () => {
  const result = await post('/api/hair/recommend', { hairProfile: { hairType: 'coily', density: 'medium', strandThickness: 'medium', desiredLength: 'short', maintenancePreference: 'low' },
    analysisEvidence: { status: 'measured', measurements: [{ id: 'face_width_ratio', value: 1.2, assessable: true, unit: 'ratio', formula: 'width/height' }] } }, premiumToken)
  assert.equal(result.status, 200)
  assert.ok(result.body.recommendations.length > 0)
  assert.ok(result.body.recommendations[0].hairstyleId)
  assert.ok(calls.some(call => call.request.text?.format?.name === 'submit_hair_recommendations'))
})
