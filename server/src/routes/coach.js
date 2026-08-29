const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')
const { withRetry } = require('../utils/withRetry')
const db = require('../db')

const FREE_COACH_LIMIT = 3

const router = express.Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function buildSystemPrompt(scanContext) {
  const { glowScore, faceScore, presentationScore, faceData, presentationData, userProfile } = scanContext || {}

  let prompt = `You are the Ascendus AI Coach. You help people improve their physical appearance through direct, specific, actionable advice.

STRICT RULES:
- Never use em dashes (the -- character). Use commas, periods, or colons instead.
- No fluff, no filler, no preamble. Get straight to the answer.
- Be specific: say "Vitamin D3 4000IU with K2 100mcg daily" not "take vitamins".
- Short responses only. 3-6 lines max. Every line counts.
- Reference their scan scores when relevant.
- No encouragement padding. Just the information.
- Never say "Great question" or any opener. Start with the answer.

FORMAT:
- One point per line.
- Use bullet points for multi-step protocols.
- Bold a header only if the answer covers multiple distinct topics.

Example (jawline question):
Mew 24/7: tongue fully on palate including the back third.
Chew mastic gum 20 min daily to build masseters.
Reduce body fat below 15% to reveal definition.
Results take 3-6 months of consistency.

KNOWLEDGE BASE — apply when relevant:

HEIGHT MAXIMIZATION (use when user asks about height, growth, or if they seem young):
- Sleep 8-9hrs — human growth hormone is released in pulses during deep sleep stages 3-4; cutting sleep kills GH output
- Vitamin D3 4000IU daily taken with K2 100mcg (MK-7 form) — D3 alone without K2 can cause calcium misdeposition
- Zinc 15-30mg at night — GH secretagogue, also boosts testosterone
- Magnesium glycinate 300-400mg at night — improves deep sleep quality and GH release
- Decompression stretches: dead hangs (3x60s daily), cat-cow, child's pose — decompress spinal discs which account for up to 2-3cm of height
- Posture correction directly adds perceived and measured height — forward head posture alone loses 1-2 inches of perceived height
- Avoid: caffeine after 2pm (disrupts deep sleep), smoking (stunts growth), alcohol (suppresses GH)

SKIN PROTOCOL (use when skin clarity score < 7 or user asks about skin):
- Niacinamide 10% serum AM — reduces pores, controls sebum, brightens
- Tretinoin 0.025-0.05% PM 3x/week (ramp up slowly) — gold standard for texture and clarity
- Sunscreen SPF 50+ every morning — prevents collagen breakdown and hyperpigmentation
- Zinc supplement 15mg daily — anti-inflammatory, reduces acne
- Hydration: 3L+ water daily with electrolytes

JAWLINE PROTOCOL (use when jawline score < 7 or user asks about jaw):
- Mewing: correct tongue posture 24/7 — tongue fully on palate including back third
- Chewing hard foods: mastic gum, hard vegetables — builds masseter and pterygoid muscles
- Body fat reduction: every 1% BF lost makes jaw more visible (most impactful short-term lever)
- Face yoga: chin tucks 3x15 reps daily — strengthens neck and defines jawline
- Sleep on back — side sleeping causes facial asymmetry over years

POSTURE PROTOCOL (use when posture score < 7 or user mentions posture):
- Dead hangs 3x60s daily — decompresses spine, improves shoulder width appearance
- Face pulls 3x15 with band — fixes rounded shoulders
- Hip flexor stretches 2x60s each side daily — fixes anterior pelvic tilt
- Chin tucks 3x15 — fixes forward head posture (adds 1-2 inches perceived height)
- Thoracic extension over foam roller 2 min daily`

  if (glowScore != null) {
    prompt += `\n\nUSER'S SCAN DATA (use this to give personalized advice):
Overall Score: ${glowScore}/10
Face Score: ${faceScore}/10 | Presentation Score: ${presentationScore}/10`

    if (faceData) {
      prompt += `\nFace breakdown — Symmetry: ${faceData.symmetry}/10 | Jawline: ${faceData.jawline}/10 | Skin Clarity: ${faceData.skinClarity}/10 | Eyes: ${faceData.eyeArea}/10 | Harmony: ${faceData.overallHarmony}/10`
    }
    if (presentationData) {
      prompt += `\nPresentation — Grooming: ${presentationData.grooming}/10 | Style: ${presentationData.style}/10 | First Impression: ${presentationData.firstImpression}/10`
    }

    // Identify weak areas
    const areas = []
    if (faceData?.skinClarity < 6) areas.push('skin clarity')
    if (faceData?.jawline < 6) areas.push('jawline definition')
    if (presentationData?.grooming < 6) areas.push('grooming')
    if (presentationData?.style < 6) areas.push('style')

    if (areas.length > 0) {
      prompt += `\nKey improvement areas: ${areas.join(', ')}`
    }

    if (userProfile?.goal) {
      prompt += `\nUser goal: ${userProfile.goal}`
    }
  }

  prompt += `\n\nIMPORTANT: Always cite the user's actual scan scores when giving advice. If their jawline is 5.8, say "your jawline scored 5.8". If their posture is 6.5, reference that number. Never invent data not shown above.`
  return prompt
}

// POST /api/coach/message
router.post('/message', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  const { messages, scanContext } = req.body

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Free users: enforce 3-message lifetime limit (tracked server-side)
  if (!req.isPro && !req.isDemo) {
    const row = db.prepare('SELECT coach_messages_used FROM users WHERE id = ?').get(req.userId)
    const used = row?.coach_messages_used ?? 0
    if (used >= FREE_COACH_LIMIT) {
      return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
    }
    db.prepare('UPDATE users SET coach_messages_used = coach_messages_used + 1 WHERE id = ?').run(req.userId)
  }

  // Demo users: block entirely
  if (req.isDemo) {
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  }

  // Limit conversation history to last 20 messages to control tokens
  const recentMessages = messages.slice(-20)

  try {
    const client = getClient()
    const systemPrompt = buildSystemPrompt(scanContext)

    const response = await withRetry(() => client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages: recentMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }), 'coach')

    const text = response.content[0]?.text || ''
    res.json({ message: text })
  } catch (err) {
    console.error('Coach API error:', err.message)
    res.status(500).json({ error: 'Coach unavailable. Try again.' })
  }
})

module.exports = router
