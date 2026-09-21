const KEYS = ['chin', 'cheekbones', 'jaw', 'cheeks', 'submental']
// Cosmetic visual ratings, not clinical measurements or a diagnosis of bloat.
// This boundary accepts model output only; never pass request-body scores here.
function shapeDefinitionAnalysis(raw) {
  const metrics = Object.fromEntries(KEYS.map(key => {
    const value = raw?.[key]
    const valid = typeof value?.score === 'number' && Number.isFinite(value.score) && value.score >= 1 && value.score <= 10
    return [key, valid ? { score: Math.round(value.score * 10) / 10, descriptor: typeof value.descriptor === 'string' ? value.descriptor.slice(0, 180) : null } : null]
  }))
  const scores = Object.values(metrics).filter(Boolean).map(value => value.score)
  const complete = scores.length === KEYS.length
  return { version: 1, method: 'visual-definition-rating', metrics,
    overallScore: complete ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null,
    focusAreaCount: complete ? scores.filter(score => score < 6).length : null }
}
module.exports = { shapeDefinitionAnalysis }
