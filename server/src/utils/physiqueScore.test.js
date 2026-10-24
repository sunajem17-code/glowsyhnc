const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizePhysiqueScores } = require('./physiqueScore')

const validScores = {
  proportions: 6.2, leanness: 5.8, frame: 6.4, posture: 7.1, overall_presentation: 6.5,
  potential: 5.1, muscle_mass: 7.4, body_fat_score: 5.8, v_taper: 6.8, frame_width: 6.3,
}

test('calculates overall from the existing five categories and keeps potential at least as high', () => {
  const result = normalizePhysiqueScores(validScores)
  assert.equal(result.overall, 6.4)
  assert.equal(result.potential, 6.4)
  assert.equal(result.muscle_mass, 7.4)
})

test('preserves higher AI-assessed potential and clamps scores to the existing scale', () => {
  const result = normalizePhysiqueScores({ ...validScores, potential: 9.3, frame_width: 11 })
  assert.equal(result.potential, 9.3)
  assert.equal(result.frame_width, 10)
})

test('rejects missing or invalid scores instead of fabricating a 5.0', () => {
  const missing = { ...validScores }
  delete missing.muscle_mass
  assert.throws(() => normalizePhysiqueScores(missing), /invalid muscle_mass score/)
  assert.throws(() => normalizePhysiqueScores({ ...validScores, v_taper: '5.0' }), /invalid v_taper score/)
})
