const CURRENT_APPEARANCE_ANALYSIS_VERSION = 13

function hasCompleteFindings(rows) {
  return Array.isArray(rows) && rows.length <= 6 && rows.every(item =>
    item && typeof item.title === 'string' && item.title.trim() &&
    typeof item.observation === 'string' && item.observation.trim())
}

export function isCurrentAppearanceAnalysis(analysis, scanId) {
  return Boolean(analysis && Number(analysis.version) >= CURRENT_APPEARANCE_ANALYSIS_VERSION &&
    analysis.scanId === scanId && ['clear', 'limited', 'retake'].includes(analysis.photoQuality?.status) && hasCompleteFindings(analysis.strengths) &&
    hasCompleteFindings(analysis.improvementOpportunities))
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

function displayFindings(rows) {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, 6).map(item => typeof item === 'string'
    ? { title: item.trim(), observation: '', legacy: true }
    : item && typeof item === 'object' ? item : null)
    .filter(item => item && ((typeof item.title === 'string' && item.title.trim()) || (typeof item.observation === 'string' && item.observation.trim())))
}

// Older structured notes may be shown explicitly as previous notes. Raw score
// bullets are not a substitute for a completed, photo-grounded action plan.
export function getDisplayableAppearanceAnalysis(scan, scanId) {
  const candidate = scan?.aiScore?.appearanceAnalysis || scan?.appearanceAnalysis
  const linked = candidate && (!candidate.scanId || candidate.scanId === scanId)
  const cached = linked ? candidate : null
  if (isCurrentAppearanceAnalysis(cached, scanId)) return cached
  const cachedPros = displayFindings(cached?.strengths)
  const cachedCons = displayFindings(cached?.improvementOpportunities)
  const pros = cachedPros
  const cons = cachedCons
  if (!pros.length && !cons.length) return null
  return {
    ...(cached || {}),
    scanId: cached?.scanId || scanId,
    strengths: pros,
    improvementOpportunities: cons,
    positiveObservations: displayFindings(cached?.positiveObservations),
  }
}
