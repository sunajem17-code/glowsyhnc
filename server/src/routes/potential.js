// ─── /api/potential/analyze ───────────────────────────────────────────────────
// Pro-only endpoint. Accepts the user's pillar scores, calls Claude to generate
// 3 specific improvements + potential tier + timeline + headline.
// Returns clean JSON — no images are sent to Claude.

const express   = require('express')
const Anthropic  = require('@anthropic-ai/sdk')
const { verifyToken, requirePro, claudeLimit } = require('../middleware/claudeGate')

const router = express.Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ── Utility: find the N lowest-scoring pillars ─────────────────────────────────
function lowestPillars(pillars, n = 2, gender = 'male') {
  if (!pillars) return []
  const LABELS = {
    harmony:    'Harmony',
    angularity: 'Angularity',
    features:   'Features',
    dimorphism: gender === 'female' ? 'Femininity' : 'Dimorphism',
  }
  return Object.entries(pillars)
    .map(([k, v]) => ({ key: k, label: LABELS[k] ?? k, score: v }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
}

// POST /api/potential/analyze
router.post('/analyze', verifyToken, requirePro, claudeLimit, async (req, res) => {
  const { pillars, faceScore, groomingScore, gender = 'male', glowScore, currentTier } = req.body

  // ── Build score context ────────────────────────────────────────────────────
  const lines = []
  if (glowScore    != null) lines.push(`Overall Score: ${glowScore}/10`)
  if (faceScore    != null) lines.push(`Face Score: ${faceScore}/10`)
  if (groomingScore!= null) lines.push(`Grooming / Appeal: ${groomingScore}/10`)
  if (pillars) {
    const dimLabel = gender === 'female' ? 'Femininity' : 'Dimorphism'
    if (pillars.harmony    != null) lines.push(`Harmony: ${pillars.harmony}/10`)
    if (pillars.angularity != null) lines.push(`Angularity: ${pillars.angularity}/10`)
    if (pillars.features   != null) lines.push(`Features: ${pillars.features}/10`)
    if (pillars.dimorphism != null) lines.push(`${dimLabel}: ${pillars.dimorphism}/10`)
  }

  const lowest = lowestPillars(pillars, 2, gender)
  const lowestStr = lowest.length
    ? lowest.map(p => `${p.label} (${p.score}/10)`).join(' and ')
    : 'overall balance'

  const isFemale = gender === 'female'

  // Only include tiers strictly ABOVE the current tier so potential never goes down
  const MALE_TIERS   = ['Sub 3', 'Low Tier Normie', 'Mid Tier Normie', 'High Tier Normie', 'Chadlite', 'Chad', 'Adam Lite', 'True Adam']
  const FEMALE_TIERS = ['Sub 3', 'Low Tier Becky', 'Mid Tier Becky', 'High Tier Becky', 'Stacy', 'Eve', 'Eve Lite', 'True Eve']
  const allTiers = isFemale ? FEMALE_TIERS : MALE_TIERS
  const currentIdx = currentTier ? allTiers.findIndex(t => t.toLowerCase() === currentTier.toLowerCase()) : -1
  // Potential must be at least one tier above current; if already at top, keep same tier
  const minIdx = Math.max(currentIdx, 0)
  const aboveTiers = allTiers.slice(minIdx + 1)
  const tierOptions = aboveTiers.length
    ? aboveTiers.join(', ')
    : allTiers[allTiers.length - 1] // already at top tier

  const prompt = `You are an expert aesthetic consultant. A ${isFemale ? 'female' : 'male'} user has these facial analysis scores:

${lines.join('\n')}
Current tier: ${currentTier || 'unknown'}

Lowest scoring areas: ${lowestStr}

Return a JSON object with exactly these 4 fields — no other text, no markdown:

{
  "improvements": [
    "Under 8 words — specific actionable improvement for area 1",
    "Under 8 words — specific actionable improvement for area 2",
    "Under 8 words — specific actionable improvement for area 3"
  ],
  "potential_tier": "One tier name from this list ONLY: ${tierOptions}",
  "timeline": "Realistic timeframe e.g. '8–12 weeks' or '3–6 months'",
  "headline": "Punchy sentence under 12 words about their potential"
}

Rules:
- Each improvement must be specific (e.g. "Get to 13% body fat to reveal jawline" not "lose weight")
- potential_tier MUST be chosen from the provided list — never use a tier below or equal to current tier
- headline must feel personal and achievable, not hype
- Return ONLY valid JSON — no code fences, no explanation`

  try {
    const client = getClient()
    const model = 'claude-haiku-4-5'
    console.log('POTENTIAL: calling Claude with model:', model)
    console.log('POTENTIAL: prompt length:', prompt.length)
    const message = await client.messages.create({
      model,
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    })
    console.log('POTENTIAL: raw response:', JSON.stringify(message.content))

    const raw     = message.content[0]?.text?.trim() ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[Potential] JSON parse failed. Raw:', raw)
      return res.status(500).json({ error: 'AI returned malformed data — please try again' })
    }

    // Validate required shape
    if (
      !Array.isArray(parsed.improvements) ||
      parsed.improvements.length === 0    ||
      !parsed.potential_tier              ||
      !parsed.timeline                    ||
      !parsed.headline
    ) {
      return res.status(500).json({ error: 'Incomplete AI response — please try again' })
    }

    return res.json({
      improvements:   parsed.improvements.slice(0, 3),
      potential_tier: String(parsed.potential_tier),
      timeline:       String(parsed.timeline),
      headline:       String(parsed.headline),
    })
  } catch (err) {
    console.error('[Potential] Claude error:', err.message)
    console.error('[Potential] Status:', err.status)
    console.error('[Potential] Error type:', err.error?.type)
    console.error('[Potential] Error detail:', JSON.stringify(err.error ?? err, null, 2))
    return res.status(500).json({ error: 'AI analysis failed — please try again' })
  }
})

// ── POST /api/potential/glow-up — OpenAI face enhancement ────────────────────
router.post('/glow-up', verifyToken, requirePro, async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return res.status(500).json({ error: 'OpenAI not configured' })

    const { faceImage, improvements = [], gender = 'male' } = req.body
    if (!faceImage) return res.status(400).json({ error: 'faceImage required' })

    const OpenAI = require('openai')
    const { toFile } = require('openai')
    const client = new OpenAI({ apiKey })

    // Strip data URL prefix and convert to buffer
    const base64 = faceImage.replace(/^data:image\/\w+;base64,/, '')
    const buf    = Buffer.from(base64, 'base64')
    const file   = await toFile(buf, 'face.png', { type: 'image/png' })

    // Build enhancement prompt from their specific improvements
    const improvementStr = improvements.length
      ? improvements.slice(0, 2).join('; ')
      : 'clearer skin and sharper jawline'

    const prompt = gender === 'female'
      ? `Enhance this woman's appearance with flawless clear skin, defined cheekbones, bright eyes, perfectly groomed brows and hair. ${improvementStr}. Keep her exact identity, facial structure and features. Photorealistic portrait, soft natural lighting.`
      : `Enhance this man's appearance with clear skin, sharp defined jawline, bright eyes, well-groomed hair and brows. ${improvementStr}. Keep his exact identity, facial structure and features. Photorealistic portrait, natural lighting.`

    console.log('[GlowUp] Calling OpenAI image edit...')
    const response = await client.images.edit({
      model:  'gpt-image-1',
      image:  file,
      prompt,
      size:   '1024x1024',
      n:      1,
    })

    // gpt-image-1 returns base64 in response.data[0].b64_json
    const b64 = response.data[0]?.b64_json
    if (!b64) return res.status(500).json({ error: 'No image returned from OpenAI' })

    console.log('[GlowUp] Image generated successfully')
    return res.json({ image: `data:image/png;base64,${b64}` })
  } catch (err) {
    console.error('[GlowUp] Error:', err.message, err.status)
    return res.status(500).json({ error: 'Image enhancement failed — please try again' })
  }
})

module.exports = router
