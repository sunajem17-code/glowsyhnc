const express   = require('express')
const Anthropic  = require('@anthropic-ai/sdk')
const { verifyToken, resolvePro } = require('../middleware/claudeGate')
const { createLimiter } = require('../middleware/ratelimit')
const { withRetry } = require('../utils/withRetry')

const router = express.Router()

// 10 analyses per user per hour — generous enough for retries
const checkLimit = createLimiter('tindermaxx', 10, '1 h', 60 * 60 * 1000)

async function limitMiddleware(req, res, next) {
  const allowed = await checkLimit(req.userId)
  if (!allowed) return res.status(429).json({ error: 'Too many requests — try again in an hour.' })
  next()
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// POST /api/tindermaxx/rank
// Body: { photos: [{ base64, mediaType }], gender }
router.post('/rank', verifyToken, resolvePro, limitMiddleware, async (req, res) => {
  const { photos, gender = 'male' } = req.body

  if (!req.isPro) {
    return res.status(403).json({ error: 'Pro required', plan: 'premium' })
  }
  if (!Array.isArray(photos) || photos.length < 2 || photos.length > 6) {
    return res.status(400).json({ error: 'Send between 2 and 6 photos.' })
  }

  try {
    const client = getClient()

    // Build interleaved text + image blocks so Claude knows which number each photo is
    const imageContent = photos.flatMap((p, i) => ([
      { type: 'text', text: `Photo ${i + 1}:` },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: p.mediaType || 'image/jpeg',
          data: p.base64,
        },
      },
    ]))

    const message = await withRetry(() => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `You are an expert dating profile photo coach. Rank these ${photos.length} photos from best to worst for a ${gender}'s dating app profile (Tinder, Hinge, Bumble).

Criteria: lighting, expression, background, angle, energy, attractiveness conveyed.

SCORING CALIBRATION: these scores describe how effective each photo is as a dating-profile photo, not raw physical attractiveness — use the full 1–10 range realistically:
- 8.5–10  → excellent: flattering lighting, natural expression, good angle, genuine energy. Reserve this for a photo that is actually strong, not by default for the best of a weak set.
- 6.5–8.4 → solid: usable profile photo with a few things that could improve (lighting, angle, background, expression).
- 4.5–6.4 → average: noticeable issues (harsh lighting, awkward angle, distracting background, stiff expression) that limit its effectiveness. This is a common, honest score — not a punishment.
- Below 4.5 → weak: multiple significant problems (bad lighting, unflattering angle, cluttered background) that make this a poor profile choice.
Do not give every photo in the set a "good" score just because they're all from the same person — real photo sets have real quality variation between shots; reflect it instead of clustering everything at 7–9.

Respond ONLY in this exact JSON (no markdown, no extra text):
{
  "winner_index": 0,
  "rankings": [
    { "index": 0, "rank": 1, "score": 8.5, "reason": "one sentence why" },
    { "index": 1, "rank": 2, "score": 7.0, "reason": "one sentence why" }
  ],
  "winner_tips": ["specific actionable tip 1", "specific actionable tip 2"]
}`,
          },
        ],
      }],
    }), 'tindermaxx')

    const raw = message.content[0].text.trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      console.error('[TinderMaxx] JSON parse failed. Raw:', raw)
      return res.status(500).json({ error: 'Analysis returned unexpected format — please try again.' })
    }
    res.json(result)
  } catch (err) {
    console.error('[TinderMaxx]', err.message)
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Analysis returned unexpected format — please try again.' })
    }
    res.status(500).json({ error: 'Analysis failed — try again.' })
  }
})

module.exports = router
