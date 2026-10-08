import test from 'node:test'
import * as presentation from './scanPresentation.js'
test('original intro completes before the first feature highlight', () => {
  assert.equal(scanFrame(1299).active,-1)
  assert.equal(scanFrame(1300).active,0)
})
test('completion holds the final counter for exactly one second', () => {
  const finalCounter=presentation.SCAN_STARTS.at(-1)+1150
  assert.equal(scanFrame(finalCounter).progress,1)
  assert.equal(scanFrame(finalCounter).complete,false)
  assert.equal(scanFrame(finalCounter+999).complete,false)
  assert.equal(scanFrame(finalCounter+1000).complete,true)
})
import assert from 'node:assert/strict'
import { referenceFeatures, portraitTransform } from './scanReferenceGeometry.js'
import { advanceScanClock, scanFrame, PRESENTATION_END, projectPoint, badgeConnectorEnd } from './scanPresentation.js'
test('connector ends outside the circular badge on tall and wide portraits', () => {
  for (const [width,height] of [[360,640],[420,525],[640,360]]) {
    const point={x:45,y:70}, badge={x:95,y:30}
    const end=badgeConnectorEnd(point,badge,width,height)
    assert.ok(Math.abs(Math.hypot((end.x-badge.x)*width/100,(end.y-badge.y)*height/100)-(width*.084+1))<1e-8)
  }
  assert.deepEqual(badgeConnectorEnd({x:50,y:50},{x:50,y:50},360,640),{x:50,y:50})
})
test('chin is a point highlight anchored to the bottom middle of the chin', () => {
  const chinSurface={x:.51,y:.76}
  const chin=referenceFeatures({chinSurface,chin:{x:.5,y:.82}})[0]
  assert.equal(chin.kind,'point')
  assert.deepEqual(chin.point,{x:.5,y:.82})
})

const p = { forehead:{x:.5,y:.16},chin:{x:.5,y:.82},cheekL:{x:.22,y:.46},cheekR:{x:.78,y:.46},
  eyeInnerL:{x:.45,y:.36},eyeOuterL:{x:.27,y:.35},eyeBottomL:{x:.35,y:.39},
  eyeInnerR:{x:.55,y:.36},eyeOuterR:{x:.73,y:.35},eyeBottomR:{x:.65,y:.39},
  jawL:{x:.26,y:.64},jawR:{x:.74,y:.64},jawMidL:{x:.32,y:.72},jawMidR:{x:.68,y:.72},
  jawChinL:{x:.42,y:.79},jawChinR:{x:.58,y:.79},mouthL:{x:.4,y:.62},mouthR:{x:.6,y:.62} }
test('API readiness cannot freeze or rewind the visual timeline', () => {
  let t = 0
  for(let i=0;i<150;i++) t = advanceScanClock(t,100,false)
  assert.equal(t,PRESENTATION_END)
  assert.equal(scanFrame(t).complete,true)
  assert.equal(advanceScanClock(t,16,true),t)
})
test('five stable stages, missing landmarks never shift identities', () => {
  const f=referenceFeatures(p)
  assert.deepEqual(f.map(x=>x.id),['chin','cheekbones','jaw','cheeks','submental'])
  assert.ok(f.every(x=>x.point && x.path))
  const missing=referenceFeatures({...p,cheekL:null})
  assert.equal(missing.length,5)
  assert.equal(missing[2].id,'jaw')
  assert.equal(referenceFeatures(null).length,5)
})
test('geometry follows translation, scale, and roll of measured face', () => {
  const map=q=>({x:q.x*.7-q.y*.12+.18,y:q.x*.12+q.y*.7+.04})
  const moved=Object.fromEntries(Object.entries(p).map(([k,v])=>[k,map(v)]))
  referenceFeatures(p).forEach((f,i)=>{
    const expected=map(f.point),actual=referenceFeatures(moved)[i].point
    assert.ok(Math.abs(expected.x-actual.x)<1e-9)
    assert.ok(Math.abs(expected.y-actual.y)<1e-9)
  })
})
test('capture crop covers the entire portrait without black bars', () => {
  for(const [w,h] of [[1200,800],[800,1200],[600,1800]]) {
    const t=portraitTransform(w,h,p)
    assert.ok(t.sx>=1 && t.sy>=1)
    assert.ok(t.tx<=0 && t.ty<=0)
    assert.ok(t.tx+100*t.sx>=100 && t.ty+100*t.sy>=100)
    assert.ok(Math.abs((w/t.sx)/(h/t.sy)-.8)<1e-9)
    assert.ok(Object.values(t).every(Number.isFinite))
  }
})
test('jaw strokes are separate, equally sized, and reference length', () => {
  const jaw=referenceFeatures(p)[2]
  assert.equal((jaw.path.match(/M /g)||[]).length,2,'jaw has two disconnected strokes')
  assert.equal((jaw.path.match(/L /g)||[]).length,2,'each jaw stroke is one short segment')
  assert.ok(!jaw.path.includes('50.0000 82.0000'),'jaw strokes do not connect through the chin')
  for(const aspect of [.56,1,1.5]) {
    const path=referenceFeatures(p,aspect)[2].path
    const values=path.match(/-?\d+\.\d+/g).map(Number)
    const expected=Math.hypot((p.cheekR.x-p.cheekL.x)*aspect,p.cheekR.y-p.cheekL.y)*28
    for(let i=0;i<values.length;i+=4) {
      const length=Math.hypot((values[i+2]-values[i])*aspect,values[i+3]-values[i+1])
      assert.ok(Math.abs(length-expected)<.001)
    }
  }
})
test('every stage finishes below or at 100 percent', () => {
  for(let t=0;t<=PRESENTATION_END;t+=17) {
    const f=scanFrame(t)
    assert.ok(f.progress>=0 && f.progress<=1)
  }
})
