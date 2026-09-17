import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeLandmarkEvidence } from './evidenceAnalysis.js'

function fixture() {
  const points = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const put = (i, x, y) => { points[i] = { x, y, z: 0 } }
  put(234, .25, .50); put(454, .75, .50)
  put(172, .30, .75); put(397, .70, .75)
  put(33, .32, .40); put(133, .43, .40)
  put(362, .57, .40); put(263, .68, .40)
  put(98, .46, .56); put(327, .54, .56)
  put(61, .42, .68); put(291, .58, .68)
  put(13, .50, .665); put(14, .50, .685)
  put(152, .50, .90); put(1, .50, .55)
  put(105, .38, .33); put(334, .62, .33)
  return points
}

test('same landmarks produce repeatable ratios with pixel aspect correction', () => {
  const first = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  const second = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  assert.deepEqual(first, second)
  assert.equal(first.status, 'measured')
  assert.equal(first.measurements.find(m => m.feature === 'jaw_to_cheek_width').normalized_value, .8)
  assert.equal(first.findings.length, 0)
  assert.equal(first.recommendations.length, 0)
})

test('tilt prevents confident measurements', () => {
  const points = fixture()
  points[263].y = .48
  const result = analyzeLandmarkEvidence(points, 1000, 1500)
  assert.equal(result.status, 'additional_image_required')
  assert.equal(result.quality.checks.roll, false)
  assert.ok(result.measurements.every(m => m.confidence === null))
})

test('missing landmarks are rejected', () => {
  assert.equal(analyzeLandmarkEvidence([], 1000, 1000).status, 'additional_image_required')
})
