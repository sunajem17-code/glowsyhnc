import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { build } = require('../client/node_modules/esbuild')
const root = fileURLToPath(new URL('../client', import.meta.url))
const source = await build({entryPoints:[`${root}/src/store/useStore.js`],bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env.DEV':'false','import.meta.env.PROD':'false'},plugins:[{name:'native-fixtures',setup(b){b.onResolve({filter:/utils\/(iap|developerUnlock|backend)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const API_BASE="http://127.0.0.1/api";export const checkProStatus=async()=>false;export const isNative=()=>false;export const isLocalDeveloperPreview=()=>false;'}))}}]})
const memory = new Map()
global.localStorage = {getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}
global.sessionStorage = {removeItem(){}}
function boot() {const mod=new Module('lifecycle-fixture');mod._compile(source.outputFiles[0].text,'lifecycle-fixture.cjs');return mod.exports.default}
test('fresh and interrupted sessions stay in onboarding; completed sessions survive restart',()=>{
 memory.clear();let store=boot();assert.equal(store.getState().hasOnboarded,false)
 store.getState().setGuestSession('fixture-user','fixture-token');store=boot();assert.equal(store.getState().hasOnboarded,false)
 store.getState().setHasOnboarded();store=boot();assert.equal(store.getState().hasOnboarded,true)
 store.getState().logout();assert.equal(store.getState().hasOnboarded,false)
})
test('rapid genuine achievements queue without duplicates and dismiss in order',()=>{
 memory.clear();const store=boot();const s=()=>store.getState()
 s().unlockAchievement('first_scan');s().unlockAchievement('streak_7');s().unlockAchievement('first_scan')
 assert.equal(s().pendingAchievement,'first_scan');assert.deepEqual(s().achievementQueue,['streak_7'])
 s().clearPendingAchievement();assert.equal(s().pendingAchievement,'streak_7')
 s().clearPendingAchievement();assert.equal(s().pendingAchievement,null)
 s().unlockAchievement('streak_30');s().logout();assert.equal(s().pendingAchievement,null);assert.deepEqual(s().achievementQueue,[])
})

const notificationBundle = await build({stdin:{contents:`export * from './src/utils/notifications';export { fixture } from 'notification-fixture'`,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'notification-fixtures',setup(b){
 b.onResolve({filter:/^@capacitor\/core$/},()=>({path:'core',namespace:'notifications'}))
 b.onResolve({filter:/^@capacitor\/local-notifications$|^notification-fixture$/},()=>({path:'local',namespace:'notifications'}))
 b.onLoad({filter:/.*/,namespace:'notifications'},a=>({contents:a.path==='core'?`export const Capacitor={isNativePlatform:()=>true}`:`export const fixture={permission:'prompt',requests:0,scheduled:[],cancelled:[]};export const LocalNotifications={checkPermissions:async()=>({display:fixture.permission}),requestPermissions:async()=>{fixture.requests++;await Promise.resolve();return {display:fixture.permission='granted'}},schedule:async n=>fixture.scheduled.push(n),cancel:async n=>fixture.cancelled.push(n)}`}))
}}]})
const notificationModule=new Module('notification-fixture');notificationModule._compile(notificationBundle.outputFiles[0].text,'notification-fixture.cjs')
const notifications=notificationModule.exports
test('simultaneous notification requests share one native permission dialog and schedule the real reminder',async()=>{
 const results=await Promise.all([notifications.ensureNotificationPermission(),notifications.ensureNotificationPermission()])
 assert.deepEqual(results,['granted','granted']);assert.equal(notifications.fixture.requests,1)
 assert.equal(await notifications.requestNotificationPermission(),true)
 const reminder=notifications.fixture.scheduled[0].notifications[0]
 assert.equal(reminder.id,1001);assert.deepEqual(reminder.schedule,{on:{hour:20,minute:0},repeats:true})
 assert.equal(notifications.fixture.cancelled[0].notifications[0].id,1001)
})
test('denied notifications do not repeatedly prompt or schedule a reminder',async()=>{
 notifications.fixture.permission='denied';const before=notifications.fixture.scheduled.length
 assert.equal(await notifications.requestNotificationPermission(),false)
 assert.equal(notifications.fixture.requests,1);assert.equal(notifications.fixture.scheduled.length,before)
})

const scrollBundle = await build({stdin:{contents:`export { default as useCoachScroll } from './src/hooks/useCoachScroll';export { cleanups } from 'react'`,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'hook-fixture',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'hooks'}));b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:`export const cleanups=[];export const useRef=value=>({current:value});export const useEffect=effect=>{const cleanup=effect();if(cleanup)cleanups.push(cleanup)}`}))}}]})
const scrollModule=new Module('scroll-fixture');scrollModule._compile(scrollBundle.outputFiles[0].text,'scroll-fixture.cjs')
test('chat follows streamed replies, respects reading history, and cleans up observers',()=>{
 const observers=[]
 global.ResizeObserver=class {constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 global.MutationObserver=class {constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 const listeners=new Map();const container={scrollHeight:1000,scrollTop:0,clientHeight:500,children:[],addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)}
 const end={current:{closest:()=>container}}
 const follow=scrollModule.exports.useCoachScroll(end,true,[])
 assert.equal(container.scrollTop,1000)
 container.scrollTop=100;listeners.get('scroll')();container.scrollHeight=1200;observers[0].fn();assert.equal(container.scrollTop,100)
 follow();observers[0].fn();assert.equal(container.scrollTop,1200)
 scrollModule.exports.cleanups.forEach(fn=>fn());assert.equal(listeners.size,0);assert.ok(observers.every(observer=>observer.disconnected))
})
