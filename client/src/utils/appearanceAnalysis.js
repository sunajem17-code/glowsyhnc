const CURRENT_APPEARANCE_ANALYSIS_VERSION = 11

function hasCompleteFindings(rows) {
  return Array.isArray(rows) && rows.length <= 6 && rows.every(item =>
    item && typeof item.title === 'string' && item.title.trim() &&
    typeof item.observation === 'string' && item.observation.trim())
}

export function isCurrentAppearanceAnalysis(analysis, scanId) {
  return Boolean(analysis && Number(analysis.version) >= CURRENT_APPEARANCE_ANALYSIS_VERSION &&
    analysis.scanId === scanId && hasCompleteFindings(analysis.strengths) &&
    hasCompleteFindings(analysis.improvementOpportunities))
}

function displayFindings(rows) {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, 6).map(item => typeof item === 'string'
    ? { title: item.trim(), observation: '', legacy: true }
    : item && typeof item === 'object' ? item : null)
    .filter(item => item && ((typeof item.title === 'string' && item.title.trim()) || (typeof item.observation === 'string' && item.observation.trim())))
}

function mergeUnique(...groups) {
  const seen = new Set()
  return groups.flat().filter(item => {
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const observation = typeof item?.observation === 'string' ? item.observation.trim() : ''
    const key = `${title.toLowerCase()}|${observation.toLowerCase()}`
    if (!key.replace('|', '') || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 6)
}

// Keep scan-local findings visible even when they're too old to be current.
// The saved score bullets are useful fallback titles and remain attached to
// the same owned scan; they are never treated as fresh AI analysis.
export function getDisplayableAppearanceAnalysis(scan, scanId) {
  const candidate = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
  const linked = candidate && (!candidate.scanId || candidate.scanId === scanId)
  const cached = linked ? candidate : null
  const cachedPros = displayFindings(cached?.strengths)
  const cachedCons = displayFindings(cached?.improvementOpportunities)
  const pros = mergeUnique(cachedPros, displayFindings(scan?.aiScore?.keyStrengths || scan?.keyStrengths))
  const cons = mergeUnique(cachedCons, displayFindings(scan?.aiScore?.keyWeaknesses || scan?.keyWeaknesses))
  if (!pros.length && !cons.length) return null
  return {
    ...(cached || {}),
    scanId: cached?.scanId || scanId,
    strengths: pros,
    improvementOpportunities: cons,
    positiveObservations: displayFindings(cached?.positiveObservations),
  }
}
