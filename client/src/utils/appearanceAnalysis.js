const CURRENT_APPEARANCE_ANALYSIS_VERSION = 10

function hasCompleteFindings(rows) {
  return Array.isArray(rows) && rows.length <= 6 && rows.every(item =>
    item && typeof item.title === 'string' && item.title.trim() &&
    typeof item.observation === 'string' && item.observation.trim())
}

export function isCurrentAppearanceAnalysis(analysis, scanId) {
  return Boolean(analysis && Number(analysis.version) >= CURRENT_APPEARANCE_ANALYSIS_VERSION &&
    analysis.scanId === scanId && hasCompleteFindings(analysis.strengths) &&
    hasCompleteFindings(analysis.improvementOpportunities))
}
