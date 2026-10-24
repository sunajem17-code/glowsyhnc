const SCORE_FIELDS = [
  'proportions', 'leanness', 'frame', 'posture', 'overall_presentation',
  'potential', 'muscle_mass', 'body_fat_score', 'v_taper', 'frame_width',
]

function normalizePhysiqueScores(parsed) {
  const scores = {}
  for (const field of SCORE_FIELDS) {
    const value = parsed?.[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Physique scorer returned an invalid ${field} score`)
    }
    scores[field] = Math.round(Math.min(Math.max(value, 1), 10) * 10) / 10
  }

  const overall = Math.round((
    scores.proportions + scores.leanness + scores.frame + scores.posture + scores.overall_presentation
  ) / 5 * 10) / 10
  scores.potential = Math.max(overall, scores.potential)

  return {
    ...scores,
    overall,
    body_fat_level: parsed.body_fat_level ?? 'average',
    physique_strengths: Array.isArray(parsed.physique_strengths) ? parsed.physique_strengths : [],
    physique_improvements: Array.isArray(parsed.physique_improvements) ? parsed.physique_improvements : [],
    physique_notes: parsed.physique_notes ?? null,
  }
}

module.exports = { normalizePhysiqueScores }
