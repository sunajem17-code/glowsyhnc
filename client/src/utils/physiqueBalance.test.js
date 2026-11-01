import test from 'node:test'
import assert from 'node:assert/strict'
import {balancedPhysiqueAreas} from './physiqueBalance.js'
test('six-range physique gets two relative strengths and two development areas',()=>{
 const result=balancedPhysiqueAreas({physiqueScore:{muscle_mass:6.1,body_fat_score:5.8,v_taper:6.5,frame_width:6.2}})
 assert.equal(result.pros.length,2);assert.equal(result.cons.length,2)
 assert.deepEqual(result.pros.map(area=>area.key),['v_taper','frame_width'])
 assert.ok(result.pros.every(area=>!result.cons.some(other=>other.key===area.key)))
})
test('tied ratings still yield distinct, balanced areas',()=>{
 const result=balancedPhysiqueAreas({physiqueScore:{muscle_mass:6,body_fat_score:6,v_taper:6,frame_width:6}})
 assert.equal(new Set([...result.pros,...result.cons].map(area=>area.key)).size,4)
 assert.equal(result.pros.length,result.cons.length)
})
test('missing metrics are never invented',()=>assert.deepEqual(balancedPhysiqueAreas({}),{pros:[],cons:[]}))
