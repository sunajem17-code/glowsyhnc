const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeAppearanceAnalysis, bindAppearanceScoreReferences, hasValidScoreReferences } = require('./appearanceAnalysis')

const finding = (title, observation, metric_keys = ['sub_symmetry']) => ({ title, observation, significance: 'Visible in the supplied photo', recommendation: 'Keep this in mind', metric_keys })

test('normalizes scorer snake_case findings and preserves scan ID type', () => {
  const result = normalizeAppearanceAnalysis({
    strengths: [finding('Balanced features', 'Eyes and nose appear centered.')],
    improvement_opportunities: [finding('Hair presentation', 'Hair appears less controlled in this photo.', ['grooming_score'])],
    positive_observations: [],
  }, 123)

  assert.deepEqual(result, {
    version: 10,
    scanId: 123,
    strengths: [{ ...finding('Balanced features', 'Eyes and nose appear centered.'), metricKeys: ['sub_symmetry'] }],
    improvementOpportunities: [{ ...finding('Hair presentation', 'Hair appears less controlled in this photo.', ['grooming_score']), metricKeys: ['grooming_score'] }],
    positiveObservations: [],
  })
})

test('rejects missing arrays and findings without a title or observation', () => {
  assert.throws(() => normalizeAppearanceAnalysis({}, 'scan-1'), /arrays/)
  assert.throws(() => normalizeAppearanceAnalysis({ strengths: [finding('', 'Visible')], improvement_opportunities: [finding('Concern', 'Visible')] }, 'scan-1'), /incomplete strength/)
  assert.throws(() => normalizeAppearanceAnalysis({ strengths: [finding('Strength', 'Visible')], improvement_opportunities: [finding('Concern', '  ')] }, 'scan-1'), /incomplete improvement/)
  assert.throws(() => normalizeAppearanceAnalysis({ strengths: [finding('Strength', 'Visible', ['not_a_metric'])], improvement_opportunities: [finding('Concern', 'Visible')] }, 'scan-1'), /incomplete strength/)
})

test('does not fabricate findings when the scan does not support them', () => {
  const result = normalizeAppearanceAnalysis({ strengths: [], improvement_opportunities: [], positive_observations: [] }, 'scan-empty')
  assert.deepEqual(result.strengths, [])
  assert.deepEqual(result.improvementOpportunities, [])
  assert.equal(hasValidScoreReferences(result), true)
})

test('binds each point to exact score values from this scan response', () => {
  const analysis = normalizeAppearanceAnalysis({
    strengths: [finding('Defined jawline', 'The jaw edge is visible.', ['metric_jawline', 'sub_jawline_definition'])],
    improvement_opportunities: [finding('Skin texture', 'Uneven texture is visible.', ['metric_skin_quality'])],
    positive_observations: [],
  }, 'scan-1')
  const bound = bindAppearanceScoreReferences(analysis, {
    face_metrics: { jawline: { score: 7.26 }, skin_quality: { score: 5.34 } },
    sub_scores: { jawline_definition: 7.1 },
  })

  assert.deepEqual(bound.strengths[0].scoreReferences, [
    { key: 'metric_jawline', score: 7.3 },
    { key: 'sub_jawline_definition', score: 7.1 },
  ])
  assert.deepEqual(bound.improvementOpportunities[0].scoreReferences, [{ key: 'metric_skin_quality', score: 5.3 }])
  assert.equal(hasValidScoreReferences(bound), true)
  assert.equal(hasValidScoreReferences(analysis), false)
  assert.throws(() => bindAppearanceScoreReferences(analysis, {}), /unavailable score/)
})
