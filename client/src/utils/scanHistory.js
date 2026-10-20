function parseField(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback
  try { return JSON.parse(value) ?? fallback } catch { return fallback }
}

const SCORE_COLOR_STOPS = [
  { score: 0, rgb: [239, 68, 68] },
  { score: 5, rgb: [250, 204, 21] },
  { score: 10, rgb: [34, 197, 94] },
]

export function getHistoryScoreColor(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'rgba(255,255,255,0.4)'
  const score = Math.max(0, Math.min(10, Number(value)))
  const upperIndex = SCORE_COLOR_STOPS.findIndex(stop => stop.score >= score)
  if (upperIndex <= 0) return '#EF4444'
  if (upperIndex === -1) return '#22C55E'

  const lower = SCORE_COLOR_STOPS[upperIndex - 1]
  const upper = SCORE_COLOR_STOPS[upperIndex]
  const progress = (score - lower.score) / (upper.score - lower.score)
  const channels = lower.rgb.map((channel, index) => Math.round(channel + (upper.rgb[index] - channel) * progress))
  return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function normalizeHistoryScan(scan) {
  return {
    ...scan,
    glowScore: scan.aiScore?.overallScore ?? scan.glowScore ?? scan.glow_score ?? scan.overall_score ?? null,
    potentialScore: scan.aiScore?.potentialScore ?? scan.potentialScore ?? scan.potential_score ?? null,
    faceData: parseField(scan.faceData ?? scan.face_data, null),
    bodyData: parseField(scan.bodyData ?? scan.body_data, null),
    insights: parseField(scan.insights, []),
    facePhotoUrl: scan.facePhotoUrl || scan.face_photo_url || scan.face_image_url || scan.bodyPhotoUrl || scan.body_photo_url || scan.body_image_url || null,
    analyzedAt: scan.analyzedAt || scan.analyzed_at || scan.scanDate || scan.scan_date || scan.created_at,
    tier: scan.tier ?? scan.aiScore?.tier ?? parseField(scan.faceData ?? scan.face_data, null)?.tier ?? null,
  }
}

// Prefer full device-saved results, including late-arriving metric updates.
// Opening history must never re-score a photo or discard its AI response.
export function mergeScanHistory(remoteScans, localScans, currentScan) {
  const rows = []
  const seen = new Set()
  for (const scan of [currentScan, ...localScans, ...remoteScans]) {
    if (!scan?.id || seen.has(scan.id) || (scan.serverScanId && seen.has(scan.serverScanId))) continue
    const normalized = normalizeHistoryScan(scan)
    if (normalized.glowScore == null || !Number.isFinite(Number(normalized.glowScore))) continue
    rows.push(normalized)
    seen.add(scan.id)
    if (scan.serverScanId) seen.add(scan.serverScanId)
  }
  return rows.sort((a, b) => (Date.parse(b.analyzedAt) || 0) - (Date.parse(a.analyzedAt) || 0))
}

export function getComparisonScans(currentScan, savedScans) {
  const currentIds = new Set([currentScan?.id, currentScan?.serverScanId].filter(Boolean))
  return mergeScanHistory([], savedScans, null).filter(scan =>
    !currentIds.has(scan.id) && !(scan.serverScanId && currentIds.has(scan.serverScanId)),
  )
}
