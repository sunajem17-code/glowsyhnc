function finding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Appearance findings must have a complete title and observation')
  }
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  const observation = typeof value.observation === 'string' ? value.observation.trim() : ''
  const significance = typeof value.significance === 'string' ? value.significance.trim() : ''
  const recommendation = typeof value.recommendation === 'string' ? value.recommendation.trim() : ''
  if (!title || !observation) throw new Error('Appearance findings must have a complete title and observation')
  if (!significance || !recommendation) throw new Error('Appearance findings must include significance and practical advice')
  return {
    title,
    observation,
    significance,
    recommendation,
  }
}

function normalizeAppearanceAnalysis(value, scanId) {
  const strengths = Array.isArray(value?.strengths) ? value.strengths.map(finding) : []
  const improvementOpportunities = Array.isArray(value?.improvement_opportunities)
    ? value.improvement_opportunities.map(finding)
    : []
  if (!strengths.length || strengths.length > 4 || improvementOpportunities.length < 5) {
    throw new Error('Appearance analysis requires one to four Pros and at least five Cons')
  }
  const hasDistinctRows = rows => new Set(rows.map(row => `${row.title.toLowerCase()}|${row.observation.toLowerCase()}`)).size === rows.length
  if (!hasDistinctRows(strengths) || !hasDistinctRows(improvementOpportunities)) {
    throw new Error('Appearance analysis findings must be distinct')
  }
  const positiveObservations = Array.isArray(value?.positive_observations)
    ? value.positive_observations.map(finding)
    : []
  if (positiveObservations.length) throw new Error('Appearance analysis must include Pros in strengths')
  return { version: 15, scanId, strengths, improvementOpportunities, positiveObservations }
}

module.exports = { normalizeAppearanceAnalysis }
