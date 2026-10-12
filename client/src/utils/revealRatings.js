export function getRevealRatings(scan) {
  const fd = scan?.faceData ?? {}
  const ai = scan?.aiScore ?? {}
  const faceScores = ai.faceSubScores ?? fd.faceSubScores ?? scan?.faceSubScores ?? {}
  const metrics = ai.faceMetrics ?? {}
  const overall = ai.overallScore ?? scan?.overallScore ?? scan?.umaxScore ?? scan?.glowScore
  return [
    { label: 'Overall', value: overall },
    { label: 'Potential', value: ai.potentialScore },
    { label: 'Symmetry', value: metrics.symmetry?.score ?? faceScores.symmetry ?? fd.symmetry },
    { label: 'Skin Quality', value: metrics.skinQuality?.score ?? faceScores.skinClarity ?? fd.skinClarity },
    { label: 'Jawline', value: metrics.jawline?.score ?? faceScores.jawlineDefinition ?? fd.jawlineDefinition },
    { label: 'Cheekbones', value: metrics.cheekbones?.score },
  ].map(metric => ({ ...metric, value: typeof metric.value === 'number' && Number.isFinite(metric.value) && metric.value >= 0 && metric.value <= 10 ? metric.value : null }))
}

export function getRevealView({ hasScan, paywallRequested, premium, pending }) {
  if (pending) return 'pending'
  if (paywallRequested && !premium) return 'paywall'
  if (hasScan) return 'ratings'
  return 'empty'
}
