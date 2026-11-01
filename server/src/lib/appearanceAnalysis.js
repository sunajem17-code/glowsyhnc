const { canonicalizeFinding } = require('./appearanceFindingCatalog')

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
  const canonical = canonicalizeFinding(value)
  return {
    catalogId: canonical.catalogId,
    title: canonical.title || title,
    observation,
    significance,
    recommendation,
  }
}

function normalizeAppearanceAnalysis(value, scanId) {
  const uniqueCatalogFindings = rows => {
    const unique = new Map()
    for (const row of Array.isArray(rows) ? rows : []) {
      const normalized = finding(row)
      if (!unique.has(normalized.catalogId)) unique.set(normalized.catalogId, normalized)
    }
    return [...unique.values()]
  }
  const strengths = uniqueCatalogFindings(value?.strengths)
  const improvementOpportunities = uniqueCatalogFindings(value?.improvement_opportunities)
  if (!strengths.length || strengths.length > 4 || !improvementOpportunities.length) {
    throw new Error('Appearance analysis requires one to four Pros and at least one Con')
  }
  const positiveObservations = Array.isArray(value?.positive_observations)
    ? uniqueCatalogFindings(value.positive_observations)
    : []
  if (positiveObservations.length) throw new Error('Appearance analysis must include Pros in strengths')
  return { version: 21, scanId, strengths, improvementOpportunities, positiveObservations }
}

module.exports = { normalizeAppearanceAnalysis }
