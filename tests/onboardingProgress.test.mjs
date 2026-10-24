import test from 'node:test'
import assert from 'node:assert/strict'
// This helper has no browser/native dependencies.
import {normalizeOnboardingStep,nextOnboardingStep,ONBOARDING_STEP_COUNT} from '../client/src/utils/onboardingProgress.js'
test('valid saved steps resume the same screen',()=>{
 for(let i=0;i<ONBOARDING_STEP_COUNT;i++) assert.equal(normalizeOnboardingStep(i),i)
})
test('stale, corrupt and out-of-range saved steps always resolve to a rendered screen',()=>{
 for(const value of [undefined,null,-1,7,8,9,100,1.5,'3',{},[],NaN,Infinity]) assert.equal(normalizeOnboardingStep(value),0)
})
test('forward and backward navigation never go outside the rendered screens',()=>{
 assert.equal(nextOnboardingStep(6),6)
 assert.equal(nextOnboardingStep(0,-1),0)
 for(let i=0;i<6;i++) assert.equal(nextOnboardingStep(i),i+1)
 for(let i=1;i<7;i++) assert.equal(nextOnboardingStep(i,-1),i-1)
})
