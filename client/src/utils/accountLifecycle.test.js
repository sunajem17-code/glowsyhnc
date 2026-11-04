import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as onboarding from './onboardingStartup.js'
import * as premium from './premiumStatus.js'
function storage(initial = {}) {
  const values = {...initial}
  return {getItem:key=>values[key]??null,setItem:(key,value)=>{values[key]=value},removeItem:key=>{delete values[key]},values}
}
async function fixture({ nativePaid = true, serverPaid = false } = {}) {
  const local = storage({'ascendus-storage':JSON.stringify({state:{user:{id:'old'},token:'old-token',isAuthenticated:true,isPremium:true,userProfile:{name:'old'},scans:[]},version:0})})
  let disconnects=0, delayedJson=null, failure=false
  const context=vm.createContext({console:{warn(){}},localStorage:local,sessionStorage:storage(),queueMicrotask,AbortSignal,Date,
    fetch:async url=>{
      if(failure)throw Error('offline')
      return {ok:true,status:200,json:async()=>String(url).endsWith('/payments/status') ? (delayedJson ? delayedJson : {isPremium:serverPaid}) : {user:{id:'old',is_pro:true}}}
    }})
  const modules={
    '../utils/backend':{API_BASE:'/api'},'../utils/onboardingStartup.js':onboarding,'../utils/premiumStatus':premium,
    '../utils/premiumDiagnostics':{premiumDiagnostic(){}},
    '../utils/iap':{checkProStatus:async()=>nativePaid,isNative:()=>true,disconnectRevenueCat:async()=>{disconnects++}},
    zustand:{create},'zustand/middleware':{persist:(config,options)=>persist(config,{...options,storage:createJSONStorage(()=>local),onRehydrateStorage:undefined})},
  }
  const module=new vm.SourceTextModule(await readFile(new URL('../store/useStore.js',import.meta.url),'utf8'),{context})
  await module.link(spec=>{const exports=modules[spec];assert.ok(exports,spec);return new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context})})
  await module.evaluate()
  return {store:module.namespace.default,local,disconnects:()=>disconnects,setServer:v=>{serverPaid=v},offline:()=>{failure=true},delay:promise=>{delayedJson=promise}}
}
test('restarting never hydrates cached Premium as confirmed; native-only entitlement cannot override a free server account',async()=>{
 const f=await fixture();assert.equal(f.store.getState().isPremium,false);assert.equal(f.store.getState().subscriptionStatus,'loading')
 await f.store.getState().refreshProStatus({force:true});assert.equal(f.store.getState().isPremium,false)
 assert.equal(f.store.getState().subscriptionStatus,'inactive')
})
test('a verified account becomes Premium, but logout clears identity/profile and prevents old responses from promoting it',async()=>{
 const f=await fixture({serverPaid:true});await f.store.getState().refreshProStatus({force:true});assert.equal(f.store.getState().isPremium,true)
 let resolve;f.delay(new Promise(r=>{resolve=r}));const refresh=f.store.getState().refreshProStatus({force:true})
 await new Promise(r=>setImmediate(r));f.store.getState().logout();resolve({isPremium:true});await refresh
 assert.equal(f.store.getState().token,null);assert.equal(f.store.getState().user,null);assert.equal(f.store.getState().userProfile,null);assert.equal(f.store.getState().isPremium,false);assert.equal(f.disconnects(),1)
 assert.equal(JSON.parse(f.local.getItem('ascendus-storage')).state.isPremium,false)
})
test('new accounts and network errors cannot inherit confirmed Premium',async()=>{
 const f=await fixture({serverPaid:true});await f.store.getState().refreshProStatus({force:true})
 f.store.getState().setGuestSession('new','new-token');assert.equal(f.store.getState().isPremium,false)
 f.offline();await f.store.getState().refreshProStatus({force:true});assert.equal(f.store.getState().subscriptionStatus,'unavailable');assert.equal(f.store.getState().isPremium,false)
})
