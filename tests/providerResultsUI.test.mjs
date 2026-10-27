import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire, Module} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require('../client/node_modules/esbuild')
const compiled=await build({
 stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server';import Results from './src/pages/ScanUnlockGate.jsx';import Coach from './src/pages/AICoach.jsx';import MainCoach from './src/pages/Progress.jsx';import Breakdown from './src/components/AppearanceBreakdown.jsx';import CoachMessage from './src/components/CoachMessage.jsx';import {setFixture} from 'fixture-store';export function renderReply(content,reveal=false){return renderToStaticMarkup(<CoachMessage content={content} reveal={reveal}/>)};export function renderBreakdown(scan,page='pros'){setFixture({user:{id:"fixture-user"}});return renderToStaticMarkup(<StaticRouter><Breakdown scan={scan} initialPage={page}/></StaticRouter>)};export function render(scan,premium){setFixture({currentScan:scan,scans:[scan],isPremium:premium,developerPreviewUnlocked:false});return renderToStaticMarkup(<StaticRouter location="/unlock"><Results/></StaticRouter>)};export function renderCoach(premium,hasScan,main=false){setFixture({user:{id:"isolated-coach-user"},userProfile:{},scans:hasScan?[{id:"scan",glowScore:6.2}]:[],isPremium:premium});return renderToStaticMarkup(<StaticRouter location="/coach">{main?<MainCoach/>:<Coach/>}</StaticRouter>)}`,
 resolveDir:fileURLToPath(new URL('../client',import.meta.url)),loader:'jsx'},
 bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',logLevel:'silent',
 loader:{'.png':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.svg':'dataurl','.css':'empty'},
 define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'false'},
 plugins:[{name:'isolated-test-state',setup(b){
 b.onResolve({filter:/fixture-store|\.\.\/store\/useStore$/},()=>({path:'fixture-store',namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'let state={};export const setFixture=s=>{state=s};const store=selector=>typeof selector==="function"?selector(state):state;store.getState=()=>state;store.setState=()=>{};export default store',loader:'js'}))
 }}]
})
const module=new Module('provider-results-fixture',import.meta)
module._compile(compiled.outputFiles[0].text,'provider-results-fixture.cjs')
const {render,renderCoach,renderBreakdown,renderReply}=module.exports
const scan={id:'isolated-provider-fixture',facePhotoUrl:'sample-portrait.jpg',aiScore:{overallScore:6.2,potentialScore:7.6,faceMetrics:{symmetry:{score:6.1},skinQuality:{score:6.3},jawline:{score:6.5},cheekbones:{score:6.4}}}}
test('unchanged original results component displays the migrated response fields and portrait',()=>{
 const html=render(scan,true)
 for(const expected of ['Your Results','sample-portrait.jpg','6.2','7.6','6.1','6.3','6.5','6.4','Overall','Potential','Symmetry','Skin Quality','Jawline','Cheekbones'])assert.ok(html.includes(expected),expected)
 assert.equal(html.includes('Your appearance feedback'),false)
})
test('existing subscription gate still locks the same score fields',()=>{
 const html=render(scan,false)
 assert.ok(html.includes('Reveal your ratings'))
 assert.ok(html.includes('Get Ascendus Max'))
 assert.ok(html.includes('Overall: Locked'))
})

test('coach renders existing branding and input without runtime errors for premium/free/no-scan states',()=>{
 for(const [premium,hasScan] of [[true,true],[false,true],[true,false]]){
  const html=renderCoach(premium,hasScan)
  assert.ok(html.includes('Adonis'))
  assert.ok(html.includes('adonis-coach-gold.png'))
  assert.ok(html.includes(hasScan?'Message Adonis':'Scan Your Face To Unlock'))
 }
})

test('main AI Coach route preserves its Adonis branding and composer',()=>{
 const html=renderCoach(true,true,true)
 assert.ok(html.includes('Adonis'))
 assert.ok(html.includes('Send message'))
 assert.ok(html.includes('Ask anything'))
})

test('appearance results use compact inline details and omit Coach access',()=>{
 const finding={title:'Saved side part',observation:'The scan identifies a defined side part.',significance:'It frames the face.',recommendation:'Maintain the part.',confidence:'medium'}
 const analysis={version:10,scanId:'fixture-scan',strengths:[finding],improvementOpportunities:[{...finding,title:'Soft jawline',observation:'The jaw edge is less defined in this photo.'}],positiveObservations:[],recommendedActions:[{title:'Keep the part',reason:'It works with the saved hairstyle.',steps:['Style the same part.'],frequency:'When styling',timeframe:''}],products:[{id:'daily_lotion',name:'CeraVe Daily Moisturizing Lotion',benefit:'Hydration',reason:'For the saved concern.',imageUrl:'https://www.cerave.com/verified-image.jpg',sourceUrl:'https://www.cerave.ca/en-ca/skincare/moisturizers/daily-moisturizing-lotion',amazonUrl:'https://www.amazon.ca/s?k=CeraVe&tag=ascendusapp05-20'}],limitations:['Photo lighting limits assessment.']}
 const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',facePhotoUrl:'fixture-photo.jpg',aiScore:{appearanceAnalysis:analysis}})
 for(const text of ['Pros','Cons','Saved side part','appearance-details-toggle','aria-expanded="false"','appearance-detail-panel','The scan identifies a defined side part.','Maintain the part.'])assert.ok(html.includes(text),text)
 assert.ok(!html.includes('Ask AI Coach'))
})
test('appearance results show every supported saved point and its next step',()=>{
 const strengths=Array.from({length:6},(_,index)=>({title:`Supported strength ${index+1}`,observation:`Visible strength evidence ${index+1}.`,recommendation:`Practical strength step ${index+1}.`}))
 const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',aiScore:{appearanceAnalysis:{version:10,scanId:'fixture-scan',strengths,improvementOpportunities:[{title:'Supported improvement',observation:'Distinct improvement evidence.'}],positiveObservations:[]}}})
 for(const point of strengths){
  assert.ok(html.includes(point.title),point.title)
  assert.ok(html.includes(point.recommendation),point.recommendation)
 }
})
test('appearance results render all six supported Cons without truncating the saved array',()=>{
 const improvements=Array.from({length:6},(_,index)=>({title:`Supported improvement ${index+1}`,observation:`Visible improvement evidence ${index+1}.`,recommendation:`Practical improvement step ${index+1}.`}))
 const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',aiScore:{appearanceAnalysis:{version:10,scanId:'fixture-scan',strengths:[{title:'One strength',observation:'Visible strength.'}],improvementOpportunities:improvements,positiveObservations:[]}}},'cons')
 for(const point of improvements){assert.ok(html.includes(point.title),point.title);assert.ok(html.includes(point.recommendation),point.recommendation)}
})
test('appearance findings stay complete at 2, 5, and 8 points',()=>{
 for(const count of [2,5,8]){
  const strengths=Array.from({length:count},(_,index)=>({title:`Mobile finding ${count}-${index+1}`,observation:`Evidence for finding ${index+1}.`,recommendation:`Next step ${index+1}.`}))
  const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',aiScore:{appearanceAnalysis:{version:10,scanId:'fixture-scan',strengths,improvementOpportunities:[],positiveObservations:[]}}})
  assert.equal((html.match(/class="appearance-details-toggle"/g)||[]).length,count)
  for(const finding of strengths)assert.ok(html.includes(finding.title),finding.title)
 }
})
test('overlapping broad balance and symmetry findings are shown once',()=>{
 const strengths=[
  {title:'Overall facial balance',observation:'The overall facial structure appears balanced.'},
  {title:'Symmetry is fairly balanced',observation:'The face shows generally balanced left and right sides.'},
  {title:'Balanced eye positioning',observation:'The eyes are evenly positioned.'},
 ]
 const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',aiScore:{appearanceAnalysis:{version:10,scanId:'fixture-scan',strengths,improvementOpportunities:[],positiveObservations:[]}}})
 assert.equal((html.match(/class="appearance-point-title"/g)||[]).length,2)
 assert.ok(html.includes('Balanced eye positioning'))
})
test('older saved two-point analysis remains visible while a refresh is unavailable',()=>{
 const scan={id:'old-scan',serverScanId:'fixture-scan',aiScore:{appearanceAnalysis:{version:10,scanId:'fixture-scan',strengths:[{title:'Old pro one',observation:'Old observation.'},{title:'Old pro two',observation:'Old observation.'}],improvementOpportunities:[{title:'Old con one',observation:'Old observation.'},{title:'Old con two',observation:'Old observation.'}],positiveObservations:[]}}}
 for(const oldPoint of ['Old pro one','Old pro two'])assert.ok(renderBreakdown(scan,'pros').includes(oldPoint),oldPoint)
 for(const oldPoint of ['Old con one','Old con two'])assert.ok(renderBreakdown(scan,'cons').includes(oldPoint),oldPoint)
})
test('legacy scan score bullets remain visible when no structured appearance analysis was saved',()=>{
 const scan={id:'old-scan',serverScanId:'fixture-scan',aiScore:{keyStrengths:['Balanced facial symmetry','Proportionate features'],keyWeaknesses:['Soft jawline definition','Uneven skin texture']}}
 for(const point of ['Balanced facial symmetry','Proportionate features'])assert.ok(renderBreakdown(scan,'pros').includes(point),point)
 for(const point of ['Soft jawline definition','Uneven skin texture'])assert.ok(renderBreakdown(scan,'cons').includes(point),point)
})
test('a scan without saved structured feedback displays no invented findings or products',()=>{
 const html=renderBreakdown({id:'legacy-scan',facePhotoUrl:'legacy.jpg',aiScore:{}})
 assert.ok(html.includes('Pros'))
 assert.ok(!html.includes('Your Strongest Features'))
 assert.ok(!html.includes('View Product'))
})

test('saved coach products display compact linked cards instead of raw tracking URLs',()=>{
 const url='https://www.amazon.ca/s?k=CeraVe&tag=ascendusapp05-20'
 const html=renderReply(`1) Keep your routine simple.\n\nCeraVe Cleanser — Gentle cleansing.\n${url}\n\nAffiliate links: Ascendus may earn a commission.`)
 assert.ok(html.includes('coach-product'))
 assert.ok(html.includes('View on Amazon'))
 assert.ok(html.includes('sponsored'))
 const text=html.replace(/<[^>]*>/g,'')
 assert.ok(!text.includes('https://'))
 assert.ok(text.includes('CeraVe Cleanser'))
 assert.ok(text.includes('Ascendus may earn a commission.'))
})
test('new coach replies begin with a typing state while saved replies render completely',()=>{
 const text='A complete saved recommendation.'
 assert.ok(!renderReply(text,true).includes(text))
 assert.ok(renderReply(text,true).includes('Adonis is typing'))
 assert.ok(renderReply(text,false).includes(text))
})
