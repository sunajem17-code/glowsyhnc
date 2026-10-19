import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeLandmarkEvidence, buildProfileEvidence, validateRecommendationTrace } from './evidenceAnalysis.js'

function fixture() {
  const points = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const put = (i, x, y) => { points[i] = { x, y, z: 0 } }
  put(10, .50, .18); put(152, .50, .90)
  put(234, .25, .50); put(454, .75, .50)
  put(172, .30, .75); put(397, .70, .75); put(176, .43, .84); put(400, .57, .84)
  put(33, .32, .40); put(133, .43, .40); put(159, .375, .385); put(145, .375, .415)
  put(362, .57, .40); put(263, .68, .40); put(386, .625, .385); put(374, .625, .415)
  put(98, .46, .56); put(327, .54, .56); put(1, .50, .55); put(2, .50, .61)
  put(61, .42, .68); put(291, .58, .68)
  put(0, .50, .655); put(13, .50, .665); put(14, .50, .685); put(17, .50, .695)
  put(105, .38, .33); put(334, .62, .33)
  return points
}

const metric = (result, id) => result.measurements.find(row => row.id === id)

test('landscape side space does not reject an otherwise identical face', () => {
  const portrait = analyzeLandmarkEvidence(fixture(), 500, 750)
  const landscapePoints = fixture().map(p => ({ ...p, x: (p.x * 500 + 500) / 1500 }))
  const landscape = analyzeLandmarkEvidence(landscapePoints, 1500, 750)
  assert.equal(portrait.status, 'measured')
  assert.equal(landscape.status, 'measured')
})

test('a genuinely small face still fails the size check', () => {
  const tiny = fixture().map(p => ({ ...p, x: .5 + (p.x - .5) * .2, y: .5 + (p.y - .5) * .2 }))
  assert.equal(analyzeLandmarkEvidence(tiny, 1000, 1500).quality.checks.faceSize, false)
})

test('same exact landmarks produce identical evidence', () => {
  const first = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  const second = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  assert.deepEqual(first, second)
  assert.equal(first.status, 'measured')
  assert.equal(metric(first, 'jaw_to_cheek_width_ratio').value, .8)
})

test('equivalent normalized landmarks remain stable across image re-encoding dimensions', () => {
  const original = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  const reencoded = analyzeLandmarkEvidence(fixture(), 800, 1200)
  for (const row of original.measurements) assert.equal(metric(reencoded, row.id).value, row.value)
})

test('photometric-only change remains stable when landmark output is unchanged', () => {
  const before = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  const after = analyzeLandmarkEvidence(structuredClone(fixture()), 1000, 1500)
  assert.deepEqual(before.measurements, after.measurements)
})

test('small pose change stays within declared tolerance', () => {
  const points = fixture()
  points[1].x += .005
  points[2].x += .005
  const result = analyzeLandmarkEvidence(points, 1000, 1500)
  assert.equal(result.status, 'measured')
  assert.ok(result.pose.yawProxy <= .12)
})

test('bad roll is rejected and measurements become not assessable', () => {
  const points = fixture()
  points[263].y = .48
  const result = analyzeLandmarkEvidence(points, 1000, 1500)
  assert.equal(result.status, 'additional_image_required')
  assert.equal(result.quality.checks.roll, false)
  assert.ok(result.measurements.every(row => row.assessable === false && row.value === null))
})

test('bad yaw is rejected', () => {
  const points = fixture()
  points[1].x = .63
  const result = analyzeLandmarkEvidence(points, 1000, 1500)
  assert.equal(result.status, 'additional_image_required')
  assert.equal(result.reason, 'excessive_yaw')
})

test('bad pitch is rejected', () => {
  const points = fixture()
  points[1].y = .82
  const result = analyzeLandmarkEvidence(points, 1000, 1500)
  assert.equal(result.status, 'additional_image_required')
  assert.equal(result.reason, 'excessive_pitch')
})

test('left and right eye landmarks map to their correct formulas', () => {
  const result = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  assert.deepEqual(metric(result, 'left_eye_width_to_face_width_ratio').landmarksUsed.slice(0, 2).map(p => p.index), [33, 133])
  assert.deepEqual(metric(result, 'right_eye_width_to_face_width_ratio').landmarksUsed.slice(0, 2).map(p => p.index), [362, 263])
})

test('missing landmarks are rejected', () => {
  assert.equal(analyzeLandmarkEvidence([], 1000, 1000).status, 'additional_image_required')
})

test('unsupported structural claims cannot appear as objective measurements', () => {
  const result = analyzeLandmarkEvidence(fixture(), 1000, 1500)
  assert.equal(result.measurements.some(row => row.id === 'maxilla_development'), false)
  assert.equal(result.notAssessable.find(row => row.id === 'maxilla_development').assessable, false)
  assert.equal(result.notAssessable.find(row => row.id === 'physical_face_width_cm').reason, 'feature_cannot_be_inferred_from_uncalibrated_2d_photography')
})

test('profile geometry is labeled photographic and physical projections are not assessable', () => {
  const result = buildProfileEvidence({ detected: true, facialConvexityDegrees: 168.25 })
  assert.equal(result.measurements[0].id, 'photographic_facial_convexity_angle')
  assert.match(result.measurements[0].limitations[0], /Photographic/)
  assert.equal(result.notAssessable.find(row => row.id === 'physical_nose_projection_mm').assessable, false)
})

test('a recommendation must reference an existing finding', () => {
  const findings = [{ id: 'finding_1' }]
  assert.equal(validateRecommendationTrace({ basedOn: ['finding_1'] }, findings), true)
  assert.equal(validateRecommendationTrace({ basedOn: ['missing'] }, findings), false)
  assert.equal(validateRecommendationTrace({ basedOn: [] }, findings), false)
})
