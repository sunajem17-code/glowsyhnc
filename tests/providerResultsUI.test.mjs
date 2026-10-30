import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire, Module} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require('../client/node_modules/esbuild')
const compiled=await build({
 stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server';import Results from './src/pages/ScanUnlockGate.jsx';import Coach from './src/pages/AICoach.jsx';import MainCoach from './src/pages/Progress.jsx';import Breakdown, {AppearanceFeedback} from './src/components/AppearanceBreakdown.jsx';import CoachMessage from './src/components/CoachMessage.jsx';import Gate from './src/components/CoachAccessGate.jsx';import {setFixture} from 'fixture-store';export function renderFeedback(analysis,page='plan'){return renderToStaticMarkup(<AppearanceFeedback analysis={analysis} page={page} onRetake={()=>{}}/>)};export function renderGate(context){return renderToStaticMarkup(<StaticRouter><Gate context={context}/></StaticRouter>)};export function renderReply(content,reveal=false){return renderToStaticMarkup(<CoachMessage content={content} reveal={reveal}/>)};export function renderBreakdown(scan){setFixture({user:{id:"fixture-user"}});return renderToStaticMarkup(<StaticRouter><Breakdown scan={scan}/></StaticRouter>)};export function render(scan,premium){setFixture({currentScan:scan,scans:[scan],isPremium:premium,developerPreviewUnlocked:false});return renderToStaticMarkup(<StaticRouter location="/unlock"><Results/></StaticRouter>)};export function renderCoach(premium,hasScan,main=false){setFixture({user:{id:"isolated-coach-user"},userProfile:{},scans:hasScan?[{id:"scan",glowScore:6.2}]:[],isPremium:premium});return renderToStaticMarkup(<StaticRouter location="/coach">{main?<MainCoach/>:<Coach/>}</StaticRouter>)}`,
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
const {render,renderCoach,renderBreakdown,renderReply,renderGate,renderFeedback}=module.exports
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

test('both coach routes wait for authoritative access instead of briefly exposing chat',()=>{
 for(const main of [false,true]) for(const [premium,hasScan] of [[true,true],[false,true],[true,false]]){
  const html=renderCoach(premium,hasScan,main)
  assert.ok(html.includes('Checking coach access'))
  assert.ok(!html.includes('Send message'))
 }
})

test('page two renders real persisted findings without the coach upsell button or loading filler',()=>{
 const finding={title:'Saved side part',observation:'The scan identifies a defined side part.',significance:'It frames the face.',recommendation:'Maintain the part.',confidence:'medium'}
 const analysis={version:1,scanId:'fixture-scan',strengths:[finding],improvementOpportunities:[],positiveObservations:[finding],recommendedActions:[{title:'Keep the part',reason:'It works with the saved hairstyle.',steps:['Style the same part.'],frequency:'When styling',timeframe:''}],products:[{id:'daily_lotion',name:'CeraVe Daily Moisturizing Lotion',benefit:'Hydration',reason:'For the saved concern.',imageUrl:'https://www.cerave.com/verified-image.jpg',sourceUrl:'https://www.cerave.ca/en-ca/skincare/moisturizers/daily-moisturizing-lotion',amazonUrl:'https://www.amazon.ca/s?k=CeraVe&tag=ascendusapp05-20'}],limitations:['Photo lighting limits assessment.']}
 const html=renderBreakdown({id:'local-scan',serverScanId:'fixture-scan',facePhotoUrl:'fixture-photo.jpg',aiScore:{appearanceAnalysis:analysis}})
 for(const text of ['Strengths','Your plan','Previous scan notes','The scan identifies a defined side part.']) assert.ok(html.includes(text),text)
 assert.ok(!html.includes('Ask AI Coach'))
 assert.ok(!html.includes('Finding your points'))
 assert.ok(!html.includes('View Product'))

})
test('a scan without saved structured feedback displays no invented findings or products',()=>{
 const html=renderBreakdown({id:'legacy-scan',facePhotoUrl:'legacy.jpg',aiScore:{}})
 assert.ok(html.includes('Appearance feedback'))
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

test('coach access has actionable scan, Pro, and failed-request states',()=>{
 assert.ok(renderGate({hasCompletedScan:false,isPro:false,status:'no_scan'}).includes('Scan required'))
 assert.ok(renderGate({hasCompletedScan:true,isPro:false,status:'completed'}).includes('Pro required'))
 const failed=renderGate({status:'unavailable'})
 assert.ok(failed.includes('Try again'));assert.ok(!failed.includes('Checking coach access'))
})

const { GUIDES } = require('../server/src/lib/appearanceGuides')
test('action plans expose instructions, timing, limits and clinical sources',()=>{
 const html=renderFeedback({photoQuality:{status:'clear'},strengths:[],improvementOpportunities:[{title:'Under-eye shading',observation:'Shadows appear beneath the eyes in this photo.',recommendation:'Check in daylight before buying an eye cream.',guide:GUIDES.under_eye_shadows}],recommendedActions:[],limitations:['Lighting can change the appearance.']})
 for(const text of ['Start here','How to do it','How often','What to expect','Keep in mind','DermNet','What this photo'])assert.ok(html.includes(text),text)
 assert.ok(html.includes('https://dermnetnz.org/topics/dark-circles-under-the-eyes'))
})
test('retake screen never renders contradictory flaws even if an old payload includes them',()=>{
 const html=renderFeedback({photoQuality:{status:'retake',reason:'Too dark to assess.',retakeSteps:['Face a window.']},strengths:[{title:'Perfect symmetry'}],improvementOpportunities:[{title:'Soft jawline'}]})
 assert.ok(html.includes('A clearer photo comes first'));assert.ok(html.includes('Face a window.'));assert.ok(!html.includes('Soft jawline'));assert.ok(!html.includes('Perfect symmetry'))
})
