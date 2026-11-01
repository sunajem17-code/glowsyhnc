async function persistCompletedScan(sb, { id, userId, result, completedAt, clean }) {
  if (!sb) return
  const record = {
    id, user_id: userId, created_at: completedAt,
    overall_score: result.overallScore, face_score: result.faceScore,
    grooming_score: result.groomingScore, tier: result.tier,
    harmony: result.pillars?.harmony ?? null, angularity: result.pillars?.angularity ?? null,
    features: result.pillars?.features ?? null, dimorphism: result.pillars?.dimorphism ?? null,
    extended_metrics: { ...result.extendedMetrics, serverAnalysis: { kind: 'server_analysis_v1', status: 'completed', result: clean(result) } },
  }
  let saved = await sb.from('scans').upsert(record).select('id').single()
  if (saved.error && /extended_metrics.*schema cache/i.test(saved.error.message || '')) {
    const compatible = { ...record }; delete compatible.extended_metrics
    saved = await sb.from('scans').upsert(compatible).select('id').single()
  }
  if (saved.error || saved.data?.id !== id) throw new Error('Could not save your scan for AI Coach. Please retry.')
}
module.exports = { persistCompletedScan }
