import { HAIRSTYLE_CATALOG } from './hairCatalog.js'

const findMetric = (evidence, id) => evidence?.measurements?.find(metric => metric.id === id && metric.assessable)?.value ?? null

export function structureFromScan(scan) {
  const evidence = scan?.analysisEvidence ?? scan?.aiScore?.analysisEvidence ?? null
  const widthHeight = findMetric(evidence, 'face_width_to_height_ratio')
  const jawCheek = findMetric(evidence, 'jaw_to_cheek_width_ratio')
  const upperThird = findMetric(evidence, 'upper_visible_third_ratio')
  const chinLower = findMetric(evidence, 'chin_to_lower_face_ratio')

  const descriptors = []
  // Styling heuristics only. These bands select visual effects; they are not
  // attractiveness scores, medical norms or face-shape diagnoses.
  if (widthHeight != null) descriptors.push(widthHeight < 0.68 ? 'Longer facial proportions' : widthHeight > 0.82 ? 'Wider facial proportions' : 'Balanced width and height')
  if (jawCheek != null) descriptors.push(jawCheek < 0.72 ? 'Pronounced jaw taper' : jawCheek > 0.88 ? 'Broad jaw relationship' : 'Moderate jaw taper')
  if (upperThird != null) descriptors.push(upperThird > 0.27 ? 'More visible upper third' : 'Moderate upper third')
  if (chinLower != null && descriptors.length < 3) descriptors.push(chinLower > 0.45 ? 'Longer visible chin proportion' : 'Compact visible chin proportion')

  return {
    scanId: scan?.id ?? null,
    connected: evidence?.status === 'measured',
    evidence,
    measurements: { widthHeight, jawCheek, upperThird, chinLower },
    descriptors: descriptors.slice(0, 3),
    limitations: ['Styling match uses photographic ratios for visual balance only', 'No face-shape diagnosis or attractiveness claim is made'],
  }
}

function effectScore(style, structure, reasons) {
  const { widthHeight, jawCheek, upperThird } = structure.measurements
  let score = 0
  if (widthHeight != null && widthHeight < 0.68) {
    if (style.visualEffects.topHeight === 'low' || style.visualEffects.topHeight === 'none') { score += 12; reasons.push('avoids adding extra visual height') }
    if (style.visualEffects.sideWidth === 'medium' || style.visualEffects.sideWidth === 'high') { score += 8; reasons.push('adds balanced width around the face') }
    if (style.visualEffects.topHeight === 'high') score -= 16
  } else if (widthHeight != null && widthHeight > 0.82) {
    if (style.visualEffects.topHeight === 'medium' || style.visualEffects.topHeight === 'high') { score += 12; reasons.push('adds controlled vertical emphasis') }
    if (style.visualEffects.sideWidth === 'high') score -= 10
  } else if (widthHeight != null) {
    score += 6
    reasons.push('keeps balanced facial proportions')
  }
  if (jawCheek != null && jawCheek < 0.72 && style.visualEffects.sideWidth !== 'low') { score += 5; reasons.push('balances the jaw-to-cheek relationship') }
  if (jawCheek != null && jawCheek > 0.88 && style.visualEffects.jawEmphasis === 'low') { score += 5; reasons.push('softens emphasis around a broader jaw') }
  if (upperThird != null && upperThird > 0.27 && style.visualEffects.foreheadExposure === 'low') { score += 9; reasons.push('reduces visible forehead exposure') }
  return score
}

export function rankHairstyles(profile, structure, limit = 8) {
  const candidates = HAIRSTYLE_CATALOG.filter(style => {
    if (!style.compatibleHairTypes.includes(profile.hairType)) return false
    if (!style.compatibleDensity.includes(profile.density)) return false
    if (!style.compatibleThickness.includes(profile.strandThickness)) return false
    if (profile.desiredLength !== 'any' && style.length !== profile.desiredLength) return false
    if (profile.maintenancePreference === 'low' && style.maintenance !== 'low') return false
    return true
  })

  const fallback = candidates.length >= 3 ? candidates : HAIRSTYLE_CATALOG.filter(style =>
    style.compatibleHairTypes.includes(profile.hairType) && style.compatibleDensity.includes(profile.density) && style.compatibleThickness.includes(profile.strandThickness)
  )

  return fallback.map(style => {
    const reasons = []
    let score = 55
    score += effectScore(style, structure, reasons)
    if (style.compatibleHairTypes.includes(profile.hairType)) { score += 14; reasons.push(`works with ${profile.hairType} hair`) }
    if (style.compatibleDensity.includes(profile.density)) { score += 10; reasons.push(`fits ${profile.density} density`) }
    if (style.compatibleThickness.includes(profile.strandThickness)) { score += 6; reasons.push(`works with ${profile.strandThickness} strands`) }
    if (profile.desiredLength === 'any' || style.length === profile.desiredLength) score += 5
    if (profile.maintenancePreference === 'any' || profile.maintenancePreference === 'some' || style.maintenance === 'low') score += 4
    return {
      hairstyleId: style.id,
      style,
      compatibility: Math.min(99, score),
      reasons: [...new Set(reasons)].slice(0, 3),
      limitations: structure.connected ? structure.limitations : ['No reliable face geometry was available; ranking uses hair feasibility and preferences'],
      previewStatus: 'idle', previewUrl: null,
    }
  }).sort((a, b) => b.compatibility - a.compatibility).slice(0, limit).map((item, index) => ({ ...item, rank: index + 1 }))
}

export function conciseReason(recommendation) {
  const reasons = recommendation?.reasons ?? []
  if (!reasons.length) return 'Works with your selected hair and styling preferences.'
  const sentence = reasons.slice(0, 2).join(' and ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}
