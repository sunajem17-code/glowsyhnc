import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { onboardingStartup, normalizeOnboardingCompletion, FINAL_ONBOARDING_STEP } from '../client/src/utils/onboardingStartup.js'
const require=createRequire(import.meta.url)
const {build}=require('../client/node_modules/esbuild')
const root=fileURLToPath(new URL('../client',import.meta.url))
const compiled=await build({entryPoints:[`${root}/src/store/useStore.js`],bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'false'},plugins:[{name:'isolated-native-state',setup(b){
 b.onResolve({filter:/utils\/(iap|developerUnlock|backend)$/},a=>({path:a.path,namespace:'fixture'}))
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const API_BASE="http://127.0.0.1/api";export const checkProStatus=async()=>false;export const isNative=()=>false;export const isLocalDeveloperPreview=()=>false;'}))
}}]})
const memory=new Map()
global.localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)}
global.sessionStorage={removeItem:key=>memory.delete(key)}
function boot(saved){
 if(saved!==undefined){memory.clear();memory.set('ascendus-storage',typeof saved==='string'?saved:JSON.stringify({state:saved,version:0}))}
 const mod=new Module('startup-fixture');mod._compile(compiled.outputFiles[0].text,'startup-fixture.cjs');return mod.exports.default
}
const decide=store=>onboardingStartup(store.getState())
test('no routes are available until hydration explicitly completes',()=>{
 assert.equal(onboardingStartup({onboardingHydrated:false,user:{id:'a'},onboardingCompletedByUser:{'user:a':true}}),'checking')
})
test('fresh install and authenticated account without a completion flag require onboarding',()=>{
 for(const saved of [{},{isAuthenticated:true,user:{id:'new-user'}},{user:{id:'a'},hasOnboarded:false}]) assert.equal(decide(boot(saved)),'onboarding')
})
test('truthy strings and malformed legacy completion flags cannot bypass onboarding',()=>{
 for(const value of ['true','false',1,{},null]) assert.equal(normalizeOnboardingCompletion({hasOnboarded:value}).hasOnboarded,false)
})
test('partial onboarding survives restart without gaining main app access',()=>{
 const store=boot({user:{id:'partial'},isAuthenticated:true,hasOnboarded:false})
 memory.set('ascendus_onboarding_draft',JSON.stringify({step:4,formData:{gender:'male'}}))
 assert.equal(decide(store),'onboarding');assert.equal(decide(boot()),'onboarding')
})
test('only the final step can complete onboarding; sign-in and payment-style callers cannot',()=>{
 const store=boot({user:{id:'new-user'},isAuthenticated:true,token:'fixture-token'})
 for(const step of [undefined,null,0,1,5,'6']){assert.equal(store.getState().setHasOnboarded(step),false);assert.equal(decide(store),'onboarding')}
 assert.equal(store.getState().setHasOnboarded(FINAL_ONBOARDING_STEP),true)
 assert.equal(decide(store),'app');assert.equal(decide(boot()),'app')
})
test('legacy explicitly completed accounts are preserved and cannot leak completion to another account',()=>{
 let store=boot({user:{id:'returning'},token:'fixture-token',isAuthenticated:true,hasOnboarded:true})
 assert.equal(decide(store),'app')
 store.getState().setAuth({id:'new-account'},'new-token');assert.equal(decide(store),'onboarding')
 store=boot();assert.equal(decide(store),'onboarding')
 store.getState().setAuth({id:'returning'},'return-token');assert.equal(decide(store),'app')
})
test('logout and login restore only the matching completed account',()=>{
 const store=boot({user:{id:'a'},isAuthenticated:true,token:'fixture-token'});store.getState().setHasOnboarded(FINAL_ONBOARDING_STEP)
 store.getState().logout();assert.equal(decide(store),'onboarding')
 store.getState().setAuth({id:'b'},'b-token');assert.equal(decide(store),'onboarding')
 store.getState().setAuth({id:'a'},'a-token');assert.equal(decide(store),'app')
})
test('corrupt JSON ends checking safely and never renders the main app',async()=>{
 const store=boot('{bad json');await Promise.resolve();assert.equal(decide(store),'onboarding')
})
test('development reset clears only current completion/draft, preserving auth, scans, premium, and other accounts',()=>{
 const store=boot({user:{id:'a'},token:'fixture-token',isAuthenticated:true,isPremium:true,scans:[{id:'kept-scan'}],onboardingCompletedByUser:{'user:a':true,'user:b':true},hasOnboarded:true})
 memory.set('ascendus_onboarding_draft','{"step":4}');store.getState().resetOnboarding()
 const state=store.getState();assert.equal(decide(store),'onboarding');assert.equal(state.token,'fixture-token');assert.equal(state.isPremium,true);assert.deepEqual(state.scans,[{id:'kept-scan'}]);assert.equal(state.onboardingCompletedByUser['user:b'],true);assert.equal(memory.has('ascendus_onboarding_draft'),false)
})

test('a completed account without a valid local session goes to sign-in instead of looping through main routes',()=>{
 const store=boot({user:{id:'a'},hasOnboarded:true,isAuthenticated:false})
 assert.equal(decide(store),'signin')
 store.getState().setAuth({id:'a'},'new-session');assert.equal(decide(store),'app')
})
