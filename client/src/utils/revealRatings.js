export function getRatingColor(score) {
  const value = Math.max(0, Math.min(10, score))
  const hue = value <= 6.5 ? value / 6.5 * 55 : 55 + (value - 6.5) / 3.5 * 75
  return `hsl(${hue}, 92%, 55%)`
}

export function getRevealRatings(scan) {
  const fd = scan?.faceData ?? {}
  const ai = scan?.aiScore ?? {}
  const faceScores = ai.faceSubScores ?? fd.faceSubScores ?? scan?.faceSubScores ?? {}
  const metrics = ai.faceMetrics ?? {}
  const overall = ai.overallScore ?? scan?.overallScore ?? scan?.umaxScore ?? scan?.glowScore
  return [
    { label: 'Overall', value: overall },
    { label: 'Potential', value: ai.potentialScore ?? scan?.potentialScore },
    { label: 'Symmetry', value: metrics.symmetry?.score ?? faceScores.symmetry ?? fd.symmetry },
    { label: 'Skin Quality', value: metrics.skinQuality?.score ?? faceScores.skinClarity ?? fd.skinClarity },
    { label: 'Jawline', value: metrics.jawline?.score ?? faceScores.jawlineDefinition ?? fd.jawlineDefinition },
    { label: 'Cheekbones', value: metrics.cheekbones?.score },
  ].map(metric => ({ ...metric, value: typeof metric.value === 'number' && Number.isFinite(metric.value) && metric.value >= 0 && metric.value <= 10 ? metric.value : null }))
}

export function findStoredPotentialScore(scan, savedScans = []) {
  const targetScore = Number(scan?.aiScore?.overallScore ?? scan?.umaxScore ?? scan?.glowScore)
  if (!Number.isFinite(targetScore) || !Array.isArray(savedScans)) return null

  const targetTime = Date.parse(scan?.scanDate ?? scan?.analyzedAt ?? '')
  const matches = savedScans.flatMap(saved => {
    const overall = Number(saved?.overall_score ?? saved?.overallScore)
    const potential = Number(saved?.potential_score ?? saved?.potentialScore)
    if (!Number.isFinite(overall) || Math.abs(overall - targetScore) > 0.11) return []
    if (!Number.isFinite(potential) || potential < 0 || potential > 10) return []
    const savedTime = Date.parse(saved?.created_at ?? saved?.createdAt ?? '')
    const distance = Number.isFinite(targetTime) && Number.isFinite(savedTime)
      ? Math.abs(savedTime - targetTime)
      : Number.POSITIVE_INFINITY
    return [{ potential, distance }]
  })

  if (!matches.length) return null
  const match = matches.reduce((best, next) => next.distance < best.distance ? next : best)
  return match.distance <= 24 * 60 * 60 * 1000 ? match.potential : null
}

export function getRevealView({ hasScan, paywallRequested, premium, pending }) {
  if (pending) return 'pending'
  if (paywallRequested && !premium) return 'paywall'
  if (hasScan) return 'ratings'
  return 'empty'
}

const potentialRecoveryRequests = new Map()

export function recoverPotentialScore(scan, apiClient) {
  if (potentialRecoveryRequests.has(scan.id)) return potentialRecoveryRequests.get(scan.id)
  const request = (async () => {
    const { scans } = await apiClient.supabase.getScans()
    const saved = findStoredPotentialScore(scan, scans)
    if (saved != null) return saved
    // Recover the legacy browser-only scan from its original photo bytes.
    // The existing authenticated scorer owns both the score and cache lookup.
    if (!scan.facePhotoUrl?.startsWith('data:image/')) throw new Error('Original scan photo is unavailable')
    const result = await apiClient.ai.score({
      faceImage: scan.facePhotoUrl,
      sideImage: scan.sidePhotoUrl || null,
      gender: scan.gender || 'male',
      analysisEvidence: scan.analysisEvidence,
      sideProfileGeometry: scan.sideProfileGeometry,
    })
    const overall = getRevealRatings(scan)[0].value
    const potential = getRevealRatings({ aiScore: result })[1].value
    if (potential == null || overall == null || !Number.isFinite(result.overallScore) || Math.abs(result.overallScore - overall) > 0.05) {
      throw new Error('Recovered result does not match this scan')
    }
    return potential
  })()
  potentialRecoveryRequests.set(scan.id, request)
  request.finally(() => potentialRecoveryRequests.delete(scan.id)).catch(() => {})
  return request
}
