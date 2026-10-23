import { getRatingColor } from './revealRatings.js'

function parseField(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback
  try { return JSON.parse(value) ?? fallback } catch { return fallback }
}

export function getHistoryScoreColor(value) {
  if (value == null || !Number.isFinite(Number(value))) return 'rgba(255,255,255,0.4)'
  return getRatingColor(Number(value))
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

export function resolveComparisonScan(candidates, selectedScanId) {
  return candidates.find(scan => scan.id === selectedScanId) || null
}

export function getComparisonSliderPosition(clientX, frameLeft, frameWidth) {
  if (!Number.isFinite(frameWidth) || frameWidth <= 0) return 50
  return Math.min(100, Math.max(0, ((clientX - frameLeft) / frameWidth) * 100))
}
