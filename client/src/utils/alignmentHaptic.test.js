import test from 'node:test'
import assert from 'node:assert/strict'
import {createAlignmentHapticGate} from './alignmentHaptic.js'
test('one haptic on entry, with no repeated buzzing while aligned',()=>{
 let time=0;const gate=createAlignmentHapticGate(()=>time)
 assert.equal(gate(false),false);assert.equal(gate(true),true)
 time=3000;assert.equal(gate(true),false)
 gate(false);assert.equal(gate(true),true)
})
test('tracking jitter does not produce rapid repeated haptics',()=>{
 let time=0;const gate=createAlignmentHapticGate(()=>time)
 gate(true);time=200;gate(false);assert.equal(gate(true),false)
 time=2000;gate(false);assert.equal(gate(true),true)
})
