import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { scanFrame, SCAN_STARTS, COMPILE_AT, PRESENTATION_END, presentationGate, coverTransform, projectPoint, scanCropTransform, SCAN_FEATURES } from '../client/src/utils/scanPresentation.js'
import { frontFeatureAnchors } from '../client/src/utils/scanFeatureAnchors.js'
const { shapeDefinitionAnalysis } = createRequire(import.meta.url)('../server/src/lib/definitionAnalysis.js')

test('all observed boundaries advance once, preserving the eight-stage order', () => {
 assert.equal(scanFrame(0).active,-1)
 SCAN_STARTS.forEach((start,i)=> {assert.equal(scanFrame(start-.01).active,i-1);assert.equal(scanFrame(start).active,i)})
 assert.equal(scanFrame(COMPILE_AT-.01).compiling,false)
 assert.equal(scanFrame(COMPILE_AT).compiling,true)
 assert.equal(scanFrame(PRESENTATION_END-.01).complete,false)
 assert.equal(scanFrame(PRESENTATION_END).complete,true)
 assert.equal(scanFrame(120000).active,7)
})
test('a fast backend must wait for presentation; completion and cancellation settle once', async () => {
 const gate=presentationGate();let navigated=false
 const ready=Promise.all([Promise.resolve('real result'),gate.promise]).then(([,ok])=>{navigated=ok})
 await Promise.resolve();assert.equal(navigated,false)
 gate.finish();gate.finish(false);await ready;assert.equal(navigated,true)
 const cancelled=presentationGate();cancelled.finish(false);cancelled.finish();assert.equal(await cancelled.promise,false)
})
test('missing landmarks preserve eight stages without fabricated face anchors',()=>{
 const features=frontFeatureAnchors(null);assert.equal(features.length,8);assert.ok(features.every(f=>!f.point))
 assert.deepEqual(features.map(f=>f.label),SCAN_FEATURES.map(f=>f.label))
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

test('eye and eyebrow stages preserve detected contours and missing contours stay absent',()=>{
 const eye=[{x:.2,y:.3},{x:.3,y:.28},{x:.4,y:.3},{x:.3,y:.32}]
 const brow=[{x:.2,y:.2},{x:.3,y:.18},{x:.4,y:.2}]
 const features=frontFeatureAnchors({eyeLoopL:eye,browLoopL:brow})
 assert.deepEqual(features.find(f=>f.id==='eyes').regions[0],eye)
 assert.deepEqual(features.find(f=>f.id==='eyebrows').regions[0],brow)
 assert.equal(features.find(f=>f.id==='eyes').regions[1],undefined)
 assert.equal(features.find(f=>f.id==='eyebrows').exact,true)
})

test('scan framing keeps the complete jaw visible across image aspect ratios',()=>{
 const points={forehead:{x:.5,y:.2},jawContour:[{x:.2,y:.4},{x:.35,y:.7},{x:.5,y:.8},{x:.65,y:.7},{x:.8,y:.4}]}
 for (const [w,h] of [[1000,1400],[1920,1080],[1000,1000]]) {
  const t=scanCropTransform(w,h,points)
  for (const point of [...points.jawContour,points.forehead]) {
   const p=projectPoint(point,t)
   assert.ok(p.x>=8&&p.x<=92&&p.y>=10&&p.y<=90)
  }
 }
})
test('jaw and malar overlays retain supplied detected surface points',()=>{
 const jaw=[{x:.2,y:.4},{x:.3,y:.6},{x:.5,y:.8}]
 const malar=[{x:.2,y:.4},{x:.3,y:.42},{x:.33,y:.48},{x:.23,y:.5}]
 const features=frontFeatureAnchors({jawContour:jaw,malarL:malar,mandibleL:jaw})
 assert.deepEqual(features.find(f=>f.id==='jaw').contour,jaw)
 assert.deepEqual(features.find(f=>f.id==='cheekbones').regions[0],malar)
 assert.deepEqual(features.find(f=>f.id==='mandible').contours[0],jaw)
})
