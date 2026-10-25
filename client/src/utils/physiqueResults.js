const METRIC_ALIASES = {
  overall: ['overall', 'overallPhysique'],
  potential: ['potential', 'physiquePotential', 'potentialScore'],
  muscle_mass: ['muscle_mass', 'muscleMass', 'muscleDevelopment'],
  body_fat_score: ['body_fat_score', 'bodyFatScore', 'bodyFatEstimate'],
  v_taper: ['v_taper', 'vTaper', 'shoulderToWaist'],
  frame_width: ['frame_width', 'frameWidth', 'frame'],
}

export function getPhysiqueMetricScore(scan, key) {
  const aliases = METRIC_ALIASES[key] ?? [key]
  const sources = [scan?.physiqueScore, scan?.aiScore?.physiqueScore, scan?.aiScore?.physiqueResult, scan?.aiScore, scan]
  for (const source of sources) {
    for (const alias of aliases) {
      const raw = source?.[alias]
      const value = Number(raw && typeof raw === 'object' ? raw.score : raw)
      if (raw != null && Number.isFinite(value) && value >= 0 && value <= 10) return value
    }
  }
  return null
}
