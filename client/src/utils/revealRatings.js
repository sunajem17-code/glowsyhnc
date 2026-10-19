export function getRatingColor(score) {
  const value = Math.max(0, Math.min(10, Number.isFinite(score) ? score : 0))
  const stops = [
    { score: 0, color: [239, 68, 68] },
    { score: 2.1, color: [255, 141, 55] },
    { score: 4.5, color: [249, 115, 22] },
    { score: 5.7, color: [217, 119, 6] },
    { score: 6.1, color: [224, 169, 0] },
    { score: 6.5, color: [250, 204, 21] },
    { score: 6.8, color: [190, 225, 20] },
    { score: 7, color: [163, 230, 53] },
    { score: 8.8, color: [48, 229, 32] },
    { score: 10, color: [34, 197, 94] },
  ]
  const upperIndex = stops.findIndex(stop => stop.score >= value)
  if (upperIndex <= 0) return `rgb(${stops[0].color.join(', ')})`
  const lower = stops[upperIndex - 1]
  const upper = stops[upperIndex]
  const amount = (value - lower.score) / (upper.score - lower.score)
  const rgb = lower.color.map((channel, index) => Math.round(channel + (upper.color[index] - channel) * amount))
  return `rgb(${rgb.join(', ')})`
}

function scoreValue(metric) {
  if (typeof metric === 'number') return metric
  return metric?.score
}

function parseObject(value) {
  if (!value || typeof value !== 'string') return value ?? {}
  try { return JSON.parse(value) ?? {} } catch { return {} }
}

export function getRevealRatings(scan) {
  const fd = parseObject(scan?.faceData ?? scan?.face_data)
  const ai = scan?.aiScore ?? {}
  const faceScores = ai.faceSubScores ?? fd.faceSubScores ?? scan?.faceSubScores ?? {}
  const metrics = ai.faceMetrics ?? ai.face_metrics ?? scan?.faceMetrics ?? scan?.face_metrics ?? fd.faceMetrics ?? fd.face_metrics ?? {}
  const rawExtendedMetrics = ai.extendedMetrics ?? ai.extended_metrics ?? scan?.extendedMetrics ?? scan?.extended_metrics ?? {}
  let extendedMetrics = rawExtendedMetrics
  if (typeof rawExtendedMetrics === 'string') {
    try { extendedMetrics = JSON.parse(rawExtendedMetrics) ?? {} } catch { extendedMetrics = {} }
  }
  const overall = ai.overallScore ?? scan?.overallScore ?? scan?.overall_score ?? scan?.umaxScore ?? scan?.glowScore ?? scan?.glow_score
  return [
    { label: 'Overall', value: overall },
    { label: 'Potential', value: ai.potentialScore ?? ai.potential_score ?? scan?.potentialScore ?? scan?.potential_score },
    { label: 'Symmetry', value: scoreValue(metrics.symmetry) ?? scoreValue(faceScores.symmetry ?? faceScores.symmetry_score) ?? scoreValue(fd.symmetry) },
    { label: 'Skin Quality', value: scoreValue(metrics.skinQuality ?? metrics.skin_quality) ?? scoreValue(faceScores.skinClarity ?? faceScores.skin_clarity) ?? scoreValue(fd.skinClarity ?? fd.skin_clarity) },
    { label: 'Jawline', value: scoreValue(metrics.jawline ?? metrics.jawlineDefinition) ?? scoreValue(faceScores.jawlineDefinition ?? faceScores.jawline_definition) ?? scoreValue(fd.jawlineDefinition ?? fd.jawline_definition) },
    { label: 'Cheekbones', value: scoreValue(metrics.cheekbones) ?? scoreValue(faceScores.cheekbones ?? faceScores.cheekboneProminence) ?? scoreValue(fd.cheekbones ?? fd.cheekboneProminence) ?? scoreValue(extendedMetrics.midface?.cheekbones) },
  ].map(metric => ({ ...metric, value: typeof metric.value === 'number' && Number.isFinite(metric.value) && metric.value >= 0 && metric.value <= 10 ? metric.value : null }))
}

export function getResultsHeading() {
  return 'Your Results'
}

// The explicit local demo path predates Potential and individual face metrics.
// Complete only those synthetic demo records so the preview card is useful;
// real scans are never filled with client-invented scores.
export function completeDemoRevealRatings(scan) {
  const ai = scan?.aiScore
  const isDemo = ai?.demoMode === true || ai?.insights?.some?.(item => String(item).startsWith('Demo mode.'))
  if (!isDemo) return scan

  const ratings = getRevealRatings(scan)
  const overall = ratings[0].value
  if (overall == null) return scan
  const readSubScore = (...keys) => {
    for (const key of keys) {
      const raw = ai?.faceSubScores?.[key] ?? scan?.faceData?.[key]
      const value = typeof raw === 'number' ? raw : raw?.score
      if (Number.isFinite(value) && value >= 0 && value <= 10) return value
    }
    return null
  }
  const round = value => Math.round(value * 10) / 10
  const potential = ratings[1].value ?? Math.min(10, round(overall + 1.4))
  const symmetry = ratings[2].value ?? readSubScore('symmetry')
  const skin = ratings[3].value ?? readSubScore('skinClarity', 'skin_clarity')
  const jawline = ratings[4].value ?? readSubScore('jawlineDefinition', 'jawline_definition')
  const cheekbones = ratings[5].value ?? (() => {
    const referenceScores = [jawline, readSubScore('facialProportions', 'facial_proportions'), symmetry].filter(Number.isFinite)
    return referenceScores.length ? round(referenceScores.reduce((sum, value) => sum + value, 0) / referenceScores.length) : null
  })()
  const previous = ai?.faceMetrics ?? {}
  const metric = (key, value) => {
    const storedValue = scoreValue(previous[key])
    if (Number.isFinite(storedValue) && storedValue >= 0 && storedValue <= 10) return previous[key]
    return value == null ? previous[key] ?? null : { ...previous[key], score: value }
  }
  const completedAi = {
    ...ai,
    potentialScore: potential,
    faceMetrics: {
      ...previous,
      symmetry: metric('symmetry', symmetry),
      skinQuality: metric('skinQuality', skin),
      jawline: metric('jawline', jawline),
      cheekbones: metric('cheekbones', cheekbones),
    },
  }
  return { ...scan, potentialScore: scan?.potentialScore ?? potential, aiScore: completedAi }
}

function findMatchingStoredScan(scan, savedScans = []) {
  const targetScore = Number(scan?.aiScore?.overallScore ?? scan?.umaxScore ?? scan?.glowScore)
  if (!Number.isFinite(targetScore) || !Array.isArray(savedScans)) return null

  const targetTime = Date.parse(scan?.scanDate ?? scan?.analyzedAt ?? '')
  const matches = savedScans.flatMap(saved => {
    const overall = Number(saved?.overall_score ?? saved?.overallScore)
    if (!Number.isFinite(overall) || Math.abs(overall - targetScore) > 0.11) return []
    const savedTime = Date.parse(saved?.created_at ?? saved?.createdAt ?? '')
    const distance = Number.isFinite(targetTime) && Number.isFinite(savedTime)
      ? Math.abs(savedTime - targetTime)
      : Number.POSITIVE_INFINITY
    return [{ saved, distance }]
  })

  if (!matches.length) return null
  const match = matches.reduce((best, next) => next.distance < best.distance ? next : best)
  return match.distance <= 24 * 60 * 60 * 1000 ? match.saved : null
}

export function findStoredPotentialScore(scan, savedScans = []) {
  const saved = findMatchingStoredScan(scan, savedScans)
  const potential = Number(saved?.potential_score ?? saved?.potentialScore)
  return Number.isFinite(potential) && potential >= 0 && potential <= 10 ? potential : null
}

export function getRevealView({ hasScan, paywallRequested, premium, pending }) {
  if (pending) return 'pending'
  if (paywallRequested && !premium) return 'paywall'
  if (hasScan) return 'ratings'
  return 'empty'
}

const potentialRecoveryRequests = new Map()
const revealRecoveryRequests = new Map()

export function recoverMissingRevealRatings(scan, apiClient) {
  const requestKey = scan.id ?? 'current-scan'
  if (revealRecoveryRequests.has(requestKey)) return revealRecoveryRequests.get(requestKey)
  const request = (async () => {
    const existing = getRevealRatings(scan)
    const missingIndexes = existing.flatMap((rating, index) => rating.value == null ? [index] : [])
    if (!missingIndexes.length) return { values: [] }

    // Older local scans may not have persisted Potential even though the
    // authenticated server can derive it from the saved overall score.
    // Recover that server-owned value independently so a failed photo rescore
    // does not hide the one score that is already available.
    const values = Array(existing.length).fill(null)
    try {
      const { scans } = await apiClient.supabase.getScans()
      const savedScan = findMatchingStoredScan(scan, scans)
      const savedRatings = savedScan ? getRevealRatings(savedScan) : []
      missingIndexes.forEach(index => { values[index] = savedRatings[index]?.value ?? null })
      if (missingIndexes.includes(1)) values[1] = values[1] ?? findStoredPotentialScore(scan, scans)
    } catch {
      // Continue to the original-photo scorer below where possible.
    }
    const stillMissing = missingIndexes.filter(index => values[index] == null)
    if (!stillMissing.length) return { values }

    if (scan.facePhotoUrl?.startsWith('data:image/')) {
      try {
        const result = await apiClient.ai.score({
          faceImage: scan.facePhotoUrl,
          sideImage: scan.sidePhotoUrl || null,
          gender: scan.gender || 'male',
          analysisEvidence: scan.analysisEvidence,
          sideProfileGeometry: scan.sideProfileGeometry,
        })
        const overall = existing[0].value
        const recoveredRatings = getRevealRatings({ aiScore: result })
        if (overall == null || !Number.isFinite(result.overallScore) || Math.abs(result.overallScore - overall) > 0.05) {
          throw new Error('Recovered result does not match this scan')
        }
        stillMissing.forEach(index => { values[index] = recoveredRatings[index].value })
      } catch (error) {
        if (values.every(value => value == null)) throw error
      }
      return { values }
    }

    if (values.some(value => value != null)) return { values }
    const error = new Error('The original scan photo is unavailable for rescoring')
    error.code = 'SCAN_PHOTO_UNAVAILABLE'
    throw error
  })()
  revealRecoveryRequests.set(requestKey, request)
  request.finally(() => revealRecoveryRequests.delete(requestKey)).catch(() => {})
  return request
}

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
