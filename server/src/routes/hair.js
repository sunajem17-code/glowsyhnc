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
router.post('/analyze', verifyToken, claudeLimit, async (req, res) => {
  const { imageData, mediaType = 'image/jpeg' } = req.body
  if (!imageData) return res.status(400).json({ error: 'imageData required' })

  try {
    const client = getClient()

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
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
    res.status(500).json({ error: 'internal_error' })
  }
})

// POST /api/hair/tryon
// Pro-only. Body: { imageData: base64, hairstyleName: string, headShape: string }
// Uses Claude to write a precise prompt, then OpenAI gpt-image-1 to render it.
router.post('/tryon', verifyToken, requirePro, async (req, res) => {
  try {
    const openaiKey    = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!openaiKey)    return res.status(500).json({ error: 'Image generation not configured' })
    if (!anthropicKey) return res.status(500).json({ error: 'AI not configured' })

    const { imageData, hairstyleName, headShape = 'oval', hairType = 'straight' } = req.body
    if (!imageData)     return res.status(400).json({ error: 'imageData required' })
    if (!hairstyleName) return res.status(400).json({ error: 'hairstyleName required' })

    // Step 1: Claude writes a precise image prompt
    const anthropic    = getClient()
    const claudePrompt = `You are a hairstyle visualization expert. Look at this person's photo and write an ultra-specific image editing prompt (max 100 words) to show them with a "${hairstyleName}" hairstyle.

Rules:
- Keep EXACT same face, skin, facial features, and identity — only change the hair
- Describe the ${hairstyleName} hairstyle in precise visual terms (length, texture, volume, where it falls)
- Mention their head shape (${headShape}) and hair type (${hairType}) to ensure the style fits
- Say "same person, same face" explicitly
- Photorealistic portrait, same angle, natural lighting
- Output ONLY the prompt text, no explanation`

    console.log('[HairTryOn] Step 1: Claude writing hairstyle prompt...')
    const claudeMsg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageData.replace(/^data:image\/\w+;base64,/, '') } },
          { type: 'text',  text: claudePrompt },
        ],
      }],
    })

    const hairstylePrompt = claudeMsg.content[0]?.text?.trim() ?? ''
    console.log('[HairTryOn] Prompt:', hairstylePrompt)

    // Step 2: OpenAI renders the hairstyle
    const OpenAI     = require('openai')
    const { toFile } = require('openai')
    const openai     = new OpenAI({ apiKey: openaiKey })

    const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buf    = Buffer.from(base64, 'base64')
    const file   = await toFile(buf, 'face.png', { type: 'image/png' })

    const finalPrompt = `${hairstylePrompt} Same person, same face, photorealistic.`

    console.log('[HairTryOn] Step 2: OpenAI rendering hairstyle...')
    const response = await openai.images.edit({
      model:  'gpt-image-1',
      image:  file,
      prompt: finalPrompt,
      size:   '1024x1024',
      n:      1,
    })

    const b64 = response.data[0]?.b64_json
    if (!b64) return res.status(500).json({ error: 'No image returned' })

    console.log('[HairTryOn] Done')
    return res.json({ image: `data:image/png;base64,${b64}`, prompt: hairstylePrompt })
  } catch (err) {
    console.error('[HairTryOn] Error:', err.message, err.status)
    return res.status(500).json({ error: 'Hairstyle try-on failed — please try again' })
  }
})

module.exports = router
