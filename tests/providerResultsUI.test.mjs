import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire, Module} from 'node:module'
import {fileURLToPath} from 'node:url'
const require=createRequire(import.meta.url)
const {build}=require('../client/node_modules/esbuild')
const compiled=await build({
 stdin:{contents:`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server';import Results from './src/pages/ScanUnlockGate.jsx';import Coach from './src/pages/AICoach.jsx';import MainCoach from './src/pages/Progress.jsx';import {setFixture} from 'fixture-store';export function render(scan,premium){setFixture({currentScan:scan,scans:[scan],isPremium:premium,developerPreviewUnlocked:false});return renderToStaticMarkup(<StaticRouter location="/unlock"><Results/></StaticRouter>)};export function renderCoach(premium,hasScan,main=false){setFixture({user:{id:"isolated-coach-user"},userProfile:{},scans:hasScan?[{id:"scan",glowScore:6.2}]:[],isPremium:premium});return renderToStaticMarkup(<StaticRouter location="/coach">{main?<MainCoach/>:<Coach/>}</StaticRouter>)}`,
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
const {render,renderCoach}=module.exports
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
