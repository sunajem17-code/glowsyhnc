// The primary scoring response embeds complete, scan-linked structured
// findings starting at version 7. Accept those directly so fresh scans do not
// make a second request (which can fail while the saved photo is uploading).
const CURRENT_APPEARANCE_ANALYSIS_VERSION = 7

function hasCompleteFindings(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every(item =>
    item && typeof item.title === 'string' && item.title.trim() &&
    typeof item.observation === 'string' && item.observation.trim() &&
    typeof item.significance === 'string' && item.significance.trim() &&
    typeof item.recommendation === 'string' && item.recommendation.trim())
}

export function isCurrentAppearanceAnalysis(analysis, scanId) {
  return Boolean(analysis && Number(analysis.version) >= CURRENT_APPEARANCE_ANALYSIS_VERSION &&
    analysis.scanId === scanId && hasCompleteFindings(analysis.strengths) &&
    hasCompleteFindings(analysis.improvementOpportunities))
}

// Results should never mix old score summaries with current, scan-specific
// advice. Older findings can be refreshed, but remain hidden until a complete
// analysis for this exact scan is available.
export function getCurrentAppearanceAnalysis(scan, scanId) {
  const candidate = [scan?.aiScore?.appearanceAnalysis, scan?.appearanceAnalysis]
    .find(item => isCurrentAppearanceAnalysis(item, scanId))
  if (!candidate) return null
  // Keep the validated, scan-matched analysis selected above through the
  // display adapter too; an older nested copy must not replace it there.
  return getDisplayableAppearanceAnalysis({
    ...scan,
    appearanceAnalysis: candidate,
    aiScore: { ...(scan?.aiScore || {}), appearanceAnalysis: candidate },
  }, scanId)
}

// Older device-only scans may have no server scan ID. Send only their original
// inline image so the authenticated server can refresh the analysis without
// guessing a photo URL or granting access to another user's stored scan.
export async function prepareAppearancePhoto(scan, maxBytes = 1024 * 1024) {
  const photo = scan?.facePhotoUrl || scan?.face_photo_url
  if (typeof photo !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/i.test(photo)) return null
  const payload = photo.slice(photo.indexOf(',') + 1)
  if (Math.floor(payload.length * 3 / 4) <= maxBytes) return photo
  if (typeof Image === 'undefined' || typeof document === 'undefined') return null

  try {
    const image = new Image()
    image.src = photo
    await image.decode()
    const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      const resized = canvas.toDataURL('image/jpeg', quality)
      const resizedPayload = resized.slice(resized.indexOf(',') + 1)
      if (Math.floor(resizedPayload.length * 3 / 4) <= maxBytes) return resized
    }
  } catch { /* The server returns the normal unavailable-photo response. */ }
  return null
}

export function appearanceScoresForScan(scan) {
  const source = scan?.aiScore || scan || {}
  const validScores = values => Object.fromEntries(Object.entries(values || {}).filter(([, value]) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 10))
  return {
    faceSubScores: validScores(source.faceSubScores),
    pillars: validScores(source.pillars),
  }
}

function cleanFindingCopy(value) {
  if (typeof value !== 'string') return value
  const cleaned = value
    .replace(/^\s*(?:in\s+)?photo:(?:front|side)\s*[,.:—-]?\s*/i, '')
    .replace(/\bphoto:(?:front|side)\b/gi, 'the scan')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned
}

function displayFindings(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map(item => typeof item === 'string'
    ? { title: cleanFindingCopy(item), observation: '', legacy: true }
    : item && typeof item === 'object'
      ? { ...item, title: cleanFindingCopy(item.title), observation: cleanFindingCopy(item.observation), significance: cleanFindingCopy(item.significance), recommendation: cleanFindingCopy(item.recommendation) }
      : null)
    .filter(item => item && ((typeof item.title === 'string' && item.title.trim()) || (typeof item.observation === 'string' && item.observation.trim())))
}

function mergeUnique(...groups) {
  const seen = new Set()
  return groups.flat().filter(item => {
    const catalogId = typeof item?.catalogId === 'string' ? item.catalogId : typeof item?.catalog_id === 'string' ? item.catalog_id : ''
    const title = typeof item?.title === 'string' ? item.title.trim() : ''
    const observation = typeof item?.observation === 'string' ? item.observation.trim() : ''
    const key = catalogId || `${title.toLowerCase()}|${observation.toLowerCase()}`
    if (!key.replace('|', '') || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const clearNegativeCues = [
  /\bnot\s+(?:especially|particularly|very|fully|strongly)\b/i,
  /\bdoes\s+not\s+(?:look|appear|read|show)\b|\bdoesn't\s+(?:look|appear|read|show)\b/i,
  /\bless(?:\s+\w+){0,2}\s+(?:defined|sharp|clear|prominent|balanced|open|visible)\b/i,
  /\b(?:weak|below average|lacks?|insufficient)\b/i,
  /\bnot\s+(?:the|a)\s+(?:dominant|strong|clear|defined)\b/i,
  /\bif\s+you\s+want\s+(?:a\s+)?(?:crisper|sharper|clearer|stronger|more defined)\b/i,
]

function isClearlyNegative(item) {
  const copy = [item?.title, item?.observation, item?.significance, item?.recommendation]
    .filter(value => typeof value === 'string')
    .join(' ')
  return clearNegativeCues.some(pattern => pattern.test(copy))
}

const findingTopics = [
  ['lower-face', /\b(?:jaw|jawline|chin|mandible|lower[-\s]?face)\b/i],
  ['eye-area', /\b(?:eyes?|brows?|under[-\s]?eyes?)\b/i],
  ['cheeks', /\b(?:cheeks?|cheekbones?|midface)\b/i],
  ['skin', /\b(?:skin|acne|redness|skin texture)\b/i],
  ['hair', /\b(?:hair|hairline|hairstyle|grooming)\b/i],
  ['symmetry', /\b(?:symmetry|asymmetry|left[-\s]?right|alignment)\b/i],
  ['nose', /\bnose\b/i],
]

function coversSameTopic(first, second) {
  const firstCopy = [first?.title, first?.observation, first?.significance]
    .filter(value => typeof value === 'string').join(' ')
  const secondCopy = [second?.title, second?.observation, second?.significance]
    .filter(value => typeof value === 'string').join(' ')
  return findingTopics.some(([, pattern]) => pattern.test(firstCopy) && pattern.test(secondCopy))
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
  // Structured findings are the complete Pros/Cons source. Appending the old
  // score summaries mixes short legacy bullets into detailed findings and can
  // reintroduce stale or contradictory wording.
  const hasStructuredAnalysis = Boolean(cached && (
    Array.isArray(cached.strengths) || Array.isArray(cached.improvementOpportunities)
  ))
  const rawPros = hasStructuredAnalysis
    ? mergeUnique(cachedPros)
    : mergeUnique(displayFindings(scan?.aiScore?.keyStrengths || scan?.keyStrengths))
  const rawCons = hasStructuredAnalysis
    ? mergeUnique(cachedCons)
    : mergeUnique(displayFindings(scan?.aiScore?.keyWeaknesses || scan?.keyWeaknesses))
  // Models occasionally put an explicitly qualified drawback in strengths.
  // Correct only clear textual contradictions; leave neutral findings alone.
  const miscategorizedCons = rawPros.filter(isClearlyNegative)
  const pros = rawPros.filter(item => !isClearlyNegative(item))
  const nonDuplicateMisclassified = miscategorizedCons.filter(item =>
    !rawCons.some(existing => coversSameTopic(existing, item)))
  const cons = mergeUnique(rawCons, nonDuplicateMisclassified)
  if (!pros.length && !cons.length) return null
  return {
    ...(cached || {}),
    scanId: cached?.scanId || scanId,
    strengths: pros,
    improvementOpportunities: cons,
    positiveObservations: displayFindings(cached?.positiveObservations),
  }
}
