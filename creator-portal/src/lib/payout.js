// Renders a brief's payout_structure JSONB for display only. The actual
// cumulative-milestone calculation lives server-side in the
// admin_review_submission() Postgres function — never recomputed here.
//
// Expected shape:
//   { "milestones": { "standard": [{"min_views":30000,"amount":15}, ...],
//                      "vip":      [{"min_views":30000,"amount":15}, ...] } }
export function describeMilestones(payoutStructure, tier = 'standard') {
  const milestones = payoutStructure?.milestones?.[tier]
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return 'Payout terms not set'
  }

  let running = 0
  return milestones
    .slice()
    .sort((a, b) => a.min_views - b.min_views)
    .map((m) => {
      running += Number(m.amount)
      return `${Number(m.min_views).toLocaleString()} views → $${running}`
    })
    .join(' · ')
}

/**
 * Calculate payout from a payout_tiers.milestones value and a view count.
 * Two shapes are supported:
 *   - Milestone array: [{ min_views, cumulative_payout }, ...] — pays the
 *     highest-threshold milestone the view count has crossed.
 *   - Freeform: { freeform: true, amount } — a fixed amount regardless of
 *     views, for one-off custom deals.
 *
 * @param {Array|{freeform: true, amount: number}} milestones
 * @param {number} viewCount
 * @returns {number} payout in USD
 */
export function calcPayout(milestones, viewCount) {
  if (!milestones) return 0
  if (!Array.isArray(milestones)) {
    return milestones.freeform ? Number(milestones.amount) || 0 : 0
  }
  if (milestones.length === 0) return 0
  const sorted = [...milestones].sort((a, b) => b.min_views - a.min_views)
  const hit = sorted.find((m) => viewCount >= m.min_views)
  return hit ? hit.cumulative_payout : 0
}
