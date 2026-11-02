async function communityScanScores({ isPro, userId, postType, beforeScanId, afterScanId, ownedScan }) {
  if (!isPro || postType !== 'glow-up') return { before: null, after: null }
  async function score(id) {
    if (typeof id !== 'string' || !id.trim()) return null
    const owned = await ownedScan(id, userId)
    const value = owned?.result?.overallScore ?? owned?.scan?.scores?.overall
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null
  }
  const after = await score(afterScanId)
  const before = beforeScanId ? await score(beforeScanId) : after
  return { before, after }
}
module.exports = { communityScanScores }
