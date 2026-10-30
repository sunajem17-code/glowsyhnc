import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require('../client/node_modules/esbuild')
const root = fileURLToPath(new URL('../client', import.meta.url))
const fixtures = {
  '../store/useStore': 'let state={};export const setFixture=s=>{state=s};export default selector=>selector(state)',
  '../components/OnboardingFinalSteps': 'export const openAppStoreReview=()=>{}',
  '../utils/api': 'export const api={};export const setScanInFlight=()=>{}',
  './Scan': 'export const PhotoUploadStep=()=>null;export const AnalyzingScreen=()=>null;export const extractScanOverlayPoints=()=>[];export const buildMeshPathD=()=>""',
  '../utils/iap': 'export const isNative=()=>false',
  '../utils/notifications': 'export const ensureNotificationPermission=()=>{};export const requestNotificationPermission=()=>{}',
  '../utils/productionAnalysis': 'export const buildProductionEvidence=()=>{};export const requestProductionAnalysis=()=>{}',
}
const compiled = await build({
  stdin: {contents: `import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {StaticRouter} from 'react-router-dom/server';import Onboarding from './src/pages/PremiumOnboarding.jsx';import {setFixture} from 'fixture-store';export function render(state,initialSignIn=false){setFixture(state);return renderToStaticMarkup(<StaticRouter><Onboarding initialSignIn={initialSignIn}/></StaticRouter>)}`,resolveDir:root,loader:'jsx'},
  bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',logLevel:'silent',
  define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'false'},
  loader:{'.png':'dataurl','.jpg':'dataurl','.css':'empty'},
  plugins:[{name:'isolate-native-services',setup(b){
    b.onResolve({filter:/.*/},a=>{const path=a.path==='fixture-store'?'../store/useStore':a.path;if(fixtures[path])return {path,namespace:'fixture'}})
    b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],loader:'js'}))
  }}]
})
const mod = new Module('welcome-fixture')
mod._compile(compiled.outputFiles[0].text,'welcome-fixture.cjs')
global.sessionStorage={getItem:()=>null}
function render(draft,state={},initialSignIn=false){
 global.localStorage={getItem:()=>draft}
 return mod.exports.render(state,initialSignIn)
}
test('fresh installation starts at Gender without the removed Welcome screen',()=>{
 const html=render(null)
 assert.ok(html.includes('Your Gender'));assert.equal(html.includes('Welcome to Ascendus'),false);assert.equal(html.includes('Get Started'),false)
})
test('unfinished signed-in and guest sessions ignore every legacy saved screen index',()=>{
 for(const step of [0,1,4,6,7,100,'6'])for(const state of [{},{isAuthenticated:true,isGuest:true},{isAuthenticated:true,isGuest:false}]){
  assert.ok(render(JSON.stringify({step,formData:{gender:'male'}}),state).includes('Your Gender'))
 }
})
test('corrupt drafts still render Gender',()=>assert.ok(render('{invalid').includes('Your Gender')))
test('completed users with expired sessions retain the dedicated sign-in screen',()=>{
 const html=render(null,{},true)
 assert.ok(html.includes('Welcome back'));assert.equal(html.includes('Welcome to Ascendus'),false)
})
