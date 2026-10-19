// Keep device-saved ratings visible even when the background cloud save failed.
// Values here are copied from the existing server result, never re-scored.
export function mergeProgressHistory(remoteScans, localScans, currentScan) {
  const rows = [...remoteScans]
  for (const local of localScans) {
    if (!local.progressSavedAt) continue
    const scan = currentScan?.id === local.id ? currentScan : local
    const overall = scan.aiScore?.overallScore ?? scan.glowScore
    if (!Number.isFinite(overall)) continue
    const date = scan.scanDate ?? scan.analyzedAt
    const match = rows.find(row => row.id === scan.id || row.id === scan.serverScanId || (
      Number(row.overall_score) === overall && Math.abs(Date.parse(row.created_at) - Date.parse(date)) < 60000
    ))
    if (match) continue
    rows.push({
      id: scan.id,
      created_at: date,
      overall_score: overall,
      potential_score: scan.aiScore?.potentialScore ?? scan.potentialScore,
      face_score: scan.aiScore?.faceScore,
      grooming_score: scan.aiScore?.groomingScore,
      face_image_url: scan.facePhotoUrl || null,
      tier: scan.tier,
    })
  }
  return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
