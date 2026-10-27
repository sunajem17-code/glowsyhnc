const METRIC_PATHS = Object.freeze({
  face_score: ['face_score'],
  grooming_score: ['grooming_score'],
  pillar_harmony: ['pillars', 'harmony'],
  pillar_angularity: ['pillars', 'angularity'],
  pillar_features: ['pillars', 'features'],
  pillar_dimorphism: ['pillars', 'dimorphism'],
  sub_symmetry: ['sub_scores', 'symmetry'],
  sub_jawline_definition: ['sub_scores', 'jawline_definition'],
  sub_skin_clarity: ['sub_scores', 'skin_clarity'],
  sub_facial_proportions: ['sub_scores', 'facial_proportions'],
  sub_eye_area: ['sub_scores', 'eye_area'],
  sub_facial_harmony: ['sub_scores', 'facial_harmony'],
  metric_jawline: ['face_metrics', 'jawline', 'score'],
  metric_cheekbones: ['face_metrics', 'cheekbones', 'score'],
  metric_symmetry: ['face_metrics', 'symmetry', 'score'],
  metric_skin_quality: ['face_metrics', 'skin_quality', 'score'],
  metric_masculinity_femininity: ['face_metrics', 'masculinity_femininity', 'score'],
  metric_facial_thirds: ['face_metrics', 'facial_thirds', 'score'],
})

function normalizeFinding(finding) {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return null
  const title = typeof finding.title === 'string' ? finding.title.trim() : ''
  const observation = typeof finding.observation === 'string' ? finding.observation.trim() : ''
  if (!title || !observation) return null
  const metricKeys = finding.metric_keys ?? finding.metricKeys
  if (!Array.isArray(metricKeys) || metricKeys.length < 1 || metricKeys.length > 2 || metricKeys.some(key => !METRIC_PATHS[key])) return null
  return {
    ...finding,
    title,
    observation,
    metricKeys: [...new Set(metricKeys)],
    significance: typeof finding.significance === 'string' ? finding.significance.trim() : '',
    recommendation: typeof finding.recommendation === 'string' ? finding.recommendation.trim() : '',
  }
}

function bindAppearanceScoreReferences(analysis, scorerResult) {
  const bind = finding => {
    const scoreReferences = finding.metricKeys.map(key => {
      const raw = METRIC_PATHS[key].reduce((value, part) => value?.[part], scorerResult)
      const score = Number(raw)
      if (!Number.isFinite(score) || score < 1 || score > 10) {
        throw new TypeError(`Appearance finding references unavailable score: ${key}`)
      }
      return { key, score: Math.round(score * 10) / 10 }
    })
    return { ...finding, scoreReferences }
  }
  return {
    ...analysis,
    strengths: analysis.strengths.map(bind),
    improvementOpportunities: analysis.improvementOpportunities.map(bind),
  }
}

function hasValidScoreReferences(analysis) {
  const strengths = analysis?.strengths
  const improvements = analysis?.improvementOpportunities
  if (!Array.isArray(strengths) || !Array.isArray(improvements) || strengths.length > 6 || improvements.length > 6) return false
  const findings = [...strengths, ...improvements]
  return findings.every(finding => {
    const refs = finding.scoreReferences
    return Array.isArray(refs) && refs.length === finding.metricKeys?.length && refs.length > 0 && refs.every((ref, index) =>
      ref?.key === finding.metricKeys[index] && Number.isFinite(ref.score) && ref.score >= 1 && ref.score <= 10)
  })
}

function normalizeAppearanceAnalysis(input, scanId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Appearance analysis is required')
  }

  const strengths = input.strengths
  const improvements = input.improvement_opportunities ?? input.improvementOpportunities
  const positive = input.positive_observations ?? input.positiveObservations ?? []

  if (!Array.isArray(strengths) || !Array.isArray(improvements) || !Array.isArray(positive)) {
    throw new TypeError('Appearance analysis findings must be arrays')
  }

  const normalizedStrengths = strengths.map(normalizeFinding)
  const normalizedImprovements = improvements.map(normalizeFinding)
  const normalizedPositive = positive.map(normalizeFinding)

  if (normalizedStrengths.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete strength')
  }
  if (normalizedImprovements.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete improvement opportunity')
  }
  if (normalizedPositive.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete positive observation')
  }
  if (normalizedStrengths.length > 6 || normalizedImprovements.length > 6 || normalizedPositive.length) {
    throw new TypeError('Appearance analysis exceeds supported finding limits')
  }

  return {
    version: 10,
    scanId,
    strengths: normalizedStrengths,
    improvementOpportunities: normalizedImprovements,
    positiveObservations: normalizedPositive,
  }
}

module.exports = { normalizeAppearanceAnalysis, bindAppearanceScoreReferences, hasValidScoreReferences, METRIC_PATHS }
