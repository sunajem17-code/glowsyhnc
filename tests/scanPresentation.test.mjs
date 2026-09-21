import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { scanFrame, SCAN_STARTS, COMPILE_AT, PRESENTATION_END, presentationGate, coverTransform, projectPoint } from '../client/src/utils/scanPresentation.js'
import { frontFeatureAnchors } from '../client/src/utils/scanFeatureAnchors.js'
const { shapeDefinitionAnalysis } = createRequire(import.meta.url)('../server/src/lib/definitionAnalysis.js')

test('all observed boundaries advance once, preserving the five-stage order', () => {
 assert.equal(scanFrame(0).active,-1)
 SCAN_STARTS.forEach((start,i)=> {assert.equal(scanFrame(start-.01).active,i-1);assert.equal(scanFrame(start).active,i)})
 assert.equal(scanFrame(COMPILE_AT-.01).compiling,false)
 assert.equal(scanFrame(COMPILE_AT).compiling,true)
 assert.equal(scanFrame(PRESENTATION_END-.01).complete,false)
 assert.equal(scanFrame(PRESENTATION_END).complete,true)
 assert.equal(scanFrame(120000).active,4)
})
test('a fast backend must wait for presentation; completion and cancellation settle once', async () => {
 const gate=presentationGate();let navigated=false
 const ready=Promise.all([Promise.resolve('real result'),gate.promise]).then(([,ok])=>{navigated=ok})
 await Promise.resolve();assert.equal(navigated,false)
 gate.finish();gate.finish(false);await ready;assert.equal(navigated,true)
 const cancelled=presentationGate();cancelled.finish(false);cancelled.finish();assert.equal(await cancelled.promise,false)
})
test('missing landmarks preserve five stages without fabricated face anchors',()=>{
 const features=frontFeatureAnchors(null);assert.equal(features.length,5);assert.ok(features.every(f=>!f.point))
 assert.deepEqual(features.map(f=>f.label),['Chin Definition','Cheekbone Prominence','Jaw Definition','Cheek Leanness & Ogee Curve','Submental Definition'])
})
test('cover transform aligns source center and handles portrait/landscape crops',()=>{
 for (const [w,h] of [[1290,2796],[1000,1000],[1920,1080]]) {
 const t=coverTransform(w,h);const center=projectPoint({x:.5,y:.5},t)
 assert.ok(Math.abs(center.x-50)<1e-9);assert.ok(Math.abs(center.y-50)<1e-9)
 assert.ok(t.sx>=1&&t.sy>=1);assert.ok(Math.abs(t.sx/t.sy-w/h/(333/723))<1e-9)
 }
})
test('definition ratings fail closed for malformed or incomplete model output',()=>{
 const raw={chin:{score:5.3},cheekbones:{score:6.8},jaw:{score:8.7},cheeks:{score:4.2},submental:{score:2.7}}
 const valid=shapeDefinitionAnalysis(raw);assert.equal(valid.overallScore,5.5);assert.equal(valid.focusAreaCount,3)
 for (const score of [null,'7',NaN,Infinity,-1,11]) {
 const result=shapeDefinitionAnalysis({...raw,jaw:{score}})
 assert.equal(result.metrics.jaw,null);assert.equal(result.overallScore,null);assert.equal(result.focusAreaCount,null)
 }
 assert.equal(shapeDefinitionAnalysis(null).overallScore,null)
})
