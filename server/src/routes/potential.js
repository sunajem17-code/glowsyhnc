// ─── /api/potential/analyze ───────────────────────────────────────────────────
// Pro-only endpoint. Accepts the user's pillar scores, calls Claude to generate
// 3 specific improvements + potential tier + timeline + headline.
// Returns clean JSON — no images are sent to Claude.

const express   = require('express')
const Anthropic  = require('@anthropic-ai/sdk')
const { verifyToken, requirePro, claudeLimit } = require('../middleware/claudeGate')
const { MALE_TIERS: MALE_TIER_TABLE, FEMALE_TIERS: FEMALE_TIER_TABLE } = require('../lib/tier')

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

  // Only include tiers strictly ABOVE the current tier so potential never goes down.
  // Labels come from the shared tier table (lib/tier.js), lowest-first — it's
  // ordered highest-first for score lookup, so reverse it here.
  const allTiers = (isFemale ? FEMALE_TIER_TABLE : MALE_TIER_TABLE).map(t => t.label).reverse()
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

// ── POST /api/potential/glow-up — Claude writes the prompt, OpenAI renders it ─
router.post('/glow-up', verifyToken, requirePro, async (req, res) => {
  try {
    const openaiKey    = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!openaiKey)    return res.status(500).json({ error: 'OpenAI not configured' })
    if (!anthropicKey) return res.status(500).json({ error: 'Anthropic not configured' })

    const {
      faceImage,
      improvements  = [],
      gender        = 'male',
      scanData      = {},   // { overallScore, faceSubScores, keyWeaknesses, pillars, groomingScore }
    } = req.body
    if (!faceImage) return res.status(400).json({ error: 'faceImage required' })

    // ── Step 1: Claude analyzes the face + scan data → writes a precise OpenAI prompt ──
    const anthropic  = getClient()
    const isFemale   = gender === 'female'

    const weaknesses = scanData.keyWeaknesses?.join(', ') || improvements.join(', ') || 'general appearance'
    const subScores  = scanData.faceSubScores  ?? {}
    const pillars    = scanData.pillars         ?? {}

    const scoreLines = []
    if (scanData.overallScore  != null) scoreLines.push(`Overall: ${scanData.overallScore}/10`)
    if (scanData.groomingScore != null) scoreLines.push(`Grooming: ${scanData.groomingScore}/10`)
    if (subScores.skinClarity  != null) scoreLines.push(`Skin clarity: ${subScores.skinClarity}/10`)
    if (subScores.jawlineDefinition != null) scoreLines.push(`Jawline definition: ${subScores.jawlineDefinition}/10`)
    if (subScores.eyeArea      != null) scoreLines.push(`Eye area: ${subScores.eyeArea}/10`)
    if (subScores.symmetry     != null) scoreLines.push(`Symmetry: ${subScores.symmetry}/10`)
    if (pillars.harmony        != null) scoreLines.push(`Harmony: ${pillars.harmony}/10`)
    if (pillars.angularity     != null) scoreLines.push(`Angularity: ${pillars.angularity}/10`)

    const claudePrompt = `You are an image enhancement director. Look at this ${isFemale ? "woman's" : "man's"} face photo and their appearance scan scores:

${scoreLines.join('\n')}
Key weaknesses to fix: ${weaknesses}
Specific improvements needed: ${improvements.join('; ')}

Your job: write a single, ultra-specific image editing prompt (max 120 words) for OpenAI's image model that describes EXACTLY what this person would look like at their full potential.

Rules:
- Reference specific visible features you can see in their photo (e.g. "clear the acne on the left cheek", "sharpen the jawline which currently lacks definition", "brighten the under-eye area")
- Address EVERY low-scoring area with a concrete visual fix
- Keep their exact face shape, bone structure, eye color, and identity — only enhance don't transform
- Include: skin quality fix, grooming improvements, lighting enhancement
- Photorealistic portrait, same angle as original photo
- Do NOT mention scores or numbers — only visual descriptions
- Output ONLY the prompt text, nothing else`

    console.log('[GlowUp] Step 1: Claude writing enhancement prompt...')
    const claudeMsg = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: faceImage.replace(/^data:image\/\w+;base64,/, '') } },
          { type: 'text',  text: claudePrompt },
        ],
      }],
    })

    const enhancementPrompt = claudeMsg.content[0]?.text?.trim() ?? ''
    console.log('[GlowUp] Claude prompt:', enhancementPrompt)

    // ── Step 2: OpenAI renders the enhanced face ───────────────────────────────
    const OpenAI     = require('openai')
    const { toFile } = require('openai')
    const openai     = new OpenAI({ apiKey: openaiKey })

    const base64 = faceImage.replace(/^data:image\/\w+;base64,/, '')
    const buf    = Buffer.from(base64, 'base64')
    const file   = await toFile(buf, 'face.png', { type: 'image/png' })

    const finalPrompt = `${enhancementPrompt} Maintain exact identity. Photorealistic, same angle, natural lighting.`

    console.log('[GlowUp] Step 2: OpenAI rendering enhanced image...')
    const response = await openai.images.edit({
      model:  'gpt-image-1',
      image:  file,
      prompt: finalPrompt,
      size:   '1024x1024',
      n:      1,
    })

    const b64 = response.data[0]?.b64_json
    if (!b64) return res.status(500).json({ error: 'No image returned from OpenAI' })

    console.log('[GlowUp] Done — image generated')
    return res.json({ image: `data:image/png;base64,${b64}`, prompt: enhancementPrompt })
  } catch (err) {
    console.error('[GlowUp] Error:', err.message, err.status)
    return res.status(500).json({ error: 'Image enhancement failed — please try again' })
  }
})

module.exports = router
