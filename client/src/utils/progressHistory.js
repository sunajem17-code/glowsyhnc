// Keep device-saved ratings visible even when the background cloud save failed.
// Values here are copied from the existing server result, never re-scored.
const FACE_METRICS = {
  overall: scan => scan.overall_score ?? scan.glow_score ?? scan.glowScore ?? scan.aiScore?.overallScore,
  potential: scan => scan.potential_score ?? scan.potentialScore ?? scan.aiScore?.potentialScore,
  symmetry: scan => scan.faceSubScores?.symmetry ?? scan.aiScore?.faceSubScores?.symmetry ?? scan.aiScore?.faceMetrics?.symmetry?.score ?? scan.faceData?.symmetry,
  skin: scan => scan.faceSubScores?.skinClarity ?? scan.aiScore?.faceSubScores?.skinClarity ?? scan.aiScore?.faceMetrics?.skinQuality?.score ?? scan.faceData?.skinClarity,
  jawline: scan => scan.faceSubScores?.jawlineDefinition ?? scan.aiScore?.faceSubScores?.jawlineDefinition ?? scan.aiScore?.faceMetrics?.jawline?.score ?? scan.faceData?.jawlineDefinition,
}

const PHYSIQUE_METRICS = {
  overall: score => score?.overall ?? score?.overallPhysique,
  proportions: score => score?.proportions,
  leanness: score => score?.leanness,
  frame: score => score?.frame,
  posture: score => score?.posture,
  presentation: score => score?.overall_presentation ?? score?.overallPresentation,
}

export function isPhysiqueProgressScan(scan) {
  if (scan?.scanType === 'physique') return true
  const score = scan?.physiqueScore
  const hasFaceScore = [scan?.glowScore, scan?.glow_score, scan?.overall_score, scan?.aiScore?.overallScore]
    .some(value => value != null && Number.isFinite(Number(value)))
  return !!score && !hasFaceScore
}

export function getProgressScore(scan, mode, metric) {
  const value = mode === 'physique'
    ? PHYSIQUE_METRICS[metric]?.(scan?.physiqueScore ?? scan?.aiScore?.physiqueScore)
    : FACE_METRICS[metric]?.(scan)
  const score = Number(value)
  return value != null && Number.isFinite(score) ? score : null
}

export function getProgressTrendSeries(scans, mode, metric) {
  return [...scans]
    .map(scan => ({
      scanId: scan.id,
      timestamp: scan.analyzedAt || scan.scanDate || scan.scan_date || scan.created_at,
      score: getProgressScore(scan, mode, metric),
    }))
    .filter(point => point.score != null && Number.isFinite(Date.parse(point.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

// Locked charts still need scan dates to draw their frame when a metric such
// as Potential has not been saved for every scan. Keep missing values null;
// the chart may use these dates for labels, but must never invent scores.
export function getProgressTrendChartSeries(scans, mode, metric, locked = false) {
  const scoredSeries = getProgressTrendSeries(scans, mode, metric)
  if (!locked) return scoredSeries

  const scoresByScan = new Map(scoredSeries.map(point => [point.scanId, point.score]))
  return [...scans]
    .map(scan => ({
      scanId: scan.id,
      timestamp: scan.analyzedAt || scan.scanDate || scan.scan_date || scan.created_at,
      score: scoresByScan.get(scan.id) ?? null,
    }))
    .filter(point => Number.isFinite(Date.parse(point.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

export function getProgressTrendAxisTicks(locked = false) {
  return locked ? [0, 2, 4, 6, 8, 10] : undefined
}

export function formatProgressTrendLabels(series) {
  const dateParts = series.map(point => {
    const date = new Date(point.timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const year = String(date.getFullYear())
    return {
      fullDate: `${month}-${day}-${year}`,
    }
  })
  return dateParts.map(({ fullDate }, index) => ({
    shortLabel: String(index + 1),
    fullLabel: fullDate,
  }))
}

export function mergeProgressHistory(remoteScans, localScans, currentScan) {
  const rows = [...remoteScans]
  for (const local of localScans) {
    if (!local.progressSavedAt && !isPhysiqueProgressScan(local)) continue
    const scan = currentScan?.id === local.id ? currentScan : local
    const overall = isPhysiqueProgressScan(scan)
      ? getProgressScore(scan, 'physique', 'overall')
      : getProgressScore(scan, 'face', 'overall')
    if (!Number.isFinite(overall)) continue
    const date = scan.scanDate ?? scan.analyzedAt
    const match = rows.find(row => row.id === scan.id || row.id === scan.serverScanId || (
      isPhysiqueProgressScan(row) === isPhysiqueProgressScan(scan)
      && Number(row.overall_score) === overall
      && Math.abs(Date.parse(row.created_at) - Date.parse(date)) < 60000
    ))
    if (match) continue
    rows.push({
      id: scan.id,
      scanType: isPhysiqueProgressScan(scan) ? 'physique' : 'face',
      created_at: date,
      overall_score: overall,
      potential_score: scan.aiScore?.potentialScore ?? scan.potentialScore,
      face_score: scan.aiScore?.faceScore,
      grooming_score: scan.aiScore?.groomingScore,
      physiqueScore: scan.physiqueScore ?? scan.aiScore?.physiqueScore ?? null,
      aiScore: scan.aiScore ?? null,
      facePhotoUrl: scan.facePhotoUrl ?? scan.bodyPhotoUrl ?? scan.face_photo_url ?? scan.body_photo_url ?? null,
      faceSubScores: scan.aiScore?.faceSubScores ?? null,
      faceData: scan.faceData ?? null,
      face_image_url: scan.facePhotoUrl ?? scan.bodyPhotoUrl ?? scan.face_photo_url ?? scan.body_photo_url ?? null,
      body_image_url: scan.bodyPhotoUrl ?? scan.body_photo_url ?? scan.facePhotoUrl ?? null,
      tier: scan.tier,
    })
  }
  return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
