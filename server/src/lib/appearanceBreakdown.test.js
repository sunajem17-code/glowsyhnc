const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE scans(id TEXT PRIMARY KEY,user_id TEXT,scan_date TEXT,face_data TEXT,glow_score REAL,face_total_score REAL,presentation_score REAL,insights TEXT,analyzed_at TEXT)')
function stub(name, exports) { const id = require.resolve(name); require.cache[id] = { id, filename: id, loaded: true, exports } }
stub('../db', db)
stub('../supabase', { getSupabase: () => null })
const { getBreakdown, evidenceFor, CATALOG } = require('./appearanceBreakdown')
const { ownedResult, normalize, publicContext } = require('./coachScanContext')
const original = { overallScore: 6.2, keyStrengths: ['A visible side part frames the face.'], visualObservations: [{ id: 'visible_dullness', category: 'skin', confidence: 'medium', limitations: ['Uneven light'] }] }
const finding = { title: 'Side part', observation: 'The saved scan identifies a side part.', significance: 'It gives the hairstyle a clear shape.', recommendation: 'Maintain the part.', confidence: 'medium', basedOn: ['strength:0'] }
function result() { return { strengths: [finding], improvementOpportunities: [], positiveObservations: [finding], recommendedActions: [{ title: 'Keep the shape', reason: 'The saved hairstyle is defined.', steps: ['Keep the current part.'], frequency: 'When styling', timeframe: '', basedOn: ['strength:0'] }], products: [], limitations: ['Uneven light limits assessment.'] } }
let serial = 0
function seed(user = 'alice', data = original) { const id = `scan-${++serial}`; db.prepare('INSERT INTO scans VALUES (?,?,?,?,?,?,?,?,?)').run(id,user,new Date().toISOString(),JSON.stringify({kind:'server_analysis_v1',status:'completed',result:data}),6.2,6.2,6.2,'{}',new Date().toISOString()); return id }
const response = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })

test('personalized analysis persists with the same scan, retains scores, and reaches coach context', async () => {
  const id = seed(); let prompt
  const analysis = await getBreakdown('alice', id, { client: { generate: async request => { prompt=request; return response(result()) } } })
  const saved = ownedResult(id, 'alice')
  assert.equal(saved.result.overallScore, original.overallScore)
  assert.deepEqual(saved.result.appearanceAnalysis, analysis)
  assert.equal(prompt.responseName, 'appearance_breakdown')
  assert.ok(!prompt.messages[0].content.includes('overallScore'))
  const context = publicContext({ status:'completed',latest:normalize(saved.row),previous:[],profile:null },true)
  assert.deepEqual(context.latest.appearanceAnalysis.strengths, analysis.strengths)
  assert.deepEqual(context.latest.appearanceAnalysis.recommendedActions, analysis.recommendedActions)
})
test('cached analysis is reused without another AI request', async () => {
  const id=seed(); await getBreakdown('alice',id,{client:{generate:async()=>response(result())}})
  await getBreakdown('alice',id,{client:{generate:async()=>{throw new Error('must not call')}}})
})
test('another owner cannot read, generate or overwrite a scan', async () => {
  const id=seed('bob')
  await assert.rejects(getBreakdown('alice',id,{client:{generate:async()=>{throw new Error('must not call')}}}),{status:404})
  assert.equal(ownedResult(id,'bob').result.appearanceAnalysis,undefined)
})
test('concurrent requests share one generation', async () => {
  const id=seed();let calls=0
  const client={generate:async()=>{calls++;await new Promise(resolve=>setImmediate(resolve));return response(result())}}
  const [a,b]=await Promise.all([getBreakdown('alice',id,{client}),getBreakdown('alice',id,{client})])
  assert.deepEqual(a,b);assert.equal(calls,1)
})
test('failed provider leaves the scan intact and permits retry', async () => {
  const id=seed()
  await assert.rejects(getBreakdown('alice',id,{client:{generate:async()=>{throw new Error('provider failure')}}}),/provider failure/)
  assert.equal(ownedResult(id,'alice').result.appearanceAnalysis,undefined)
  assert.equal((await getBreakdown('alice',id,{client:{generate:async()=>response(result())}})).scanId,id)
})
test('unsupported evidence and invented catalogue IDs are rejected', async () => {
  for(const mutate of [data=>data.strengths[0].basedOn=['invented'],data=>data.products=[{catalogId:'imaginary',reason:'test',basedOn:['strength:0']} ]]) {
    const id=seed(), data=structuredClone(result());mutate(data)
    await assert.rejects(getBreakdown('alice',id,{client:{generate:async()=>response(data)}}))
    assert.equal(ownedResult(id,'alice').result.appearanceAnalysis,undefined)
  }
})
test('empty and low-confidence-only scans do not produce invented feedback', async () => {
  const id=seed('alice',{visualObservations:[{id:'visible_dullness',confidence:'low'}]})
  assert.deepEqual(evidenceFor(ownedResult(id,'alice').result),[])
  await assert.rejects(getBreakdown('alice',id),{status:422})
})
test('catalogue product links keep the existing affiliate tag and have no invented prices', async () => {
  const id=seed(),data=result();data.products=[{catalogId:'daily_lotion',reason:'Optional hydration for the saved skin concern.',basedOn:['visible_dullness']}]
  const analysis=await getBreakdown('alice',id,{client:{generate:async()=>response(data)}})
  const product=analysis.products[0],url=new URL(product.amazonUrl)
  assert.equal(url.hostname,'www.amazon.ca');assert.equal(url.searchParams.get('tag'),'ascendusapp05-20')
  assert.equal(product.imageUrl,CATALOG.daily_lotion.imageUrl);assert.equal(product.price,undefined);assert.equal(product.rating,undefined)
  assert.equal(new URL(product.sourceUrl).hostname,'www.cerave.ca')
})
