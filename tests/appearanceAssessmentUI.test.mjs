import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require('../client/node_modules/esbuild')
const A = require('../server/src/lib/appearanceAssessment')
// Render the real component with an isolated store and static router. No real account or API is used.
const compiled = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {StaticRouter} from 'react-router-dom/server'; import Results from './src/components/AppearanceAssessmentResults.jsx'; import Comparison from './src/components/AppearanceComparison.jsx'; import {setFixture} from 'fixture-store'; export function compare(scans){setFixture({setCurrentScan:()=>{}});return renderToStaticMarkup(<StaticRouter location="/compare"><Comparison scans={scans}/></StaticRouter>)} export function render(assessment,premium){setFixture({isPremium:premium});return renderToStaticMarkup(<StaticRouter location="/results"><Results scan={{id:'fixture',aiScore:{assessment}}}/></StaticRouter>)}`,
    resolveDir: fileURLToPath(new URL('../client',import.meta.url)), loader:'jsx' },
  bundle:true, write:false, platform:'node',format:'cjs',jsx:'automatic', logLevel:'silent',
  plugins:[{name:'isolated-test-store',setup(b){
    b.onResolve({filter:/fixture-store|\.\.\/store\/useStore$/},()=>({path:'fixture-store',namespace:'fixture'}))
    b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'let state={};export const setFixture=s=>{state=s};export default selector=>selector(state)',loader:'js'}))
  }}]
})
const module = new Module('assessment-ui-fixture',import.meta)
module._compile(compiled.outputFiles[0].text,'assessment-ui-fixture.cjs')
const {render,compare}=module.exports
const quality={status:'limited',profileUsable:false,checks:Object.fromEntries(A.CHECKS.map(k=>[k,{status:'limited',observation:'Light obscures some visible detail.'}])),limitations:['Uneven lighting.'],guidance:['Retake in daylight.']}
const raw={confidence:'moderate',scoreExplanation:'The visible feature relationships support this anchor range.',scoreRange:{min:4.9,max:5.3},dimensions:Object.fromEntries(A.DIMENSIONS.map(k=>[k,{status:'broadly_average',observation:'Visible observations support this assessment.'}])),strengths:[],limitations:[],suggestions:['Choose an optional haircut that suits your style.'],unassessableDetails:['No usable side profile.']}
test('premium UI displays original endpoints, both tier labels, confidence and limitations',()=>{
 const a=A.validate(raw,{imageSuitability:quality,assessmentProfile:'female'})
 const html=render(a,true)
 for(const expected of ['4.9–5.3','Above average','Attractive','PSL range','out of 8','Why this range','moderate','Uneven lighting.','Facial harmony','No usable side profile.','not scientific measurements']) assert.ok(html.includes(expected),expected)
 for(const forbidden of ['Top 1%','potential score','Guaranteed','6.4'])assert.equal(html.includes(forbidden),false)
})
test('withheld UI shows guidance with no numeric ranking or tier label',()=>{
 const html=render(A.withheld({...quality,status:'insufficient'},'male','insufficient_image'),false)
 assert.ok(html.includes('Score withheld'));assert.ok(html.includes('Retake in daylight.'))
 assert.equal(html.includes('out of 10'),false);assert.equal(html.includes('Chad'),false)
})
test('known-minor UI is neutral and has no paywall for withheld feedback',()=>{
 const a=A.validate(raw,{imageSuitability:quality,assessmentProfile:'male',knownMinor:true})
 const html=render(a,false)
 assert.ok(html.includes('For people under 18'));assert.ok(html.includes('grooming'))
 assert.equal(html.includes('4.9'),false);assert.equal(html.includes('Low-Tier'),false)
 assert.equal(html.includes('View subscription options'),false)
})
test('free UI keeps assessment details behind the existing upgrade path',()=>{
 const html=render(A.validate(raw,{imageSuitability:quality,assessmentProfile:null}),false)
 assert.ok(html.includes('View subscription options'));assert.equal(html.includes('4.9–5.3'),false)
 assert.equal(html.includes('Visible observations support'),false)
})

test('comparison keeps original rubrics, exact ranges and withheld states without invented scores',()=>{
 const a=A.validate(raw,{imageSuitability:quality,assessmentProfile:'male'})
 const recent={id:'recent',analyzedAt:'2026-10-19T12:00:00Z',aiScore:{assessment:a},glowScore:null}
 const historical={id:'old',analyzedAt:'2026-09-19T12:00:00Z',tier:'Adam Lite',glowScore:9.2}
 const mixed=compare([recent,historical])
 assert.ok(mixed.includes('not directly comparable'));assert.ok(mixed.includes('Adam Lite'));assert.ok(mixed.includes('4.9–5.3 / 8 PSL'))
 const withheld={...recent,id:'withheld',aiScore:{assessment:A.withheld({...quality,status:'insufficient'},null,'insufficient_image')}}
 const html=compare([withheld,recent]);assert.ok(html.includes('Score withheld'));assert.equal(html.includes('5 / 10'),false)
})

test('presentation UI separates recommendations from facial observations and labels missing context',()=>{
 const a=A.validate(raw,{imageSuitability:quality,assessmentProfile:'female'})
 a.presentation={observations:{posture:{status:'unassessable',observation:'The photograph does not show enough of your body.'}},recommendations:[{action:'Try a side-swept fringe.',observation:'Hair covers the forehead.',rationale:'Frames the face differently.',priority:'medium',effort:'low',cost:'free',basis:'visible_evidence',limitations:'Style preference varies.'}]}
 const html=render(a,true)
 for(const label of ['Facial assessment','Presentation feedback','Unassessable','Practical next steps','Priority: medium','Cost: free','visible evidence','4.9–5.3'])assert.ok(html.includes(label),label)
 const free=render(a,false);assert.equal(free.includes('Try a side-swept fringe.'),false)
})

test('saved ten-point results remain readable without relabeling or comparison across scales',()=>{
 const current=A.validate(raw,{imageSuitability:quality,assessmentProfile:'male'})
 const old={...current,rubricVersion:'appearance-feedback-v1',scoreRange:{min:9.1,max:9.5}}
 const html=render(old,true)
 assert.ok(html.includes('out of 10'));assert.ok(html.includes('True Adam / Slayer / PSL god'))
 assert.equal(html.includes('PSL scale: 4 average'),false)
 const mixed=compare([{id:'old',aiScore:{assessment:old}},{id:'new',aiScore:{assessment:current}}])
 assert.ok(mixed.includes('not directly comparable'));assert.ok(mixed.includes('9.1–9.5 / 10 Appearance'))
 assert.ok(mixed.includes('4.9–5.3 / 8 PSL'))
})
