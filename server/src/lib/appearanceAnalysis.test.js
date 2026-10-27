const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeAppearanceAnalysis, bindAppearanceScoreReferences, hasValidScoreReferences, hasConsistentScoreDirection, extendedMetricsForPersistence } = require('./appearanceAnalysis')

const finding = (title, observation, metric_keys = ['sub_symmetry']) => ({ title, observation, significance: 'This feature supports the overall facial balance.', recommendation: 'Keep the current grooming approach if it suits your style.', metric_keys })

test('normalizes scorer snake_case findings and preserves scan ID type', () => {
  const result = normalizeAppearanceAnalysis({
    strengths: [finding('Balanced features', 'Eyes and nose appear centered.')],
    improvement_opportunities: [finding('Hair presentation', 'Hair appears less controlled in this photo.', ['grooming_score'])],
    positive_observations: [],
  }, 123)

  assert.deepEqual(result, {
    version: 15,
    scanId: 123,
    strengths: [{ ...finding('Balanced features', 'Eyes and nose appear centered.'), metricKeys: ['sub_symmetry'], category: 'symmetry', id: 'appearance-symmetry-balanced-features' }],
    improvementOpportunities: [{ ...finding('Hair presentation', 'Hair appears less controlled in this photo.', ['grooming_score']), metricKeys: ['grooming_score'], category: 'hair-grooming', id: 'appearance-hair-grooming-hair-presentation' }],
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

test('drops known low-information generated phrases while keeping specific traits', () => {
  const result = normalizeAppearanceAnalysis({
    strengths: [
      finding('Eye area is even and unobstructed', 'The eye area is unobstructed.'),
      finding('Skin looks reasonably clear', 'The skin looks reasonably clear.'),
      finding('Balanced eye spacing', 'The distance between the eyes appears proportionate to their width.'),
    ],
    improvement_opportunities: [
      { ...finding('Midface proportions look workable', 'Midface proportions look workable.'), recommendation: 'Start with a hairstyle that frames the midface.' },
      { ...finding('Define cheekbone contour', 'The cheekbone contour is subtle in the front view.', ['metric_cheekbones']), recommendation: 'Try a layered haircut that adds structure around the cheek area.' },
    ],
    positive_observations: [],
  }, 'scan-1')
  assert.deepEqual(result.strengths.map(row => row.title), ['Balanced eye spacing'])
  assert.deepEqual(result.improvementOpportunities.map(row => row.title), ['Define cheekbone contour'])
})

test('filters technical and temporary-pose wording from new AI findings', () => {
  const { isVagueAppearanceFinding } = require('./appearanceAnalysis')
  for (const title of [
    'Angularity is limited',
    'Periorbital appearance looks tired',
    'Midface proportions look workable',
    'Lower face is compressed by posture',
    'Expression softens definition',
  ]) {
    assert.equal(isVagueAppearanceFinding({ title, observation: title }), true, title)
  }
  assert.equal(isVagueAppearanceFinding({ title: 'Jawline looks softer', observation: 'The jaw edge is less distinct.' }), false)
})

test('requires each improvement to include a concrete action', () => {
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [],
    improvement_opportunities: [{ ...finding('Skin texture', 'Some texture is visible.', ['metric_skin_quality']), recommendation: 'Work on your appearance.' }],
    positive_observations: [],
  }, 'scan-1'), /specific, actionable recommendation/)
  const result = normalizeAppearanceAnalysis({
    strengths: [],
    improvement_opportunities: [{ ...finding('Skin texture', 'Some texture is visible.', ['metric_skin_quality']), recommendation: 'Start with a gentle cleanser, moisturizer, and SPF 30+ each morning.' }],
    positive_observations: [],
  }, 'scan-1')
  assert.equal(result.improvementOpportunities.length, 1)
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [], improvement_opportunities: [{ ...finding('Soft jawline', 'The jaw edge is less distinct.', ['metric_jawline']), recommendation: 'Try a different style.' }], positive_observations: [],
  }, 'scan-1'), /specific, actionable recommendation/)
})

test('keeps expanded advice to three short sentences or fewer', () => {
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [], improvement_opportunities: [{
      ...finding('Uneven skin texture', 'Some uneven texture is visible. It is most noticeable on the cheeks.', ['metric_skin_quality']),
      significance: 'Texture can draw attention.', recommendation: 'Use a gentle cleanser each evening.',
    }], positive_observations: [],
  }, 'scan-1'), /no more than three short sentences/)
})

test('rejects insulting, guaranteed, and bone-reshaping advice', () => {
  for (const phrase of ['Poor skin quality is visible.', 'This will guarantee a new look overnight.', 'Mewing can reshape your jaw.']) {
    assert.throws(() => normalizeAppearanceAnalysis({
      strengths: [],
      improvement_opportunities: [{ ...finding('Improve skin texture', phrase, ['metric_skin_quality']), recommendation: 'Use a gentle cleanser each evening.' }],
      positive_observations: [],
    }, 'scan-1'), /discouraging or unrealistic language/)
  }
})

test('rejects duplicate finding titles across pros and cons', () => {
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [finding('Balanced symmetry', 'Your features appear balanced.')],
    improvement_opportunities: [{ ...finding('Balanced symmetry', 'The photo angle is uneven.'), recommendation: 'Start with a cleaner, simple hairstyle.' }],
    positive_observations: [],
  }, 'scan-1'), /repeats a finding/)
})

test('rejects repeated advice across distinct improvement points', () => {
  const common = 'Start with a gentle skincare routine each evening.'
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [],
    improvement_opportunities: [
      { ...finding('Skin texture', 'Some texture is visible.', ['metric_skin_quality']), recommendation: common },
      { ...finding('Under-eye shadowing', 'Some shadow is visible.', ['sub_eye_area']), recommendation: common },
    ],
    positive_observations: [],
  }, 'scan-1'), /repeats a recommendation/)
})

test('collapses overlap and removes generic AI wording without losing distinct supported points', () => {
  const result = normalizeAppearanceAnalysis({
    strengths: [
      { ...finding('Overall facial balance', 'The overall face appears cohesive.', ['pillar_harmony']), basedOn: ['photo:front'] },
      { ...finding('Balanced symmetry', 'In photo:front, the eyes and facial midline appear balanced.', ['sub_symmetry']), basedOn: ['photo:front'] },
      { ...finding('Features read as moderately defined', 'Features are unobstructed.', ['pillar_features']), basedOn: ['photo:front'] },
    ],
    improvement_opportunities: [
      { ...finding('Soft jawline definition', 'The jaw edge appears less distinct.', ['metric_jawline']), recommendation: 'Try a haircut that adds structure around the temples and sides.', basedOn: ['photo:front'] },
      { ...finding('Enhance lower-face definition', 'The lower-face edge appears less distinct.', ['sub_jawline_definition']), recommendation: 'Choose facial hair that frames the lower face.', basedOn: ['photo:front'] },
    ],
    positive_observations: [],
  }, 'scan-1')
  assert.deepEqual(result.strengths.map(item => item.title), ['Balanced symmetry'])
  assert.deepEqual(result.improvementOpportunities.map(item => item.title), ['Soft jawline definition'])
  assert.equal(result.strengths[0].observation.startsWith('In photo:front'), false)
  assert.equal(result.strengths[0].category, 'symmetry')
  assert.ok(result.strengths[0].id.startsWith('appearance-symmetry-'))
})

test('removes photo-taking recommendations instead of surfacing them as advice', () => {
  assert.throws(() => normalizeAppearanceAnalysis({
    strengths: [],
    improvement_opportunities: [{ ...finding('Enhance jawline definition', 'The jaw edge appears subtle.', ['metric_jawline']), recommendation: 'Use even lighting for future comparisons.' }],
    positive_observations: [],
  }, 'scan-1'), /specific, actionable recommendation/)
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

test('rejects a strength or improvement that contradicts its linked category score', () => {
  const lowStrength = normalizeAppearanceAnalysis({
    strengths: [finding('Defined jawline', 'The jaw edge appears defined.', ['metric_jawline'])],
    improvement_opportunities: [], positive_observations: [],
  }, 'scan-1')
  assert.throws(() => bindAppearanceScoreReferences(lowStrength, { face_metrics: { jawline: { score: 3.2 } } }), /contradicts its referenced scan score/)

  const highImprovement = normalizeAppearanceAnalysis({
    strengths: [],
    improvement_opportunities: [{ ...finding('Improve skin texture', 'The skin appears even.', ['metric_skin_quality']), recommendation: 'Use a gentle moisturizer each evening.' }],
    positive_observations: [],
  }, 'scan-1')
  assert.throws(() => bindAppearanceScoreReferences(highImprovement, { face_metrics: { skin_quality: { score: 9.1 } } }), /contradicts its referenced scan score/)
})

test('does not label average metrics as strengths or improvements and requires a matching metric reference', () => {
  assert.equal(hasConsistentScoreDirection({ strengths: [{ title: 'Skin texture', scoreReferences: [{ key: 'metric_skin_quality', score: 5.6 }] }], improvementOpportunities: [] }), false)
  assert.equal(hasConsistentScoreDirection({ strengths: [], improvementOpportunities: [{ title: 'Improve skin texture', scoreReferences: [{ key: 'metric_skin_quality', score: 6.0 }] }] }), false)
  assert.equal(hasConsistentScoreDirection({ strengths: [{ title: 'Balanced eye spacing', scoreReferences: [{ key: 'metric_jawline', score: 8.0 }] }], improvementOpportunities: [] }), false)
  assert.equal(hasConsistentScoreDirection({ strengths: [{ title: 'Balanced eye spacing', scoreReferences: [{ key: 'sub_eye_area', score: 7.1 }] }], improvementOpportunities: [] }), true)
})

test('cloud persistence carries appearance analysis beside extended metrics', () => {
  const appearanceAnalysis = { version: 12, strengths: [finding('Balanced features', 'Centered.')], improvementOpportunities: [finding('Soft jawline', 'Edge is subtle.')], positiveObservations: [] }
  const extendedMetrics = { eyes: { orbital_depth: { score: 6 } } }
  assert.deepEqual(extendedMetricsForPersistence(extendedMetrics, appearanceAnalysis), { ...extendedMetrics, appearanceAnalysis })
  assert.deepEqual(extendedMetricsForPersistence(null, appearanceAnalysis), { appearanceAnalysis })
  assert.equal(extendedMetricsForPersistence(null, null), null)
})
