const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE scans(id TEXT PRIMARY KEY,user_id TEXT,scan_date TEXT,face_data TEXT,glow_score REAL,face_total_score REAL,presentation_score REAL,insights TEXT,analyzed_at TEXT,face_photo_url TEXT)')
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports } }
stub('../db', db)
stub('../supabase', { getSupabase: () => null })
const originalSetInterval = global.setInterval
const maintenanceTimers = []
global.setInterval = (...args) => { const timer = originalSetInterval(...args); maintenanceTimers.push(timer); return timer }
const { getBreakdown, evidenceFor, CATALOG, cachedBreakdown, schema } = require('./appearanceBreakdown')
global.setInterval = originalSetInterval
const { ownedResult, normalize, publicContext } = require('./coachScanContext')
const original = { overallScore: 6.2, faceScore: 6.2, keyStrengths: ['A visible side part frames the face.'], faceSubScores: { symmetry: 6.8, jawlineDefinition: 5.4 }, visualObservations: [{ id: 'visible_dullness', category: 'skin', confidence: 'medium', limitations: ['Uneven light'] }] }
const finding = { title: 'Balanced symmetry', observation: 'The eyes and facial midline appear balanced.', significance: 'This supports a cohesive front view.', recommendation: 'Keep future photos straight-on for comparison.', confidence: 'high', basedOn: ['photo:front', 'score:faceSubScores.symmetry'] }
const improvement = { title: 'Soft jaw definition', observation: 'The jaw edge is less distinct in this photo.', significance: 'The lower face reads softer from the front.', recommendation: 'Use consistent side lighting to track definition.', confidence: 'medium', basedOn: ['photo:front', 'score:faceSubScores.jawlineDefinition'] }
function result() { return { strengths: [finding], improvementOpportunities: [improvement, ...[
  ['Brow shape', 'The brow line could look tidier.', 'A clean brow edge frames the eyes.', 'Trim only stray hairs between and below the brows.'],
  ['Hair shape', 'The sides and top could have a clearer shape.', 'A planned cut makes the outline look neater.', 'Ask a barber for a tidy low taper and textured top.'],
  ['Facial hair', 'The beard edge could look cleaner.', 'A clear cheek and neck line makes grooming look intentional.', 'Trim stray hairs and keep the beard line even.'],
  ['Lip care', 'The lips look dry.', 'Dry lips can look rough.', 'Use plain lip balm during the day.'],
].map(([title, observation, significance, recommendation]) => ({ ...improvement, title, observation, significance, recommendation, basedOn: ['photo:front'] }))], positiveObservations: [], recommendedActions: [{ title: 'Use consistent photos', reason: 'The saved scan uses mixed lighting.', steps: ['Use the same angle and lighting.'], frequency: 'Each scan', timeframe: '', basedOn: ['photo:front'] }], products: [], limitations: ['Lighting can affect appearance.'] } }
const image = { type:'image', source:{type:'base64',media_type:'image/jpeg',data:'isolated-photo-bytes'} }
const analyze = (userId, id, options = {}) => getBreakdown(userId, id, { loadImage: async () => image, ...options })
let serial = 0
test.after(() => { maintenanceTimers.forEach(clearInterval); db.close() })
function seed(user = 'alice', data = original) { const id = `scan-${++serial}`; db.prepare('INSERT INTO scans (id,user_id,scan_date,face_data,glow_score,face_total_score,presentation_score,insights,analyzed_at,face_photo_url) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,user,new Date().toISOString(),JSON.stringify({kind:'server_analysis_v1',status:'completed',result:data}),6.2,6.2,6.2,'{}',new Date().toISOString(),`scan/${user}/original.jpg`); return id }
function seedLegacy(user = 'alice', data = original) { const id = `legacy-${++serial}`; db.prepare('INSERT INTO scans (id,user_id,scan_date,face_data,glow_score,face_total_score,presentation_score,insights,analyzed_at,face_photo_url) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,user,new Date().toISOString(),JSON.stringify(data),6.2,6.2,6.2,'{}',new Date().toISOString(),`scan/${user}/original.jpg`); return id }
const response = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })

test('personalized analysis persists with the same scan, retains scores, and reaches coach context', async () => {
  const id = seed(); let prompt
  const analysis = await analyze('alice', id, { client: { generate: async request => { prompt=request; return response(result()) } } })
  const saved = ownedResult(id, 'alice')
  assert.equal(saved.result.overallScore, original.overallScore)
  assert.deepEqual(saved.result.appearanceAnalysis, analysis)
  assert.equal(prompt.responseName, 'appearance_breakdown')
  assert.ok(prompt.messages[0].content.some(block => block.type === 'image'))
  assert.ok(prompt.messages[0].content.find(block => block.type === 'text').text.includes('savedScores'))
  assert.match(prompt.system, /Pros must be clearly positive/i)
  assert.match(prompt.system, /Never put a flaw, caveat, or fix-it advice in Pros/i)
  assert.match(prompt.system, /Cons must name a real visible thing to improve and give a Try step/i)
  assert.match(prompt.system, /For brows or facial hair, give a careful grooming step/i)
  assert.match(prompt.system, /Speak to the person face to face/i)
  assert.match(prompt.system, /Do not mention the photo, camera, lighting, angle, image quality, or retaking it/i)
  assert.match(prompt.system, /at least five distinct Cons and always more Cons than Pros/i)
  assert.match(prompt.system, /optional, specific style or grooming upgrades tied to visible features/i)
  assert.match(prompt.system, /Include every distinct useful improvement the evidence supports/i)
  assert.match(prompt.system, /say plainly what is weak, uneven, unclear, or needs work/i)
  assert.match(prompt.system, /Do not claim body fat, bloating, or a health problem from a face alone/i)
  assert.match(prompt.system, /do not diagnose lazy eye/i)
  assert.doesNotMatch(prompt.system, /describe a camera angle or light only when/i)
  assert.match(prompt.system, /Evidence IDs stay internal and must never appear in reader-facing text/i)
  assert.match(prompt.system, /Do a top-to-bottom audit of the visible face/i)
  assert.match(prompt.system, /short everyday words a child can understand/i)
  assert.equal(analysis.version, 15)
  assert.equal(analysis.strengths.length, 1)
  assert.equal(analysis.improvementOpportunities.length, 5)
  const context = publicContext({ status:'completed',latest:normalize(saved.row),previous:[],profile:null },true)
  assert.deepEqual(context.latest.appearanceAnalysis.strengths, analysis.strengths)
  assert.deepEqual(context.latest.appearanceAnalysis.recommendedActions, analysis.recommendedActions)
})
test('coach context preserves all findings and applies existing numeric-score access rules', () => {
  const source = { status:'completed', latest:{ id:'scan', appearanceAnalysis:{
    strengths:[{title:'Symmetry',observation:'Balanced.',metricKeys:['sub_symmetry'],scoreReferences:[{key:'sub_symmetry',score:7.1}]}],
    improvementOpportunities:[{title:'Skin texture',observation:'Texture is visible.',metricKeys:['metric_skin_quality'],scoreReferences:[{key:'metric_skin_quality',score:5.2}]}],
  }, scores:{overall:6.4} }, previous:[], profile:null }
  const pro = publicContext(source, true)
  const free = publicContext(source, false)
  assert.equal(pro.latest.appearanceAnalysis.strengths[0].scoreReferences[0].score, 7.1)
  assert.equal(pro.latest.appearanceAnalysis.improvementOpportunities.length, 1)
  assert.equal(free.latest.appearanceAnalysis.strengths[0].scoreReferences, undefined)
  assert.equal(free.latest.appearanceAnalysis.improvementOpportunities[0].observation, 'Texture is visible.')
  assert.equal(free.latest.scores, undefined)
  assert.equal(source.latest.appearanceAnalysis.strengths[0].scoreReferences[0].score, 7.1)
})
test('cached analysis is reused without another AI request', async () => {
  const id=seed(); await analyze('alice',id,{client:{generate:async()=>response(result())}})
  await analyze('alice',id,{client:{generate:async()=>{throw new Error('must not call')}}})
})
test('keeps every distinct supported finding when a scan has more than six', async () => {
  assert.equal(schema.properties.strengths.maxItems, 4)
  assert.equal(schema.properties.improvementOpportunities.minItems, 5)
  assert.equal(schema.properties.improvementOpportunities.maxItems, undefined)
  const id = seed()
  const many = (prefix, count) => Array.from({ length: count }, (_, index) => ({
    ...finding,
    title: `${prefix} ${index + 1}`,
    observation: `A distinct visible detail about ${prefix.toLowerCase()} ${index + 1}.`,
    basedOn: ['photo:front'],
  }))
  const analysis = await analyze('alice', id, { client: { generate: async () => response({
    ...result(),
    strengths: many('Strength', 4),
    improvementOpportunities: many('Improvement', 9),
  }) } })
  assert.equal(analysis.strengths.length, 4)
  assert.equal(analysis.improvementOpportunities.length, 9)
  assert.equal(cachedBreakdown(ownedResult(id, 'alice').result, id).strengths.length, 4)
})
test('version-14 analysis is refreshed with the five-Cons, direct advice rules', async () => {
  const old = { ...original, appearanceAnalysis: { ...result(), version: 14, scanId: 'old-scan' } }
  const id = seed('alice', old)
  const analysis = await analyze('alice', id, { client: { generate: async () => response(result()) } })
  assert.equal(analysis.version, 15)
  assert.equal(analysis.scanId, id)
  assert.equal(ownedResult(id, 'alice').result.appearanceAnalysis.version, 15)
})
test('production version-3 two-point analysis is refreshed from its owner-scoped photo without changing scores or history', async () => {
  // Production v3 treated any saved arrays as current and skipped reanalysis.
  const old = { ...original, appearanceAnalysis: { version: 3, strengths: [{ title: 'Old point one', observation: 'Old text.' }, { title: 'Old point two', observation: 'Old text.' }], improvementOpportunities: [{ title: 'Old concern one', observation: 'Old text.' }, { title: 'Old concern two', observation: 'Old text.' }] } }
  const id = seed('alice', old)
  const five = prefix => Array.from({ length: 5 }, (_, index) => ({ ...finding, title: `${prefix} ${index + 1}`, observation: `Distinct visible photo evidence ${index + 1}.`, basedOn: ['photo:front'] }))
  let photoWasLoaded = false
  const analysis = await analyze('alice', id, {
    loadImage: async ({ scan, userId }) => { photoWasLoaded = true; assert.equal(userId, 'alice'); assert.equal(scan.imagePath, 'scan/alice/original.jpg'); return image },
    client: { generate: async () => response({ ...result(), strengths: five('Supported strength').slice(0, 4), improvementOpportunities: five('Supported improvement') }) },
  })
  const saved = ownedResult(id, 'alice')
  assert.equal(photoWasLoaded, true)
  assert.equal(analysis.source, 'saved_scan_photo')
  assert.equal(analysis.strengths.length, 4)
  assert.equal(analysis.improvementOpportunities.length, 5)
  assert.ok(!analysis.strengths.some(point => point.title === 'Old point one'))
  assert.ok(!analysis.improvementOpportunities.some(point => point.title === 'Old concern one'))
  assert.equal(saved.result.overallScore, original.overallScore)
  assert.equal(saved.row.face_photo_url, 'scan/alice/original.jpg')
  assert.equal(saved.result.appearanceAnalysis.version, 15)
  assert.equal(cachedBreakdown({ appearanceAnalysis: old.appearanceAnalysis }, id), null)
})
test('legacy local scan history is reanalyzed and its old score data stays intact', async () => {
  const id = seedLegacy('alice', { ...original, appearanceAnalysis: { version: 2, strengths: [{ title: 'Only old point', observation: 'Old.' }], improvementOpportunities: [{ title: 'Old concern', observation: 'Old.' }] } })
  const analysis = await analyze('alice', id, { client: { generate: async () => response(result()) } })
  const row = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(id, 'alice')
  const saved = JSON.parse(row.face_data)
  assert.equal(analysis.scanId, id)
  assert.equal(saved.overallScore, original.overallScore)
  assert.equal(saved.keyStrengths[0], original.keyStrengths[0])
  assert.equal(saved.appearanceAnalysis.version, 15)
  assert.equal(row.face_photo_url, 'scan/alice/original.jpg')
  assert.equal(normalize(row).appearanceAnalysis.version, 15)
})
test('another owner cannot read, generate or overwrite a scan', async () => {
  const id=seed('bob')
  await assert.rejects(analyze('alice',id,{client:{generate:async()=>{throw new Error('must not call')}}}),{status:404})
  assert.equal(ownedResult(id,'bob').result.appearanceAnalysis,undefined)
})
test('concurrent requests share one generation', async () => {
  const id=seed();let calls=0
  const client={generate:async()=>{calls++;await new Promise(resolve=>setImmediate(resolve));return response(result())}}
  const [a,b]=await Promise.all([analyze('alice',id,{client}),analyze('alice',id,{client})])
  assert.deepEqual(a,b);assert.equal(calls,1)
})
test('failed provider leaves the scan intact and permits retry', async () => {
  const id=seed()
  await assert.rejects(analyze('alice',id,{client:{generate:async()=>{throw new Error('provider failure')}}}),/provider failure/)
  assert.equal(ownedResult(id,'alice').result.appearanceAnalysis,undefined)
  assert.equal((await analyze('alice',id,{client:{generate:async()=>response(result())}})).scanId,id)
})
test('unsupported evidence and invented catalogue IDs are rejected', async () => {
  for(const mutate of [data=>data.strengths[0].basedOn=['invented'],data=>data.products=[{catalogId:'imaginary',reason:'test',basedOn:['strength:0']} ]]) {
    const id=seed(), data=structuredClone(result());mutate(data)
    await assert.rejects(analyze('alice',id,{client:{generate:async()=>response(data)}}))
    assert.equal(ownedResult(id,'alice').result.appearanceAnalysis,undefined)
  }
})
test('an existing scan without an available original photo cannot be reanalyzed', async () => {
  const id=seed('alice',{visualObservations:[{id:'visible_dullness',confidence:'low'}]})
  assert.deepEqual(evidenceFor(ownedResult(id,'alice').result),[])
  await assert.rejects(analyze('alice',id,{loadImage:async()=>null}),{status:422})
  assert.equal(ownedResult(id,'alice').result.appearanceAnalysis,undefined)
})
test('uses the scan photo sent with the request when cloud photo upload has not finished', async () => {
  const id = seed('alice', { ...original, appearanceAnalysis: undefined })
  let prompt
  const providedPhoto = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'photo-from-current-scan' } }
  const analysis = await analyze('alice', id, {
    loadImage: async () => null,
    providedPhoto,
    client: { generate: async request => { prompt = request; return response(result()) } },
  })
  assert.equal(analysis.scanId, id)
  assert.ok(prompt.messages[0].content.includes(providedPhoto))
  assert.equal(ownedResult(id, 'alice').result.appearanceAnalysis.scanId, id)
})
test('catalogue product links keep the existing affiliate tag and have no invented prices', async () => {
  const id=seed(),data=result();data.products=[{catalogId:'daily_lotion',reason:'Optional hydration for the saved skin concern.',basedOn:['observation:visible_dullness']}]
  const analysis=await analyze('alice',id,{client:{generate:async()=>response(data)}})
  const product=analysis.products[0],url=new URL(product.amazonUrl)
  assert.equal(url.hostname,'www.amazon.ca');assert.equal(url.searchParams.get('tag'),'ascendusapp05-20')
  assert.equal(product.imageUrl,CATALOG.daily_lotion.imageUrl);assert.equal(product.price,undefined);assert.equal(product.rating,undefined)
  assert.equal(new URL(product.sourceUrl).hostname,'www.cerave.ca')
})
