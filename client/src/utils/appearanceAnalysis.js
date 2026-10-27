const CURRENT_APPEARANCE_ANALYSIS_VERSION = 15

function hasCompleteFindings(rows) {
  return Array.isArray(rows) && rows.length <= 8 && rows.every(item =>
    item && typeof item.title === 'string' && item.title.trim() &&
    typeof item.observation === 'string' && item.observation.trim())
}

export function isCurrentAppearanceAnalysis(analysis, scanId) {
  return Boolean(analysis && Number(analysis.version) >= CURRENT_APPEARANCE_ANALYSIS_VERSION &&
    analysis.scanId === scanId && hasCompleteFindings(analysis.strengths) &&
    analysis.strengths.length > 0 && hasCompleteFindings(analysis.improvementOpportunities))
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
  } catch { /* No inline copy is available to send. */ }
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
  return rows.slice(0, 8).map(item => typeof item === 'string'
    ? { title: item.trim(), observation: '', legacy: true }
    : item && typeof item === 'object' ? item : null)
    .filter(item => item && ((typeof item.title === 'string' && item.title.trim()) || (typeof item.observation === 'string' && item.observation.trim())))
}

const PHOTO_PROCESS_ADVICE = /\b(?:future photos?|next time|straight[- ]on (?:photos?|lighting)|even lighting|neutral expression|photo angle|same angle|photo comparison|compare photos|take (?:a|better|another) photo)\b/i
const FEATURE_RULES = [
  ['under-eye', /under[- ]?eye|dark circles?/i], ['eye-spacing', /eye spacing|spacing between (?:the )?eyes|inter[- ]ocular/i],
  ['eye-area', /\b(?:eyes?|eyelids?|brows?)\b/i], ['skin-texture', /skin.{0,24}(?:texture|pores?)|(?:texture|pores?).{0,24}skin/i],
  ['skin-tone', /skin.{0,24}(?:tone|redness|blemishes?)|(?:tone|redness|blemishes?).{0,24}skin/i],
  ['jawline', /jaw(?:line)?|mandible|lower[- ]face definition/i], ['chin', /\bchin\b/i], ['cheekbones', /cheekbones?|cheek contour/i],
  ['midface', /mid[- ]face|midface/i], ['facial-thirds', /facial thirds|thirds proportions/i],
  ['symmetry', /symmetr|left[- ]right balance/i], ['hair-grooming', /hair|grooming|facial hair|beard|hairstyle/i],
  ['facial-proportions', /facial proportions|feature proportions|proportionate features/i],
  ['facial-balance', /facial balance|overall balance|cohesive features|overall facial harmony/i],
]
const BROAD_FEATURES = new Set(['facial-balance', 'facial-proportions'])

function findingCategory(item) {
  if (typeof item?.category === 'string' && item.category) return item.category
  const fromTitle = FEATURE_RULES.find(([, pattern]) => pattern.test(String(item?.title || '')))?.[0]
  if (fromTitle) return fromTitle
  const metricKeys = item?.metricKeys || item?.metric_keys || []
  const metric = metricKeys.find(key => typeof key === 'string') || ''
  const fromMetric = /symmetry/i.test(metric) ? 'symmetry'
    : /skin/i.test(metric) ? 'skin-texture'
      : /jaw|mandible/i.test(metric) ? 'jawline'
        : /cheekbone/i.test(metric) ? 'cheekbones'
          : /eye/i.test(metric) ? 'eye-area'
            : /proportion|facial_thirds/i.test(metric) ? 'facial-proportions' : ''
  if (fromMetric) return fromMetric
  return FEATURE_RULES.find(([, pattern]) => pattern.test(String(item?.observation || '')))?.[0] || 'other'
}

function semanticDeduplicate(rows) {
  // Keep valid old findings even if their wording is imperfect. Quality rules
  // guide new AI output; display-time cleanup should only remove duplicates.
  const candidates = (Array.isArray(rows) ? rows : []).filter(item => item &&
    (typeof item.title === 'string' && item.title.trim() || typeof item.observation === 'string' && item.observation.trim()))
  const specificCategories = new Set(candidates.map(findingCategory).filter(category => !BROAD_FEATURES.has(category) && category !== 'other'))
  const winners = new Map()
  const qualityRank = item => {
    const title = String(item.title || '')
    const refs = Array.isArray(item.scoreReferences) ? item.scoreReferences.length : 0
    const keys = Array.isArray(item.metricKeys || item.metric_keys) ? (item.metricKeys || item.metric_keys).length : 0
    const basedOn = Array.isArray(item.basedOn) ? item.basedOn.length : 0
    const vague = /\b(?:workable|reasonably|fairly|moderately|unobstructed|reads as|looks as)\b/i.test(title) ? 2 : 0
    return refs * 3 + keys * 2 + Math.min(basedOn, 2) + (title.trim().split(/\s+/).length > 1 ? 1 : 0) - vague
  }
  candidates.forEach((item, index) => {
    const category = findingCategory(item)
    if (category === 'facial-balance' && ['symmetry', 'facial-proportions', 'facial-thirds', 'midface'].some(item => specificCategories.has(item))) return
    if (category === 'facial-proportions' && ['facial-thirds', 'midface', 'eye-spacing'].some(item => specificCategories.has(item))) return
    const title = String(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const key = category === 'other' ? title : category
    if (!key) return
    const prior = winners.get(key)
    if (!prior || qualityRank(item) > qualityRank(prior.item)) winners.set(key, { item, index })
  })
  return [...winners.values()].sort((a, b) => a.index - b.index).map(row => row.item).slice(0, 8)
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
  // Structured findings are the primary analysis. Legacy score bullets are a
  // fallback only when the corresponding structured list is absent.
  const legacyPros = displayFindings(scan?.aiScore?.keyStrengths || scan?.keyStrengths)
  const legacyCons = displayFindings(scan?.aiScore?.keyWeaknesses || scan?.keyWeaknesses)
  const structuredPros = semanticDeduplicate(cachedPros)
  const structuredCons = semanticDeduplicate(cachedCons)
  const pros = structuredPros.length ? structuredPros : semanticDeduplicate(legacyPros)
  const cons = structuredCons.length ? structuredCons : semanticDeduplicate(legacyCons)
  if (!pros.length && !cons.length) return null
  return {
    ...(cached || {}),
    scanId: cached?.scanId || scanId,
    strengths: pros,
    improvementOpportunities: cons,
    positiveObservations: displayFindings(cached?.positiveObservations),
  }
}

export { semanticDeduplicate, findingCategory, PHOTO_PROCESS_ADVICE }
