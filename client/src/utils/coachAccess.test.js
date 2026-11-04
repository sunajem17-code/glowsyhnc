import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoachAccessMode } from './coachAccess.js'

test('local preview settings do not bypass server-authoritative premium access', () => {
  assert.equal(getCoachAccessMode({ isPremium: true, localPreviewEnabled: true }, true, 'localhost'), 'server')
})

test('local Pro Preview changes UI only and does not grant Coach API access', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: true }, true, 'localhost'), 'paywall')
})

test('paid accounts continue to use the server coach', () => {
  assert.equal(getCoachAccessMode({ isPremium: true, localPreviewEnabled: false }, false, 'ascendus.store'), 'server')
})

test('free accounts without local preview remain gated', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: false }, true, 'localhost'), 'paywall')
})

test('local preview cannot enable the coach outside local development', () => {
  assert.equal(getCoachAccessMode({ isPremium: false, localPreviewEnabled: true }, true, 'ascendus.store'), 'paywall')
})

import { loadCoachAccess } from './coachAccess.js'
test('existing App Store membership is synced before rechecking coach access', async () => {
  const calls=[];let reads=0
  const result=await loadCoachAccess({native:true,userId:'member',loadContext:async()=>{calls.push('context');return {isPro:++reads>1}},checkPurchase:async id=>{assert.equal(id,'member');calls.push('purchase');return true},syncPurchase:async()=>calls.push('sync')})
  assert.equal(result.isPro,true)
  assert.deepEqual(calls,['context','purchase','sync','context'])
})
test('server members do not need an App Store subscription', async()=>{
  const result=await loadCoachAccess({native:true,userId:'web-member',loadContext:async()=>({isPro:true}),checkPurchase:()=>assert.fail('unexpected purchase lookup')})
  assert.equal(result.isPro,true)
})
test('failed verification never grants access or becomes a non-member response', async()=>{
  await assert.rejects(loadCoachAccess({native:true,userId:'member',loadContext:async()=>({isPro:false}),checkPurchase:async()=>true,syncPurchase:async()=>{throw new Error('Verification unavailable')}}),/Verification unavailable/)
})
test('non-members keep the server access decision', async()=>{
  const result=await loadCoachAccess({native:true,userId:'free',loadContext:async()=>({isPro:false}),checkPurchase:async()=>false,syncPurchase:()=>assert.fail('unexpected sync')})
  assert.equal(result.isPro,false)
})

test('browser premium claims trigger server purchase verification without granting access locally', async()=>{
  let reads=0,synced=false
  const result=await loadCoachAccess({native:false,userId:'member',claimedPremium:true,loadContext:async()=>({isPro:++reads>1}),syncPurchase:async id=>{assert.equal(id,'member');synced=true}})
  assert.equal(synced,true)
  assert.equal(result.isPro,true)
})

test('receipt recovery continues when initial server verification is unavailable', async () => {
  let reads = 0
  const result = await loadCoachAccess({native:true,userId:'member',loadContext:async()=>{if (++reads===1) throw new Error('temporarily unavailable'); return {isPro:true,hasCompletedScan:true}},checkPurchase:async()=>true,syncPurchase:async id=>assert.equal(id,'member')})
  assert.equal(result.isPro,true)
})
test('loading and provider failure never turn into a free-user decision', async () => {
  assert.equal(getCoachAccessMode({isPremium:null}),'loading')
  await assert.rejects(loadCoachAccess({native:true,userId:'member',loadContext:async()=>{throw new Error('unavailable')},checkPurchase:async()=>false}),/unavailable/)
})

import { coachGateState } from './coachAccess.js'
test('Coach never exposes a child for cached Premium, another session, a deleted account, or a verification failure',()=>{
 const session={token:'session',account:'owner',subscriptionStatus:'active',isPremium:true}
 assert.equal(coachGateState(session),'loading')
 const access={token:'session',account:'owner',subscriptionStatus:'active',state:'active'}
 assert.equal(coachGateState({...session,access}),'active')
 assert.equal(coachGateState({...session,token:null,access}),'inactive')
 assert.equal(coachGateState({...session,account:'new-owner',access}),'loading')
 assert.equal(coachGateState({...session,token:'new-token',access}),'loading')
 assert.equal(coachGateState({...session,access:{...access,state:'inactive'}}),'inactive')
 assert.equal(coachGateState({...session,access:{...access,state:'unavailable'}}),'unavailable')
 assert.equal(coachGateState({...session,subscriptionStatus:'loading',access}),'loading')
})
