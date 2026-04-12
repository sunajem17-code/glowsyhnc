const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { verifyToken, claudeLimit, requirePro } = require('../middleware/claudeGate')

const router = express.Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function parseJSON(raw) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

// POST /api/hair/analyze
// Body: { imageData: base64string, mediaType?: string }
router.post('/analyze', verifyToken, requirePro, claudeLimit, async (req, res) => {
  const { imageData, mediaType = 'image/jpeg' } = req.body
  if (!imageData) return res.status(400).json({ error: 'imageData required' })

  try {
    const client = getClient()

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageData },
          },
          {
            type: 'text',
            text: `Analyze this person's head shape from the photo. Identify: oval / round / square / diamond / heart / oblong. Then recommend the top 3 best haircuts for this exact head shape. For each haircut include: name, why it works for this shape, how to ask for it at the barber, and what to avoid. Also detect their hair type: straight / wavy / curly / coily / locs. Return JSON only.

Return this exact JSON structure with no extra text:
{
  "headShape": "oval",
  "headShapeDescription": "one or two sentences on why this shape is advantageous or what to work with",
  "hairType": "straight",
  "recommendations": [
    {
      "name": "Haircut Name",
      "whyItWorks": "why this works specifically for this head shape",
      "howToAsk": "exactly what to say at the barber",
      "avoid": "what to avoid with this cut"
    },
    {
      "name": "Second Haircut",
      "whyItWorks": "...",
      "howToAsk": "...",
      "avoid": "..."
    },
    {
      "name": "Third Haircut",
      "whyItWorks": "...",
      "howToAsk": "...",
      "avoid": "..."
    }
  ],
  "whatToAvoid": "general styles and shapes to avoid for this head shape and why"
}`,
          },
        ],
      }],
    })

    const text = message.content[0]?.text ?? ''
    const result = parseJSON(text)
    res.json(result)
  } catch (err) {
    console.error('[Hair] Analysis failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
