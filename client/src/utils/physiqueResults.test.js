import test from 'node:test'
import assert from 'node:assert/strict'
import { getPhysiqueMetricScore } from './physiqueResults.js'

test('reads metrics from current physique scan fields', () => {
  const scan = { physiqueScore: { overall: 8.3, potential: 9.1, muscle_mass: 7.4, body_fat_score: 6.2, v_taper: 7.8, frame_width: 6.9 } }
  for (const [key, value] of Object.entries(scan.physiqueScore)) assert.equal(getPhysiqueMetricScore(scan, key), value)
})

test('maps saved legacy body ratings to their matching current metrics', () => {
  const scan = { aiScore: { physiqueResult: { overallPhysique: 8.3, muscleDevelopment: 7.2, bodyFatEstimate: 6.4, shoulderToWaist: 7.6, frame: 6.8 } } }
  assert.equal(getPhysiqueMetricScore(scan, 'overall'), 8.3)
  assert.equal(getPhysiqueMetricScore(scan, 'muscle_mass'), 7.2)
  assert.equal(getPhysiqueMetricScore(scan, 'body_fat_score'), 6.4)
  assert.equal(getPhysiqueMetricScore(scan, 'v_taper'), 7.6)
  assert.equal(getPhysiqueMetricScore(scan, 'frame_width'), 6.8)
})

test('reports genuinely missing or invalid metrics instead of inventing a 5.0', () => {
  assert.equal(getPhysiqueMetricScore({ physiqueScore: { overall: 8.3 } }, 'potential'), null)
  assert.equal(getPhysiqueMetricScore({ physiqueScore: { muscle_mass: 11 } }, 'muscle_mass'), null)
})
