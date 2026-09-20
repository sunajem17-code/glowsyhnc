const express = require('express')
const crypto = require('crypto')
const OpenAI = require('openai')
const Anthropic = require('@anthropic-ai/sdk')
const { toFile } = require('openai')
const { verifyToken, claudeLimit, requirePro } = require('../middleware/claudeGate')
const { withRetry } = require('../utils/withRetry')

const router = express.Router()
const previewCache = new Map()

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

router.post('/recommend', verifyToken, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Hair recommendation service is not configured' })
    const profile = sanitizeHairProfile(req.body?.hairProfile)
    const measurements = sanitizeMeasurements(req.body?.analysisEvidence)
    if (!profile.hairType || !profile.density || !profile.strandThickness) return res.status(400).json({ error: 'Complete hair profile is required' })
    if (!measurements.length) return res.status(400).json({ error: 'Measured Ascendus scan evidence is required' })

    let candidates = eligibleStyles(profile)
    if (candidates.length < 3) candidates = HAIR_CATALOG.filter(style => style.hairTypes.includes(profile.hairType) && style.densities.includes(profile.density) && style.thicknesses.includes(profile.strandThickness))
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
    if (!recommendations.length) throw new Error('Recommendation engine returned no valid catalog ids')
    return res.json({ engine: 'claude_grounded_catalog_v1', scanId: profile.scanId, recommendations })
  } catch (err) {
    console.error('[Hair] recommendation failed:', err.message, err.status)
    return res.status(500).json({ error: 'Hair recommendation failed — please try again' })
  }
})

const STYLE_PROMPTS = {
  textured_crop: 'a short textured crop, low natural taper, soft forward texture',
  french_crop: 'a French crop with a soft forward fringe and clean short sides',
  caesar: 'a modern Caesar cut with an even short layer and subtle fringe',
  crew_cut: 'a classic crew cut, short tapered sides, slightly longer at the front',
  buzz_cut: 'a clean even buzz cut with a natural tapered outline',
  low_taper_fringe: 'a low taper with a loose natural fringe and retained side weight',
  mid_taper_texture: 'a mid taper with medium textured hair on top',
  curly_taper: 'a low curly taper preserving the natural curl pattern and density',
  curly_fringe: 'a defined curly fringe with softly blended sides',
  curtains: 'medium length curtains with a natural center part and soft side flow',
  side_part: 'a soft natural side part with a connected low taper',
  messy_fringe: 'a loose messy fringe with irregular natural texture and a low taper',
  slick_back: 'a connected slick back with natural volume and no harsh disconnect',
  quiff: 'a modern controlled quiff with tapered sides and natural matte texture',
  pompadour: 'a soft pompadour with connected sides and realistic pliable volume',
  modern_mullet: 'a modern layered mullet with tapered temples and deliberate back length',
  flow: 'medium-long layered flow moving naturally away from the face',
}

function imageParts(value, fallbackType = 'image/jpeg') {
  const match = typeof value === 'string' ? value.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s) : null
  if (match) return { mediaType: match[1], base64: match[2] }
  return { mediaType: fallbackType, base64: value }
}

// Production HairMax no longer asks an LLM to guess face shape. Matching is
// deterministic on the client from the saved scan evidence. This endpoint has
// one job: edit hair while preserving the source portrait.
router.post('/preview', verifyToken, requirePro, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'Hair preview service is not configured' })

    const { faceImage, hairstyleId, mediaType = 'image/jpeg' } = req.body
    const hairstyle = STYLE_PROMPTS[hairstyleId]
    if (!faceImage || !hairstyle) return res.status(400).json({ error: 'Valid faceImage and hairstyleId are required' })

    const parts = imageParts(faceImage, mediaType)
    if (!parts.base64 || parts.base64.length > 15_000_000) return res.status(413).json({ error: 'Image is missing or too large' })
    const key = crypto.createHash('sha256').update(parts.base64).update('|').update(hairstyleId).digest('hex')
    const cached = previewCache.get(key)
    if (cached) return res.json({ image: cached, hairstyleId, cached: true })

    const openai = new OpenAI({ apiKey })
    const buffer = Buffer.from(parts.base64, 'base64')
    const file = await toFile(buffer, 'hairmax-source.png', { type: parts.mediaType })
    const prompt = `Edit this exact portrait so the person has ${hairstyle}. Preserve the person's identity exactly: same face shape, facial proportions, jawline, nose, eyes, eyebrows, ears, skin tone, skin texture, facial hair, expression, apparent age, head position and body. Preserve the same crop, camera angle, background and lighting. Do not beautify, retouch skin, add makeup, reshape the face, alter weight, or change clothing. Change only the scalp hair and the minimum surrounding hair edges required for a realistic haircut. Photorealistic hairstyle fitting-room comparison.`

    const response = await openai.images.edit({ model: 'gpt-image-1', image: file, prompt, size: '1024x1024', n: 1 })
    const output = response.data?.[0]?.b64_json
    if (!output) return res.status(502).json({ error: 'No hairstyle preview was returned' })
    const image = `data:image/png;base64,${output}`
    if (previewCache.size >= 120) previewCache.delete(previewCache.keys().next().value)
    previewCache.set(key, image)
    return res.json({ image, hairstyleId, cached: false })
  } catch (err) {
    console.error('[Hair] preview failed:', err.message, err.status)
    return res.status(500).json({ error: 'Hairstyle preview failed — please try again' })
  }
})

module.exports = router
