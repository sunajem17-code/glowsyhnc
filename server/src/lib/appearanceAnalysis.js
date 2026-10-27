const METRIC_PATHS = Object.freeze({
  face_score: ['face_score'],
  grooming_score: ['grooming_score'],
  pillar_harmony: ['pillars', 'harmony'],
  pillar_angularity: ['pillars', 'angularity'],
  pillar_features: ['pillars', 'features'],
  pillar_dimorphism: ['pillars', 'dimorphism'],
  sub_symmetry: ['sub_scores', 'symmetry'],
  sub_jawline_definition: ['sub_scores', 'jawline_definition'],
  sub_skin_clarity: ['sub_scores', 'skin_clarity'],
  sub_facial_proportions: ['sub_scores', 'facial_proportions'],
  sub_eye_area: ['sub_scores', 'eye_area'],
  sub_facial_harmony: ['sub_scores', 'facial_harmony'],
  metric_jawline: ['face_metrics', 'jawline', 'score'],
  metric_cheekbones: ['face_metrics', 'cheekbones', 'score'],
  metric_symmetry: ['face_metrics', 'symmetry', 'score'],
  metric_skin_quality: ['face_metrics', 'skin_quality', 'score'],
  metric_masculinity_femininity: ['face_metrics', 'masculinity_femininity', 'score'],
  metric_facial_thirds: ['face_metrics', 'facial_thirds', 'score'],
})

const DISCOURAGED_ADVICE = /\b(?:ugly|unattractive|below average|mediocre|poor skin|weak jawline|bad under-eye|lacks attractiveness|serious improvement)\b|\b(?:guarantee(?:d)?|overnight transformation|will definitely|mewing|face yoga|reshape (?:your )?(?:jaw|bone structure))\b/i
const GENERIC_RECOMMENDATION = /^(?:improve your lifestyle|work on your appearance|maintain good habits|optimize facial harmony|consider improving your skin|focus on your weak areas|keep this in mind|make healthy choices)[.! ]*$/i
const ACTION_START = /^(?:apply|use|choose|try|start|keep|maintain|avoid|introduce|explore|style|trim|adjust|take|cleanse|moisturize|wear|compare|follow|seek|ask|book|consider|build|practice|track|set|switch|reduce|include|wash|protect|keep|schedule)\b/i
const PHOTO_PROCESS_ADVICE = /\b(?:future photos?|next time|straight[- ]on (?:photos?|lighting)|even lighting|neutral expression|photo angle|same angle|photo comparison|compare photos|take (?:a|better|another) photo)\b/i
const VAGUE_FINDING_COPY = /\bunobstructed\b|\bworkable\b|\b(?:reasonably|fairly|moderately)\s+(?:clear|defined|balanced|proportionate|cohesive)\b|\bfeatures?\s+(?:read|look|appear)s?\s+as\s+(?:reasonably|fairly|moderately)\b|\b(?:limited angularity|angularity is limited|mandibular region|periorbital appearance|dermal surface|visual freshness)\b|\b(?:lower face|lower-face)\s+(?:is\s+)?(?:partially\s+)?compressed\s+by\s+(?:posture|pose)\b|\bexpression\s+softens?\s+(?:the\s+)?definition\b|\bjawline definition\s+(?:is\s+)?not strongly separated from the neck\b|\b(?:pose|posture|expression|camera angle)\s+(?:makes|makes the|softens|reduces)\s+(?:the\s+)?(?:jawline|lower[- ]face|facial)?\s*definition\b/i
const COMPLEX_APPEARANCE_LANGUAGE = /\b(?:angularity|mandibular|periorbital|dermal|malar|bizygomatic|submental|interocular|canthal|gonial|ramus|maxilla|facial thirds|facial width[- ]to[- ]height ratio)\b/i
const TEMPORARY_PRESENTATION_FINDING = /\b(?:posture|pose|expression|camera angle|lighting)\b/i
const GENERIC_ACTION = /^(?:try a different style|improve definition|work on your jawline|use a good product|take better care|make healthy choices)[.! ]*$/i
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

function findingCategory(finding) {
  if (typeof finding?.category === 'string' && finding.category) return finding.category
  const titleText = String(finding?.title || '')
  const fromTitle = FEATURE_RULES.find(([, pattern]) => pattern.test(titleText))?.[0]
  if (fromTitle) return fromTitle
  const keys = finding?.metricKeys || finding?.metric_keys || []
  const metricKey = keys.find(key => typeof key === 'string') || ''
  const fromMetric = /symmetry/i.test(metricKey) ? 'symmetry'
    : /skin/i.test(metricKey) ? 'skin-texture'
      : /jaw|mandible/i.test(metricKey) ? 'jawline'
        : /cheekbone/i.test(metricKey) ? 'cheekbones'
          : /eye/i.test(metricKey) ? 'eye-area'
            : /proportion|facial_thirds/i.test(metricKey) ? 'facial-proportions' : ''
  if (fromMetric) return fromMetric
  const observation = String(finding?.observation || '')
  return FEATURE_RULES.find(([, pattern]) => pattern.test(observation))?.[0] || 'other'
}

function semanticDeduplicate(rows = []) {
  const usable = rows.filter(row => row && (typeof row.title === 'string' && row.title.trim() || typeof row.observation === 'string' && row.observation.trim()))
  const specific = new Set(usable.map(findingCategory).filter(category => !BROAD_FEATURES.has(category) && category !== 'other'))
  const winners = new Map()
  const qualityRank = row => {
    const title = String(row.title || '')
    const refs = Array.isArray(row.scoreReferences) ? row.scoreReferences.length : 0
    const keys = Array.isArray(row.metricKeys || row.metric_keys) ? (row.metricKeys || row.metric_keys).length : 0
    const basedOn = Array.isArray(row.basedOn) ? row.basedOn.length : 0
    const vague = /\b(?:workable|reasonably|fairly|moderately|unobstructed|reads as|looks as)\b/i.test(title) ? 2 : 0
    return refs * 3 + keys * 2 + Math.min(basedOn, 2) + (title.trim().split(/\s+/).length > 1 ? 1 : 0) - vague
  }
  usable.forEach((row, index) => {
    const category = findingCategory(row)
    if (category === 'facial-balance' && ['symmetry', 'facial-proportions', 'facial-thirds', 'midface'].some(item => specific.has(item))) return
    if (category === 'facial-proportions' && ['facial-thirds', 'midface', 'eye-spacing'].some(item => specific.has(item))) return
    const title = String(row.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const key = category === 'other' ? title : category
    if (!key) return
    const prior = winners.get(key)
    if (!prior || qualityRank(row) > qualityRank(prior.row)) winners.set(key, { row, index })
  })
  return [...winners.values()].sort((a, b) => a.index - b.index).map(value => value.row)
}

function stableFindingId(finding) {
  const title = String(finding.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return `appearance-${findingCategory(finding)}-${title || 'finding'}`
}

function decorateFinding(finding) {
  const decorated = {
    ...finding,
    title: sanitizeVisibleText(finding?.title),
    observation: sanitizeVisibleText(finding?.observation),
    significance: sanitizeVisibleText(finding?.significance),
    recommendation: sanitizeVisibleText(finding?.recommendation),
  }
  if (PHOTO_PROCESS_ADVICE.test(decorated.recommendation)) decorated.recommendation = ''
  decorated.category = findingCategory(decorated)
  decorated.id = stableFindingId(decorated)
  return decorated
}

function sanitizeVisibleText(value) {
  return typeof value === 'string' ? value
    .replace(/\b(?:in\s+)?photo\s*:\s*(?:front|profile|side)\b\s*,?\s*/gi, '')
    .replace(/\b(?:photo|image)\s*:\s*(?:front|profile|side)\b/gi, '')
    .replace(/\s+/g, ' ').trim() : ''
}

function isVagueAppearanceFinding(finding) {
  const text = [finding?.title, finding?.observation, finding?.significance, finding?.recommendation].filter(Boolean).join(' ')
  return VAGUE_FINDING_COPY.test(text) || COMPLEX_APPEARANCE_LANGUAGE.test(text) ||
    (TEMPORARY_PRESENTATION_FINDING.test(text) && /\b(?:flaw|weakness|problem|compressed|softens? definition|reduces? definition)\b/i.test(text))
}

function filterVagueAppearanceText(rows) {
  return Array.isArray(rows) ? rows.filter(value => typeof value !== 'string' || !isVagueAppearanceFinding({ title: value })) : []
}

function validateAdviceQuality(strengths = [], improvements = []) {
  const all = [...strengths, ...improvements]
  for (const finding of all) {
    const content = [finding.title, finding.observation, finding.significance, finding.recommendation].filter(Boolean).join(' ')
    if (DISCOURAGED_ADVICE.test(content)) throw new TypeError('Appearance advice contains discouraging or unrealistic language')
    if (isVagueAppearanceFinding(finding)) throw new TypeError('Appearance advice must use plain language about visible features')
    const explanation = [finding.observation, finding.significance, finding.recommendation].filter(Boolean).join(' ').trim()
    const sentenceCount = explanation.split(/[.!?]+(?:\s|$)/).filter(sentence => sentence.trim()).length
    if (sentenceCount > 3) throw new TypeError('Appearance details must be no more than three short sentences')
  }

  for (const finding of improvements) {
    const recommendation = typeof finding.recommendation === 'string' ? finding.recommendation.trim() : ''
    if (!recommendation || GENERIC_RECOMMENDATION.test(recommendation) || GENERIC_ACTION.test(recommendation) || !ACTION_START.test(recommendation)) {
      throw new TypeError('Appearance improvement must include a specific, actionable recommendation')
    }
  }

  const seenTitles = new Set()
  const seenRecommendations = new Set()
  for (const finding of all) {
    const title = finding.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (title && seenTitles.has(title)) throw new TypeError('Appearance advice repeats a finding')
    if (title) seenTitles.add(title)
    if (improvements.includes(finding)) {
      const recommendation = finding.recommendation.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (recommendation && seenRecommendations.has(recommendation)) throw new TypeError('Appearance advice repeats a recommendation')
      if (recommendation) seenRecommendations.add(recommendation)
    }
  }
  return true
}

function hasConsistentScoreDirection(analysis, evidence = []) {
  const evidenceById = new Map(evidence.map(row => [row.id, row]))
  const features = [
    [/\b(symmetr\w*|balanced eyes|eye spacing)\b/i, /(?:symmetry|harmony|eye_area)/i],
    [/\b(jaw\w*|chin|lower face|lower-face|mandible)\b/i, /(?:jawline|mandible)/i],
    [/\b(skin|texture|blemish)\b/i, /(?:skin)/i],
    [/\b(cheekbone|cheek contour)\b/i, /(?:cheekbone)/i],
    [/\b(eye|under-eye|under eye|eyelid)\b/i, /(?:eye_area|eyearea|under_eye)/i],
    [/\b(proportion|facial thirds|midface)\b/i, /(?:proportion|facial_thirds|harmony)/i],
    [/\b(hair|grooming|presentation)\b/i, /(?:grooming)/i],
  ]
  const check = (finding, polarity) => {
    const feature = features.find(([title]) => title.test(finding.title))?.[1]
    if (!feature) return true
    const refs = finding.scoreReferences || (finding.basedOn || []).map(id => {
      const row = evidenceById.get(id)
      const key = id.replace(/^score:/, '')
      return row && { key, score: Number(row.score) }
    }).filter(Boolean)
    const relevantRefs = refs.filter(ref => feature.test(ref.key))
    if (refs.length && !relevantRefs.length) return false
    return relevantRefs.every(ref => {
      if (!Number.isFinite(Number(ref.score))) return true
      // Scores are relative context: average features are not presented as
      // strengths, and average-or-higher scores do not justify improvement claims.
      if (polarity === 'strength' && Number(ref.score) <= 6) return false
      if (polarity === 'improvement' && Number(ref.score) >= 6) return false
      return true
    })
  }
  return (analysis?.strengths || []).every(finding => check(finding, 'strength')) &&
    (analysis?.improvementOpportunities || []).every(finding => check(finding, 'improvement'))
}

function normalizeFinding(finding) {
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) return null
  const title = sanitizeVisibleText(finding.title)
  const observation = sanitizeVisibleText(finding.observation)
  if (!title || !observation) return null
  const metricKeys = finding.metric_keys ?? finding.metricKeys
  if (!Array.isArray(metricKeys) || metricKeys.length < 1 || metricKeys.length > 2 || metricKeys.some(key => !METRIC_PATHS[key])) return null
  const normalized = {
    ...finding,
    title,
    observation,
    metricKeys: [...new Set(metricKeys)],
    significance: sanitizeVisibleText(finding.significance),
    recommendation: sanitizeVisibleText(finding.recommendation),
  }
  if (PHOTO_PROCESS_ADVICE.test(normalized.recommendation)) normalized.recommendation = ''
  normalized.category = findingCategory(normalized)
  normalized.id = stableFindingId(normalized)
  return normalized
}

function bindAppearanceScoreReferences(analysis, scorerResult) {
  const bind = finding => {
    const scoreReferences = finding.metricKeys.map(key => {
      const raw = METRIC_PATHS[key].reduce((value, part) => value?.[part], scorerResult)
      const score = Number(raw)
      if (!Number.isFinite(score) || score < 1 || score > 10) {
        throw new TypeError(`Appearance finding references unavailable score: ${key}`)
      }
      return { key, score: Math.round(score * 10) / 10 }
    })
    return { ...finding, scoreReferences }
  }
  const bound = {
    ...analysis,
    strengths: analysis.strengths.map(bind),
    improvementOpportunities: analysis.improvementOpportunities.map(bind),
  }
  if (!hasConsistentScoreDirection(bound)) throw new TypeError('Appearance advice contradicts its referenced scan score')
  return bound
}

function hasValidScoreReferences(analysis) {
  const strengths = analysis?.strengths
  const improvements = analysis?.improvementOpportunities
  if (!Array.isArray(strengths) || !Array.isArray(improvements) || strengths.length > 6 || improvements.length > 6) return false
  const findings = [...strengths, ...improvements]
  return findings.every(finding => {
    const refs = finding.scoreReferences
    return Array.isArray(refs) && refs.length === finding.metricKeys?.length && refs.length > 0 && refs.every((ref, index) =>
      ref?.key === finding.metricKeys[index] && Number.isFinite(ref.score) && ref.score >= 1 && ref.score <= 10)
  })
}

function extendedMetricsForPersistence(extendedMetrics, appearanceAnalysis) {
  const merged = {
    ...(extendedMetrics && typeof extendedMetrics === 'object' && !Array.isArray(extendedMetrics) ? extendedMetrics : {}),
    ...(appearanceAnalysis && typeof appearanceAnalysis === 'object' ? { appearanceAnalysis } : {}),
  }
  return Object.keys(merged).length ? merged : null
}

function normalizeAppearanceAnalysis(input, scanId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Appearance analysis is required')
  }

  const strengths = input.strengths
  const improvements = input.improvement_opportunities ?? input.improvementOpportunities
  const positive = input.positive_observations ?? input.positiveObservations ?? []

  if (!Array.isArray(strengths) || !Array.isArray(improvements) || !Array.isArray(positive)) {
    throw new TypeError('Appearance analysis findings must be arrays')
  }

  const normalizedStrengths = strengths.map(normalizeFinding)
  const normalizedImprovements = improvements.map(normalizeFinding)
  const normalizedPositive = positive.map(normalizeFinding)

  if (normalizedStrengths.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete strength')
  }
  if (normalizedImprovements.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete improvement opportunity')
  }
  if (normalizedPositive.some(finding => !finding)) {
    throw new TypeError('Appearance analysis contains an incomplete positive observation')
  }
  if (normalizedStrengths.length > 6 || normalizedImprovements.length > 6 || normalizedPositive.length) {
    throw new TypeError('Appearance analysis exceeds supported finding limits')
  }
  // Filter only known low-information phrasing from newly generated output.
  // Existing saved results are left untouched unless a complete replacement
  // passes validation and is persisted by the owner-scoped refresh route.
  const distinctStrengths = semanticDeduplicate(normalizedStrengths.filter(finding => !isVagueAppearanceFinding(finding)))
  const distinctImprovements = semanticDeduplicate(normalizedImprovements.filter(finding => !isVagueAppearanceFinding(finding)))
  validateAdviceQuality(distinctStrengths, distinctImprovements)

  return {
    version: 15,
    scanId,
    strengths: distinctStrengths,
    improvementOpportunities: distinctImprovements,
    positiveObservations: normalizedPositive,
  }
}

module.exports = { normalizeAppearanceAnalysis, bindAppearanceScoreReferences, hasValidScoreReferences, extendedMetricsForPersistence, validateAdviceQuality, hasConsistentScoreDirection, semanticDeduplicate, findingCategory, decorateFinding, sanitizeVisibleText, isVagueAppearanceFinding, filterVagueAppearanceText, PHOTO_PROCESS_ADVICE, METRIC_PATHS }
