function calculatePotentialScore(overallScore) {
  if (overallScore == null || overallScore === '') return null
  const score = Number(overallScore)
  if (!Number.isFinite(score) || score < 0 || score > 10) return null
  return Math.min(10, Math.round((score + 1.4) * 10) / 10)
}

function withPotentialScore(result) {
  if (!result || typeof result !== 'object') return result
  return {
    ...result,
    potentialScore: result.potentialScore ?? calculatePotentialScore(result.overallScore),
  }
}

module.exports = { calculatePotentialScore, withPotentialScore }
