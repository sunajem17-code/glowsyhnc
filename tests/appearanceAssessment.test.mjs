import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { ASSESSMENT_VERSION, assessmentRange, assessmentScan, assessmentTier, assessmentScale, isCurrentAssessment } from '../client/src/utils/assessment.js'
import { requestProductionAnalysis } from '../client/src/utils/productionAnalysis.js'
const require = createRequire(import.meta.url)
const A = require('../server/src/lib/appearanceAssessment')
const legacy = require('../server/src/lib/tier')
function quality(status = 'assessable') {
 return { status, profileUsable: false, checks: Object.fromEntries(A.CHECKS.map(k => [k, { status: status === 'assessable' ? 'clear' : 'limited', observation: 'Photographic evidence noted.' }])),
   limitations: status === 'assessable' ? [] : ['Harsh side lighting obscures detail.'], guidance: status === 'assessable' ? [] : ['Retake in even daylight at eye level without a filter.'] }
}
function raw(overrides = {}) {
 return { confidence: 'moderate', scoreExplanation: 'Visible harmony supports the attractive anchor, with uncertainty extending to the model-tier boundary.', scoreRange: { min: 5.2, max: 6.1 },
   dimensions: Object.fromEntries(A.DIMENSIONS.map(k => [k, { status: 'broadly_average', observation: 'Visible proportions are balanced in this front view.' }])),
   strengths: [], limitations: [], suggestions: ['Consider a low-maintenance haircut.'], unassessableDetails: ['Bite alignment cannot be assessed.'], ...overrides }
}
const context = { imageSuitability: quality(), assessmentProfile: 'male', knownMinor: false }
for (const [value, id] of [[0,'psl_under_2'],[2,'psl_2'],[3,'psl_3'],[3.5,'psl_4'],[4,'psl_4'],[4.5,'psl_4_5'],[5,'psl_5'],[5.5,'psl_5_5'],[6,'psl_6'],[6.5,'psl_6_5'],[7,'psl_7'],[7.5,'psl_7_5'],[8,'psl_7_5']]) {
 for (const profile of ['male','female',null]) test(`PSL boundary ${value} / ${profile}`, () => {
   const server=A.tier(value,profile), client=assessmentTier(value,profile)
   assert.equal(server.id,id);assert.deepEqual(client,server);assert.equal(server.umbrella,null)
 })
}
test('PSL anchors replace the old ten-point labels without forcing profiles',()=>{
 assert.equal(A.tier(4).label,'Average');assert.equal(A.tier(4.5).label,'Above average')
 assert.equal(A.tier(5).label,'Attractive');assert.equal(A.tier(5.5).label,'Very attractive')
 assert.equal(A.tier(6).label,'Model tier');assert.equal(A.tier(6.5).label,'Exceptional model tier')
 assert.equal(A.tier(7).label,'Elite model tier');assert.match(A.tier(7.5,'male').label,/True Adam/)
 assert.match(A.tier(7.5,'female').label,/True Eve/);assert.equal(A.tier(6,'male').label,A.tier(6,'female').label)
 assert.equal(A.tier(5.999).id,'psl_5_5');assert.equal(A.tier(4.499).id,'psl_4')
 assert.equal(assessmentScale().max,8)
})
test('all invalid, missing, nonfinite, coercible and reversed values reject', () => {
 for(const value of [undefined,null,'6','',NaN,Infinity,-Infinity,-1,8.001,9,10,10.001,{},true]) {
   assert.throws(()=>A.tier(value));assert.throws(()=>assessmentTier(value))
   assert.throws(()=>A.range({min:value,max:8}));assert.throws(()=>A.range({min:2,max:value}))
 }
 for(const value of [undefined,{}, {min:8,max:7}]) {assert.throws(()=>A.range(value));assert.throws(()=>assessmentRange(value,'male'))}
 assert.equal(A.tiers(null),null)
})
test('crossing ranges expose both endpoint tiers with stable IDs', () => {
 const r = A.tiers({min:4.9,max:7.2},'female')
 assert.equal(r.min.id,'psl_4_5');assert.equal(r.max.id,'psl_7')
 assert.equal(r.min.umbrella,null);assert.equal(r.max.label,'Elite model tier')
 assert.deepEqual(r,assessmentRange({min:4.9,max:7.2},'female'))
})
test('model tier/profile/rubric fields cannot override derived values', () => {
 const result=A.validate(raw({tier:'True Adam',tiers:{min:{label:'fake'}},assessmentProfile:'female',rubricVersion:'fake'}),context)
 assert.equal(result.rubricVersion,ASSESSMENT_VERSION);assert.equal(result.assessmentProfile,'male')
 assert.equal(result.tiers.min.id,'psl_5');assert.equal(result.tiers.max.id,'psl_6')
})
test('profile selection cannot change the validated score', () => {
 for(const assessmentProfile of ['male','female',null]) assert.deepEqual(A.validate(raw(),{...context,assessmentProfile}).scoreRange,{min:5.2,max:6.1})
})
test('low confidence withholds rather than reducing attractiveness; limited results retain range', () => {
 const low=A.validate(raw({confidence:'low'}),context);assert.equal(low.scoreRange,null);assert.equal(low.tiers,null)
 const limited=A.validate(raw(),{...context,imageSuitability:quality('limited')});assert.deepEqual(limited.scoreRange,raw().scoreRange)
})
test('known minors receive only neutral presentation suggestions, never ranks', () => {
 const result=A.validate(raw({scoreRange:{min:7.5,max:8},strengths:['Higher assessment']}),{...context,knownMinor:true})
 assert.equal(result.scoreRange,null);assert.equal(result.tiers,null);assert.equal(result.withheldReason,'minor')
 assert.deepEqual(result.strengths,[]);assert.deepEqual(result.limitations,[])
 assert.ok(Object.values(result.dimensions).every(d=>d.status==='unassessable'))
})
test('malformed, incomplete and contradictory outputs fail explicitly', () => {
 for(const value of [null,[],{},raw({dimensions:{}}),raw({confidence:'medium'}),raw({strengths:['a','b','c','d']}),raw({scoreRange:{min:6,max:6}}),raw({scoreRange:{min:NaN,max:7}})]) assert.throws(()=>A.validate(value,context),A.AssessmentError)
 for(const value of ['not json','{"confidence":','{} trailing']) assert.throws(()=>A.parse(value),A.AssessmentError)
 assert.deepEqual(A.parse('```json\n{"ok":true}\n```'),{ok:true})
 assert.throws(()=>A.suitability({status:'insufficient',checks:{}}))
 assert.throws(()=>A.suitability({...quality(),checks:{}}))
 assert.throws(()=>A.suitability({...quality(),status:'limited'}))
})
test('insufficient images never reach scoring or advice', async () => {
 let calls=0
 const result=await A.runAssessment({faceImage:'front',assessmentProfile:'male',callModel:async()=>{calls++;return JSON.stringify(quality('insufficient'))}})
 assert.equal(calls,1);assert.equal(result.scoreRange,null);assert.equal(result.tiers,null)
 assert.equal(result.withheldReason,'insufficient_image');assert.ok(result.imageSuitability.guidance.length)
})
test('analysis failure and malformed model response do not turn into average scores',async()=>{
 await assert.rejects(A.runAssessment({faceImage:'front',callModel:async()=>{throw new Error('model unavailable')}}),/model unavailable/)
 await assert.rejects(A.runAssessment({faceImage:'front',callModel:async()=>'{broken'}),A.AssessmentError)
 let calls=0
 await assert.rejects(A.runAssessment({faceImage:'front',callModel:async()=>JSON.stringify(++calls===1?quality():{})}),A.AssessmentError)
})
test('unusable or absent side photograph is excluded from scoring input',async()=>{
 const seen=[]
 await A.runAssessment({faceImage:'front',sideImage:'bad-side',callModel:async(_p,input)=>{seen.push(input);return JSON.stringify(seen.length===1?quality():raw())}})
 assert.equal(seen[1].sideImage,null)
 let calls=0
 const result=await A.runAssessment({faceImage:'front',callModel:async()=>JSON.stringify(++calls===1?{...quality(),profileUsable:true}:raw())})
 assert.equal(result.imageSuitability.profileUsable,false)
})
test('profile and styling goals reach advice only, scoring input is invariant (mocked)', async () => {
 const calls=[]
 for(const assessmentProfile of ['male','female']) {
   let index=0
   const selected=[]
   const result=await A.runAssessment({faceImage:'same-photo',assessmentProfile,presentationGoals:'androgynous styling',callModel:async(prompt,input)=>{
     selected.push({prompt,input});index++;return JSON.stringify(index===1?quality():index===2?raw():{suggestions:['Choose a haircut suited to your preferred style.']})
   }})
   calls.push(selected);assert.equal(result.scoreRange.min,5.2);assert.equal(selected[2].input.presentationContext.assessmentProfile,assessmentProfile)
 }
 assert.deepEqual(calls[0].slice(0,2),calls[1].slice(0,2))
 assert.match(calls[0][1].prompt,/brutal honesty/);assert.match(calls[0][1].prompt,/untrusted input/)
 assert.match(calls[0][1].prompt,/Four is the average reference/)
 assert.match(calls[0][1].prompt,/Model tier starts at 6/)
 assert.match(calls[0][1].prompt,/not a required population quota/)
})
test('advice failure cannot change or fabricate score',async()=>{
 let count=0
 const result=await A.runAssessment({faceImage:'front',assessmentProfile:'female',callModel:async()=>{
   count++;if(count===3)throw new Error('advice offline');return JSON.stringify(count===1?quality():raw())
 }})
 assert.deepEqual(result.scoreRange,raw().scoreRange);assert.deepEqual(result.suggestions,[])
 assert.match(result.unassessableDetails.at(-1),/unavailable/)
})
test('structured records keep null point scores and historical rubrics untouched',()=>{
 const a=A.validate(raw(),context)
 const record=assessmentScan({assessment:a},{id:'new',scanDate:'2026-10-19T12:00:00Z'})
 assert.equal(record.glowScore,null);assert.equal(record.umaxScore,null);assert.equal(record.tier,null)
 assert.equal(isCurrentAssessment(record),true)
 const old={id:'old',tier:'Adam Lite',glowScore:9.2,aiScore:{tier:'Adam Lite'}}
 assert.equal(isCurrentAssessment(old),false);assert.deepEqual(old,{id:'old',tier:'Adam Lite',glowScore:9.2,aiScore:{tier:'Adam Lite'}})
 assert.equal(legacy.getTier(9.2,'male'),'Adam Lite');assert.equal(legacy.getTier(7.2,'female'),'Stacy')
 assert.throws(()=>assessmentScan({overallScore:7},{id:'bad'}))
 const withheld=assessmentScan({assessment:A.withheld(quality('insufficient'),null,'insufficient_image')},{id:'none'})
 assert.equal(withheld.aiScore.assessment.scoreRange,null);assert.equal(withheld.glowScore,null)
})
test('capture requests explicit profile/minor flag, ignores previous score, rejects old server',async()=>{
 let payload
 const a=A.validate(raw(),context)
 const base={faceImage:'photo',evidence:{status:'measured'},knownMinor:true,gender:null,previousScore:9}
 await requestProductionAnalysis({...base,apiClient:{ai:{score:async p=>{payload=p;return {assessment:a}}}}})
 assert.equal(payload.assessmentProfile,null);assert.equal(payload.knownMinor,true);assert.equal('previousScore' in payload,false)
 await assert.rejects(requestProductionAnalysis({...base,apiClient:{ai:{score:async()=>({overallScore:8})}}}),/older rubric/)
 await assert.rejects(requestProductionAnalysis({...base,evidence:{status:'additional_image_required'},apiClient:{ai:{score:()=>assert.fail()}}}),/could not be measured/)
})
test('new route does not use anchoring, historical cache, score defaults or leaderboard writes',()=>{
 const source=readFileSync(new URL('../server/src/routes/aiScore.js',import.meta.url),'utf8')
 const route=source.slice(source.indexOf("router.post('/score',"),source.indexOf('// ── POST /api/ai/score/physique'))
 for(const old of ['previousScore','getScanCache','calculateFinalScore','updateLeaderboard','Math.max','fallback = 5']) assert.equal(route.includes(old),false,old)
 assert.match(route,/assessment.runAssessment/)
})

function feedback() {
 return {observations:Object.fromEntries(A.PRESENTATION_KEYS.map(key=>[key,{status:key==='hairstyle'?'observed':'unassessable',observation:key==='hairstyle'?'Hair covers the forehead.':'Not visible in this crop.'}])),recommendations:[{dimension:'hairstyle',observation:'Hair covers the forehead.',action:'Try sweeping the fringe to one side.',rationale:'This changes how the hair frames your face.',priority:'medium',effort:'low',cost:'free',basis:'visible_evidence',limitations:'Personal style preferences may differ.'}]}
}
test('presentation validates grounded actions and rejects unsupported evidence and metadata',()=>{
 const valid=feedback();assert.deepEqual(A.presentationFeedback(valid),valid)
 for(const mutate of [f=>f.recommendations[0].dimension='posture',f=>f.recommendations[0].cost='guaranteed',f=>f.recommendations[0].basis='guess',f=>f.recommendations[0].rationale='',f=>f.observations={},f=>f.recommendations=Array(4).fill(f.recommendations[0])]){
  const invalid=feedback();mutate(invalid);assert.throws(()=>A.presentationFeedback(invalid),A.AssessmentError)
 }
})
test('presentation cannot override facial score; profiles and goals only reach final call (mocked)',async()=>{
 const calls=[]
 for(const assessmentProfile of ['male','female','unspecified']){
  const seen=[]
  const result=await A.runAssessment({faceImage:'same-face',assessmentProfile,presentationGoals:'simple styling',callModel:async(prompt,input)=>{
   seen.push({prompt,input});return JSON.stringify(seen.length===1?quality():seen.length===2?raw():{...feedback(),scoreRange:{min:9,max:10},tier:'True Adam'})
  }})
  calls.push(seen);assert.deepEqual(result.scoreRange,raw().scoreRange)
  assert.equal(result.feedbackVersion,'presentation-v2');assert.equal(result.presentation.observations.posture.status,'unassessable')
  assert.deepEqual(result.suggestions,['Try sweeping the fringe to one side.'])
  assert.equal(seen[2].input.faceImage,'same-face');assert.equal(seen[2].input.presentationContext.assessmentProfile,assessmentProfile)
  for(const rule of ['No SMV score','bonesmashing','untrusted data','Clothing and posture are unassessable']) assert.ok(seen[2].prompt.includes(rule),rule)
 }
 assert.deepEqual(calls[0].slice(0,2),calls[1].slice(0,2));assert.deepEqual(calls[1].slice(0,2),calls[2].slice(0,2))
})
test('invalid presentation withholds advice without losing validated facial assessment',async()=>{
 let n=0;const invalid=feedback();invalid.recommendations[0].dimension='posture'
 const result=await A.runAssessment({faceImage:'face',callModel:async()=>JSON.stringify(++n===1?quality():n===2?raw():invalid)})
 assert.deepEqual(result.scoreRange,raw().scoreRange);assert.equal(result.presentation.unavailable,true)
 assert.deepEqual(result.suggestions,[]);assert.deepEqual(result.presentation.recommendations,[])
})

test('previous structured results retain their original scale and labels',()=>{
 const oldVersion='appearance-feedback-v1'
 const saved={aiScore:{assessment:{rubricVersion:oldVersion,scoreRange:{min:9.1,max:9.5},assessmentProfile:'male'}}}
 const snapshot=JSON.stringify(saved)
 assert.equal(isCurrentAssessment(saved),true);assert.equal(assessmentScale(oldVersion).max,10)
 assert.match(assessmentRange(saved.aiScore.assessment.scoreRange,'male',oldVersion).min.label,/True Adam/)
 assert.equal(assessmentTier(6,'male',oldVersion).id,'tier_4')
 assert.equal(assessmentTier(6,'male').id,'psl_6');assert.equal(JSON.stringify(saved),snapshot)
 assert.throws(()=>assessmentScale('unknown'));assert.throws(()=>assessmentScan({assessment:saved.aiScore.assessment},{id:'relabel'}))
})
test('new scored assessments require anchor explanations and reject false precision',()=>{
 for(const scoreExplanation of [undefined,null,'',42])assert.throws(()=>A.validate(raw({scoreExplanation}),context),A.AssessmentError)
 assert.throws(()=>A.validate(raw({scoreRange:{min:5.01,max:5.5}}),context),A.AssessmentError)
 assert.equal(A.validate(raw({confidence:'low',scoreExplanation:null}),context).scoreExplanation,null)
 assert.equal(A.withheld(quality('insufficient'),null,'insufficient_image').scoreExplanation,null)
})
test('PSL scoring prompt supplies all anchors and separates facial appearance from appeal (mocked)',async()=>{
 const seen=[]
 await A.runAssessment({faceImage:'front',callModel:async(prompt)=>{seen.push(prompt);return JSON.stringify(seen.length===1?quality():seen.length===2?raw():feedback())}})
 for(const rule of ['0–8 scale','4.5 is above average','5 attractive','5.5 very attractive','6 the start of model tier','6.5 exceptional model tier','7 elite model tier','7.5+','not dating appeal','Do not use celebrity identity','not an empirically validated distribution','not a required population quota','Do not demand literal flawlessness','scoreExplanation'])assert.ok(seen[1].includes(rule),rule)
 for(const forbidden of ['9–10 band','0–10 scale. Do not','PSL 5 is equivalent to 84.15%'])assert.equal(seen[1].includes(forbidden),false)
})

test('Railway server-only build can resolve its canonical rating rubric',()=>{
 const source=readFileSync(new URL('../server/src/lib/appearanceAssessment.js',import.meta.url),'utf8')
 assert.equal(source.includes("require('../../../client/"),false)
 const packagedRubric=require('../server/src/lib/assessmentRubric.json')
 assert.equal(packagedRubric.version,A.VERSION);assert.equal(packagedRubric.scale.max,8)
})
