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
  const { pillars, faceScore, groomingScore, gender = 'male', glowScore } = req.body

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
  const tierOptions = isFemale
    ? 'Mid Tier Becky, High Tier Becky, Stacy, Eve, True Eve'
    : 'High Tier Normie, Chadlite, Chad, Gigachad'

  const prompt = `You are an expert aesthetic consultant. A ${isFemale ? 'female' : 'male'} user has these facial analysis scores:

${lines.join('\n')}

Lowest scoring areas: ${lowestStr}

Return a JSON object with exactly these 4 fields — no other text, no markdown:

{
  "improvements": [
    "Under 8 words — specific actionable improvement for area 1",
    "Under 8 words — specific actionable improvement for area 2",
    "Under 8 words — specific actionable improvement for area 3"
  ],
  "potential_tier": "One tier name from: ${tierOptions}",
  "timeline": "Realistic timeframe e.g. '8–12 weeks' or '3–6 months'",
  "headline": "Punchy sentence under 12 words about their potential"
}

Rules:
- Each improvement must be specific (e.g. "Get to 13% body fat to reveal jawline" not "lose weight")
- potential_tier must be a realistic but motivating upgrade from their current score
- headline must feel personal and achievable, not hype
- Return ONLY valid JSON — no code fences, no explanation`

  try {
    const client = getClient()
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages:   [{ role: 'user', content: prompt }],
    })

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
    return res.status(500).json({ error: 'AI analysis failed — please try again' })
  }
})

module.exports = router
