const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { verifyToken, claudeLimit } = require('../middleware/claudeGate')
const { withRetry } = require('../utils/withRetry')

const router = express.Router()

const HAIR_CATALOG = [
  ['textured_crop', ['straight','wavy'], ['low','medium','high'], ['fine','medium','thick'], 'short', 'low', { topHeight:'low', foreheadExposure:'low', sideWidth:'low' }],
  ['french_crop', ['straight','wavy'], ['low','medium','high'], ['fine','medium','thick'], 'short', 'low', { topHeight:'low', foreheadExposure:'low', sideWidth:'low' }],
  ['caesar', ['straight','wavy','curly'], ['low','medium','high'], ['fine','medium','thick'], 'short', 'low', { topHeight:'low', foreheadExposure:'low', sideWidth:'medium' }],
  ['crew_cut', ['straight','wavy'], ['medium','high'], ['medium','thick'], 'short', 'low', { topHeight:'medium', foreheadExposure:'high', sideWidth:'low' }],
  ['buzz_cut', ['straight','wavy','curly','coily'], ['low','medium','high'], ['fine','medium','thick'], 'short', 'low', { topHeight:'none', foreheadExposure:'high', sideWidth:'low' }],
  ['low_taper_fringe', ['straight','wavy','curly','coily'], ['low','medium','high'], ['fine','medium','thick'], 'medium', 'medium', { topHeight:'low', foreheadExposure:'low', sideWidth:'medium' }],
  ['mid_taper_texture', ['straight','wavy','curly'], ['medium','high'], ['medium','thick'], 'medium', 'medium', { topHeight:'medium', foreheadExposure:'medium', sideWidth:'low' }],
  ['curly_taper', ['curly','coily'], ['medium','high'], ['fine','medium','thick'], 'medium', 'low', { topHeight:'medium', foreheadExposure:'medium', sideWidth:'medium' }],
  ['curly_fringe', ['curly','coily'], ['medium','high'], ['medium','thick'], 'medium', 'medium', { topHeight:'low', foreheadExposure:'low', sideWidth:'medium' }],
  ['curtains', ['straight','wavy'], ['medium','high'], ['fine','medium','thick'], 'medium', 'medium', { topHeight:'low', foreheadExposure:'medium', sideWidth:'high' }],
  ['side_part', ['straight','wavy'], ['low','medium','high'], ['fine','medium','thick'], 'medium', 'medium', { topHeight:'medium', foreheadExposure:'medium', sideWidth:'medium' }],
  ['messy_fringe', ['straight','wavy','curly'], ['low','medium','high'], ['fine','medium','thick'], 'medium', 'low', { topHeight:'low', foreheadExposure:'low', sideWidth:'medium' }],
  ['slick_back', ['straight','wavy'], ['medium','high'], ['medium','thick'], 'long', 'high', { topHeight:'medium', foreheadExposure:'high', sideWidth:'low' }],
  ['quiff', ['straight','wavy'], ['medium','high'], ['medium','thick'], 'medium', 'high', { topHeight:'high', foreheadExposure:'high', sideWidth:'low' }],
  ['pompadour', ['straight','wavy'], ['medium','high'], ['medium','thick'], 'long', 'high', { topHeight:'high', foreheadExposure:'high', sideWidth:'medium' }],
  ['modern_mullet', ['straight','wavy','curly'], ['medium','high'], ['medium','thick'], 'long', 'medium', { topHeight:'medium', foreheadExposure:'medium', sideWidth:'low' }],
  ['flow', ['straight','wavy','curly'], ['medium','high'], ['medium','thick'], 'long', 'medium', { topHeight:'low', foreheadExposure:'medium', sideWidth:'high' }],
].map(([id, hairTypes, densities, thicknesses, length, maintenance, visualEffects]) => ({ id, hairTypes, densities, thicknesses, length, maintenance, visualEffects }))

function sanitizeHairProfile(input) {
  const allowed = (value, values, fallback = null) => values.includes(value) ? value : fallback
  return {
    scanId: typeof input?.scanId === 'string' ? input.scanId.slice(0, 80) : null,
    hairType: allowed(input?.hairType, ['straight','wavy','curly','coily']),
    density: allowed(input?.density, ['low','medium','high']),
    strandThickness: allowed(input?.strandThickness, ['fine','medium','thick']),
    desiredLength: allowed(input?.desiredLength, ['short','medium','long','any'], 'any'),
    maintenancePreference: allowed(input?.maintenancePreference, ['low','some','any'], 'any'),
  }
}

function sanitizeMeasurements(input) {
  if (input?.status !== 'measured' || !Array.isArray(input.measurements)) return []
  return input.measurements.slice(0, 40).filter(row => row?.assessable === true && typeof row.id === 'string' && Number.isFinite(row.value)).map(row => ({
    id: row.id.slice(0, 80), value: Math.round(row.value * 10000) / 10000,
    unit: row.unit === 'ratio' ? 'ratio' : String(row.unit || '').slice(0, 20),
    source: 'mediapipe_face_mesh_468',
    formula: typeof row.formula === 'string' ? row.formula.slice(0, 240) : null,
  }))
}

function eligibleStyles(profile) {
  return HAIR_CATALOG.filter(style =>
    style.hairTypes.includes(profile.hairType) && style.densities.includes(profile.density) &&
    style.thicknesses.includes(profile.strandThickness) &&
    (profile.desiredLength === 'any' || style.length === profile.desiredLength) &&
    (profile.maintenancePreference !== 'low' || style.maintenance === 'low')
  )
}

function deterministicRecommendations(candidates, profile, measurements) {
  const values = new Map(measurements.map(row => [row.id, row]))
  const widthHeight = values.get('face_width_to_height_ratio')?.value
  const jawCheek = values.get('jaw_to_cheek_width_ratio')?.value
  const upperThird = values.get('upper_visible_third_ratio')?.value
  const cited = ['face_width_to_height_ratio', 'jaw_to_cheek_width_ratio', 'upper_visible_third_ratio'].filter(id => values.has(id))

  return candidates.map(style => {
    let score = 70
    const reasons = [`Compatible with ${profile.hairType} hair, ${profile.density} density, and ${profile.strandThickness} strands`]
    if (widthHeight < 0.68 && ['low', 'none'].includes(style.visualEffects.topHeight)) { score += 12; reasons.push('Keeps added height controlled for your measured facial elongation') }
    if (widthHeight > 0.82 && ['medium', 'high'].includes(style.visualEffects.topHeight)) { score += 12; reasons.push('Adds vertical emphasis for your measured width-to-height relationship') }
    if (jawCheek < 0.72 && style.visualEffects.sideWidth !== 'low') { score += 7; reasons.push('Adds balanced width around your measured jaw-to-cheek relationship') }
    if (upperThird > 0.27 && style.visualEffects.foreheadExposure === 'low') { score += 8; reasons.push('Keeps forehead exposure low for your measured upper-third proportion') }
    if (profile.desiredLength === style.length) score += 5
    if (profile.maintenancePreference === style.maintenance) score += 4
    return { style, score, reasons }
  }).sort((a, b) => b.score - a.score).slice(0, 8).map(({ style, reasons }, index) => ({
    hairstyleId: style.id,
    rank: index + 1,
    matchReasons: reasons.slice(0, 3),
    relevantMeasurements: cited.map(id => values.get(id)),
    compatibilityFactors: [`${profile.hairType} hair`, `${profile.density} density`, `${profile.strandThickness} strands`],
    limitations: ['Photographic ratios guide visual balance and do not diagnose face shape'],
    catalogFactors: { hairTypes: style.hairTypes, densities: style.densities, thicknesses: style.thicknesses, length: style.length, maintenance: style.maintenance, visualEffects: style.visualEffects },
  }))
}

router.post('/recommend', verifyToken, claudeLimit, async (req, res) => {
  let fallback = []
  try {
    const profile = sanitizeHairProfile(req.body?.hairProfile)
    const measurements = sanitizeMeasurements(req.body?.analysisEvidence)
    if (!profile.hairType || !profile.density || !profile.strandThickness) return res.status(400).json({ error: 'Complete hair profile is required' })
    if (!measurements.length) return res.status(400).json({ error: 'Measured Ascendus scan evidence is required' })

    let candidates = eligibleStyles(profile)
    if (candidates.length < 3) candidates = HAIR_CATALOG.filter(style => style.hairTypes.includes(profile.hairType) && style.densities.includes(profile.density) && style.thicknesses.includes(profile.strandThickness))
    fallback = deterministicRecommendations(candidates, profile, measurements)
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.json({ engine: 'deterministic_catalog_fallback_v1', scanId: profile.scanId, recommendations: fallback })
    const measurementMap = new Map(measurements.map(row => [row.id, row]))
    const candidateIds = new Set(candidates.map(style => style.id))
    const prompt = `Rank the supplied hairstyle catalog for a visual hairstyle fitting room.

AUTHORITATIVE ASCENDUS MEASUREMENTS (do not invent or alter):
${JSON.stringify(measurements)}

USER HAIR PROFILE:
${JSON.stringify(profile)}

HARD-FILTERED CATALOG CANDIDATES:
${JSON.stringify(candidates)}

Rules:
- Select and rank up to 8 candidate ids only from the supplied catalog.
- Base facial reasoning only on the supplied measured ratios. Never infer new facial measurements or force a face-shape label.
- Hair feasibility is mandatory: respect type, density, strand thickness, acceptable length and maintenance.
- Explain visual balancing effects without claiming the hairstyle changes facial structure or objective attractiveness.
- relevantMeasurementIds may contain only ids present in AUTHORITATIVE ASCENDUS MEASUREMENTS.
- List honest photographic limitations.
- Return JSON only.

Schema:
{"recommendations":[{"hairstyleId":"catalog_id","matchReasons":["short reason"],"relevantMeasurementIds":["measurement_id"],"compatibilityFactors":["hair feasibility factor"],"limitations":["limitation"]}]}`

    const client = new Anthropic({ apiKey })
    const toolName = 'submit_hair_recommendations'
    const message = await withRetry(() => client.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 4096, temperature: 0,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: toolName,
        description: 'Submit the grounded hairstyle ranking in the required structure.',
        input_schema: {
          type: 'object', additionalProperties: false, required: ['recommendations'],
          properties: {
            recommendations: {
              type: 'array', minItems: 1, maxItems: 8,
              items: {
                type: 'object', additionalProperties: false,
                required: ['hairstyleId', 'matchReasons', 'relevantMeasurementIds', 'compatibilityFactors', 'limitations'],
                properties: {
                  hairstyleId: { type: 'string', enum: [...candidateIds] },
                  matchReasons: { type: 'array', maxItems: 3, items: { type: 'string' } },
                  relevantMeasurementIds: { type: 'array', maxItems: 5, items: { type: 'string', enum: [...measurementMap.keys()] } },
                  compatibilityFactors: { type: 'array', maxItems: 4, items: { type: 'string' } },
                  limitations: { type: 'array', maxItems: 4, items: { type: 'string' } },
                },
              },
            },
          },
        },
      }],
      tool_choice: { type: 'tool', name: toolName },
    }), 'hair-recommend')
    const toolUse = message.content?.find(block => block.type === 'tool_use' && block.name === toolName)
    if (!toolUse?.input) throw new Error('Recommendation engine returned no structured result')
    const parsed = toolUse.input
    const seen = new Set()
    const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).filter(item => candidateIds.has(item?.hairstyleId) && !seen.has(item.hairstyleId) && seen.add(item.hairstyleId)).slice(0, 8).map((item, index) => {
      const catalog = candidates.find(style => style.id === item.hairstyleId)
      const ids = Array.isArray(item.relevantMeasurementIds) ? item.relevantMeasurementIds.filter(id => measurementMap.has(id)).slice(0, 5) : []
      return {
        hairstyleId: item.hairstyleId, rank: index + 1,
        matchReasons: Array.isArray(item.matchReasons) ? item.matchReasons.map(String).slice(0, 3) : [],
        relevantMeasurements: ids.map(id => measurementMap.get(id)),
        compatibilityFactors: Array.isArray(item.compatibilityFactors) ? item.compatibilityFactors.map(String).slice(0, 4) : [],
        limitations: Array.isArray(item.limitations) ? item.limitations.map(String).slice(0, 4) : [],
        catalogFactors: { hairTypes: catalog.hairTypes, densities: catalog.densities, thicknesses: catalog.thicknesses, length: catalog.length, maintenance: catalog.maintenance, visualEffects: catalog.visualEffects },
      }
    })
    // Preserve Claude's valid order, then fill any missing slots from the
    // deterministic ranking. Malformed, duplicate, or incomplete model output
    // can never collapse the personalized slideshow.
    const completed = [...recommendations, ...fallback.filter(item => !seen.has(item.hairstyleId))]
      .slice(0, Math.min(8, candidates.length))
      .map((item, index) => ({ ...item, rank: index + 1 }))
    return res.json({ engine: recommendations.length ? 'claude_grounded_catalog_v1' : 'deterministic_catalog_fallback_v1', scanId: profile.scanId, recommendations: completed })
  } catch (err) {
    console.error('[Hair] recommendation failed:', err.message, err.status)
    if (fallback.length) return res.json({ engine: 'deterministic_catalog_fallback_v1', recommendations: fallback })
    return res.status(500).json({ error: 'Hair recommendation failed — please try again' })
  }
})

module.exports = router
