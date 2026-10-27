import { isCurrentAppearanceAnalysis } from './appearanceAnalysis.js'

// Only feed current, scan-linked improvement advice into the face routine.
// Legacy score bullets and stale/partial analyses remain available in Results
// but are not treated as validated actions.
export function getValidatedFaceRecommendations(scan) {
  const analysis = scan?.aiScore?.appearanceAnalysis ?? scan?.appearanceAnalysis
  const scanId = scan?.serverScanId || scan?.aiScore?.scanId || scan?.id
  if (!scanId || !isCurrentAppearanceAnalysis(analysis, scanId)) return []
  return analysis.improvementOpportunities
    .filter(item => typeof item.recommendation === 'string' && item.recommendation.trim())
    .map((item, index) => ({
      id: `appearance-${scanId}-${index}`,
      title: item.title.trim(),
      recommendation: item.recommendation.trim(),
      text: `${item.title.trim()} — ${item.recommendation.trim()}`,
      source: 'Face scan',
      kind: 'Action',
    }))
}
