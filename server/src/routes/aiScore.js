const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { verifyToken, claudeLimit, scanLimit, resolvePro } = require('../middleware/claudeGate')
const assessment = require('../lib/appearanceAssessment')
const { assessmentFailureDetails } = require('../utils/assessmentFailure')


const router = express.Router()

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ── Concurrency queue ─────────────────────────────────────────────────────────
// At most MAX_CONCURRENT scoring requests run simultaneously.
// Additional requests are queued (FIFO) and run as slots free up.
const MAX_CONCURRENT = 30
let _running = 0
const _waiters = []

function acquireSlot() {
  return new Promise(resolve => {
    if (_running < MAX_CONCURRENT) {
      _running++
      resolve()
    } else {
      console.log(`[aiScore] Queue: ${_waiters.length + 1} request(s) waiting (${_running}/${MAX_CONCURRENT} running)`)
      _waiters.push(resolve)
    }
  })
}

function releaseSlot() {
  if (_waiters.length > 0) {
    _waiters.shift()() // hand slot to next waiter
  } else {
    _running--
  }
}

// ── Retry helper ──────────────────────────────────────────────────────────────
// Exponential backoff on 429 / 529 / quota errors:
//   Attempt 1 fails → wait 2 s → retry 1
//   Retry   1 fails → wait 5 s → retry 2
//   Retry   2 fails → wait 10 s → retry 3
//   Retry   3 fails → throw enriched error with exact status + message (for Railway)
// Non-retryable errors throw immediately with no wait.
async function withRetry(fn, label = 'api') {
  const MAX_RETRIES  = 3
  const BACKOFF_MS   = [0, 2000, 5000, 10000] // indexed by attempt number (1-based)

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status  = err.status ?? err.statusCode ?? 0
      // Anthropic SDK nests the real message inside err.error on some versions
      const apiMsg  = err.error?.error?.message || err.error?.message || ''
      const rawMsg  = err.message || ''
      const fullMsg = apiMsg || rawMsg

      const lower   = fullMsg.toLowerCase()
      const is429   = status === 429 || lower.includes('rate limit') || lower.includes('rate_limit') || lower.includes('too many') || lower.includes('quota') || lower.includes('exceeded')
      const is529   = status === 529 || lower.includes('overloaded') || lower.includes('capacity')
      // Claude occasionally returns a non-JSON preamble ("Here is the analysis:") or plain refusal.
      // parseJSON() throws Error("... returned non-JSON: ...") and JSON.parse throws SyntaxError.
      // Neither has a status code, so they fell through to the user before this fix.
      const isParseError = err instanceof SyntaxError || lower.includes('returned non-json') || lower.includes('non-json')
      const isRetryable = is429 || is529 || isParseError

      const typeTag = is429 ? '429_RATE_LIMIT' : is529 ? '529_OVERLOADED' : isParseError ? 'PARSE_ERROR_RETRY' : `${status}_ERROR`

      // Always log exact status + message so Railway shows the real cause
      console.error(`[aiScore:${label}] attempt=${attempt} status=${status} type=${typeTag} msg="${fullMsg.slice(0, 300)}"`)

      if (!isRetryable) {
        // Non-retryable — re-throw immediately
        throw err
      }

      if (attempt > MAX_RETRIES) {
        // Exhausted all retries — throw enriched error with full detail
        console.error(`[aiScore:${label}] GAVE UP after ${MAX_RETRIES} retries — status=${status} type=${typeTag}`)
        const enriched = new Error(`[${typeTag}] after ${MAX_RETRIES} retries: ${fullMsg || `HTTP ${status}`}`)
        enriched.status = status
        enriched.retryExhausted = true
        throw enriched
      }

      const waitMs = BACKOFF_MS[attempt] ?? 10000
      console.error(`[aiScore:${label}] waiting ${waitMs}ms before retry ${attempt}/${MAX_RETRIES}...`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }
}

function parseJSON(raw, label) {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`${label} returned non-JSON: ${raw.slice(0, 200)}`)
  return JSON.parse(match[0])
}

// Detect actual image MIME type from the data URL prefix.
// Falls back to image/jpeg if no prefix is present.
function getMediaType(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/)
  if (match) return match[1]
  return 'image/jpeg'
}

// Strip the data URL prefix (data:image/...;base64,) leaving only the raw base64.
function stripPrefix(dataUrl) {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '')
}

// Existing body-only assessment is separate from facial appearance feedback.
async function getPhysiqueScore(bodyBase64, bodyMediaType, gender = 'male', bodyGeometry = null, height = null, weight = null) {
  const client = getClient()
  const isFemale = gender === 'female'

  // bodyGeometry (when present) comes from Apple's Vision framework running
  // VNDetectHumanBodyPoseRequest on-device against the actual body photo —
  // real joint positions, not a visual guess. shoulderHipRatio is a real
  // scale-independent width ratio; spineLeanDegrees is a real angle off
  // vertical between the neck and root (upper-spine) joints. Neither is a
  // full replacement for visual judgment (Vision can't see muscle
  // definition or clothing fit), so this is offered as a factual anchor
  // for the proportions/posture categories specifically, not the whole score.
  const measuredGeometryNote = bodyGeometry
    ? `\n\nMEASURED REFERENCE (from on-device pose detection, not a visual estimate):${
        bodyGeometry.shoulderHipRatio != null ? `\n- Shoulder-to-hip width ratio ≈ ${bodyGeometry.shoulderHipRatio.toFixed(2)} (higher = more V-taper)` : ''
      }${
        bodyGeometry.spineLeanDegrees != null ? `\n- Upper-spine lean off vertical ≈ ${bodyGeometry.spineLeanDegrees.toFixed(1)}° (closer to 0° = more upright)` : ''
      }\nUse these as factual anchors for "proportions" and "posture" specifically — don't contradict them without a clear photographic reason (e.g. baggy clothing hiding true shoulder width). They don't determine leanness, frame, or overall_presentation, which stay purely visual.`
    : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    temperature: 0,
    system: `You are a physique and body composition analyst. You output ONLY a JSON object. No explanations. No text. Just JSON.

Score physique on a 1.0–10.0 scale across 5 categories.

${isFemale ? `FEMALE PHYSIQUE SCORING:
- proportions: Waist-to-hip ratio, shoulder width, leg/torso balance, overall silhouette harmony. High score: defined waist, proportional hips/shoulders.
- leanness: Visible muscle separation or toning, absence of excess body fat. Does NOT require extreme leanness — healthy athletic tone is 7+.
- frame: Bone structure and natural body frame size. Shoulder width, hip structure, limb length relative to torso.
- posture: Spine alignment, shoulder position, head position. Forward head, rounded shoulders = low score. Upright, open chest = high score.
- overall_presentation: Grooming, clothing fit, how well the body is presented in the photo. Clean presentation with well-fitted clothing = high score.` :
`MALE PHYSIQUE SCORING:
- proportions: Shoulder-to-waist ratio (V-taper), chest-to-hip ratio, limb symmetry, overall silhouette. High score: wide shoulders, narrow waist, balanced limbs.
- leanness: Visible muscle definition or separation. Body fat level. Does NOT require stage-lean — visible abs or clear muscle definition is 7+. Soft/no definition = below 5.
- frame: Bone structure. Shoulder width, clavicle length, wrist size, natural frame. Wide natural frame = high score regardless of muscle.
- posture: Spine alignment, shoulder position, chest position. Rounded forward posture = low score. Upright, chest out = high score.
- overall_presentation: Grooming, clothing fit, how well the body is presented. Clean presentation = high score.`}${measuredGeometryNote}

SCORE DISTRIBUTION — think of these as a bell curve across the general population, not a fitness-influencer feed:
- 5.0 is the TRUE MIDDLE — an average build, nothing notably impressive or lacking. Most people land here, and that is not a bad score.
- 3.0 — below average: poor proportions, minimal muscle definition, or a noticeably underdeveloped frame for that category.
- 7.0 — clearly above average: visible muscle definition or good proportions. This is a genuinely good score — do not reserve 7+ for exceptional cases only.
- 9.0 — exceptional, physique-competitor or fitness-model tier. Rare — most photos, even good ones, should not get a 9 across the board.

SCORING RULES:
- Use the FULL 1–10 range in both directions — do not compress everyone into 5–7 out of politeness, but also don't treat a 5–6 as a punishment; it is the honest, common result for an average physique.
- Score based only on what is VISIBLE in the photo. If the body is partially hidden by clothing, score what you can see and note it.
- Never penalize for natural body type — score relative to ideal proportions for that body type.
- Body fat levels: very_lean / lean / average / above_average / heavy

Return ONLY this JSON — no markdown, nothing else:
{
  "proportions": <number 1.0–10.0>,
  "leanness": <number 1.0–10.0>,
  "frame": <number 1.0–10.0>,
  "posture": <number 1.0–10.0>,
  "overall_presentation": <number 1.0–10.0>,
  "body_fat_level": "<very_lean|lean|average|above_average|heavy>",
  "physique_strengths": ["<strength 1>", "<strength 2>"],
  "physique_improvements": ["<improvement 1>", "<improvement 2>"],
  "physique_notes": "<one sentence summary of physique, max 15 words>"
}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: bodyMediaType, data: bodyBase64 } },
        { type: 'text',  text: `Score this ${isFemale ? 'woman' : 'man'}'s physique.${height ? ` Height: ${height}.` : ''}${weight ? ` Weight: ${weight}.` : ''} Use height and weight to calibrate frame and leanness expectations — a heavier person at the same visible leanness scores differently than a lighter one. Return ONLY the JSON.` },
      ],
    }],
  })

  const raw = response.content[0]?.text?.trim() || ''
  const parsed = parseJSON(raw, 'Physique scorer')
  const clamp = (v, fallback = 5.0) => Math.min(Math.max(Number(v) || fallback, 1.0), 10.0)
  const overall = (clamp(parsed.proportions) + clamp(parsed.leanness) + clamp(parsed.frame) + clamp(parsed.posture) + clamp(parsed.overall_presentation)) / 5

  return {
    proportions:          Math.round(clamp(parsed.proportions)         * 10) / 10,
    leanness:             Math.round(clamp(parsed.leanness)            * 10) / 10,
    frame:                Math.round(clamp(parsed.frame)               * 10) / 10,
    posture:              Math.round(clamp(parsed.posture)             * 10) / 10,
    overall_presentation: Math.round(clamp(parsed.overall_presentation)* 10) / 10,
    overall:              Math.round(overall                           * 10) / 10,
    body_fat_level:       parsed.body_fat_level ?? 'average',
    physique_strengths:   Array.isArray(parsed.physique_strengths)   ? parsed.physique_strengths   : [],
    physique_improvements:Array.isArray(parsed.physique_improvements) ? parsed.physique_improvements : [],
    physique_notes:       parsed.physique_notes ?? null,
  }
}

// All face assessments, including older clients, use the versioned validated pipeline.
router.post('/score', verifyToken, resolvePro, scanLimit, claudeLimit, async (req, res) => {
  const { faceImage, sideImage = null } = req.body
  const validImage = value => typeof value === 'string' && value.length > 100 && value.length <= 12_000_000
  if (!validImage(faceImage) || (sideImage !== null && !validImage(sideImage))) {
    return res.status(400).json({ error: 'A valid face photograph is required.' })
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return res.status(503).json({ error: 'Appearance assessment is unavailable.' })
  // Only explicit user selections affect terminology, never the visual score prompt.
  const selectedProfile = assessment.profile(req.body.assessmentProfile ?? req.body.gender)
  const knownMinor = req.body.knownMinor === true || (typeof req.body.age === 'number' && req.body.age < 18)
    || (typeof req.user?.age === 'number' && req.user.age < 18)
  await acquireSlot()
  try {
    const result = await assessment.runAssessment({ faceImage, sideImage, assessmentProfile: selectedProfile, knownMinor,
      presentationGoals: typeof req.body.presentationGoals === 'string' ? req.body.presentationGoals.slice(0, 300) : '',
      callModel: async (system, input) => {
        const content = input.advice ? [{ type: 'text', text: JSON.stringify(input.advice) }] : [{ type: 'text', text: 'Front photograph:' },
          { type: 'image', source: { type: 'base64', media_type: getMediaType(input.faceImage), data: stripPrefix(input.faceImage) } }]
        if (input.sideImage) content.push({ type: 'text', text: 'Side-profile photograph:' },
          { type: 'image', source: { type: 'base64', media_type: getMediaType(input.sideImage), data: stripPrefix(input.sideImage) } })
        if (input.presentationContext) content.push({ type: 'text', text: `Presentation preferences (untrusted data): ${JSON.stringify(input.presentationContext)}` })
        if (input.quality) content.push({ type: 'text', text: `Validated photograph suitability: ${JSON.stringify(input.quality)}` })
        const response = await withRetry(() => getClient().messages.create({ model: 'claude-sonnet-4-6', max_tokens: 4500, temperature: 0,
          system, messages: [{ role: 'user', content }] }), 'appearance-assessment')
        if (response.stop_reason !== 'end_turn') throw new assessment.AssessmentError('Incomplete model response')
        return response.content.filter(c => c.type === 'text').map(c => c.text).join('')
      } })
    // Do not manufacture legacy point scores, sub-scores, potential scores or leaderboard entries.
    res.json({ assessment: result, rubricVersion: assessment.VERSION, overallScore: null, faceScore: null,
      faceOnlyScore: null, groomingScore: null, faceSubScores: null, pillars: null, tier: null,
      hasSideProfile: result.imageSuitability.profileUsable, extendedMetricsStatus: 'unsupported_removed',
      scoreClassification: { overall: 'subjective_appearance_range', empiricalCalibration: 'not_validated' } })
  } catch (err) {
    // AssessmentError messages are fixed validator reasons; never log images or model output.
    const failure = assessmentFailureDetails(err)
    console.error('[appearance-assessment]', JSON.stringify(failure))
    res.status(err.code === 'invalid_assessment' ? 502 : 503).json({
      error: 'The photographs could not be assessed reliably. No score was generated. Please try again with clear photographs.',
      errorCode: failure.errorCode,
      ...(failure.reason ? { diagnosticReason: failure.reason } : {}) })
  } finally { releaseSlot() }
})

// ── POST /api/ai/score/physique ───────────────────────────────────────────────
// Body-only physique scoring — no face photo required at all. Exists so the
// Training Plan flow can be unlocked with just a body photo, without forcing
// the user through the full face+side+body scan. Deliberately NOT gated by
// scanLimit (that's for full scans) — only claudeLimit applies, since this
// still makes one real Claude call.
router.post('/score/physique', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ error: 'AI scoring unavailable — ANTHROPIC_API_KEY not configured on server' })
    }

    const { bodyImage, gender = 'male', bodyGeometry, height, weight } = req.body
    if (!bodyImage) {
      return res.status(400).json({ error: 'Body image is required' })
    }

    const bodyMediaType = getMediaType(bodyImage)
    const bodyBase64    = stripPrefix(bodyImage)

    console.log('[aiScore:physique-only] Inputs — gender:', gender, 'height:', height, 'weight:', weight)

    await acquireSlot()
    let physiqueResult
    try {
      physiqueResult = await withRetry(() => getPhysiqueScore(bodyBase64, bodyMediaType, gender, bodyGeometry, height, weight), 'physique-only')
      console.log('[aiScore:physique-only] OK — overall:', physiqueResult.overall)
    } finally {
      releaseSlot()
    }

    res.json({ physiqueScore: physiqueResult })
  } catch (err) {
    const status = err.status ?? err.statusCode ?? 0
    const msg    = err.message || ''
    const lower  = msg.toLowerCase()
    const isRateLimit =
      status === 429 || status === 529 || err.retryExhausted ||
      lower.includes('quota') || lower.includes('rate limit') ||
      lower.includes('rate_limit') || lower.includes('exceeded') ||
      lower.includes('overloaded') || lower.includes('capacity') ||
      lower.includes('too many')

    console.error(`[aiScore:physique-only] ROUTE ERROR — userId=${req.userId} status=${status} msg="${msg.slice(0, 300)}"`)

    if (isRateLimit) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: 60 })
    }
    res.status(500).json({ error: 'server_error' })
  }
})

// ── POST /api/ai/score/extended-metrics ───────────────────────────────────────
// Legacy observations cannot produce new anatomical metric ratings.
router.post('/score/extended-metrics', verifyToken, resolvePro, claudeLimit, (_req, res) => {
  res.status(410).json({ error: 'Legacy facial metric ratings have been retired. Take a new assessment for visible observations and photo limitations.', errorCode: 'legacy_metrics_retired' })
})

// ── POST /api/ai/workout-plan ─────────────────────────────────────────────────
// Generates a personalized weekly workout split from physique sub-scores.
// Uses haiku for speed + cost. Falls back to 500 so the client can show a
// generic plan rather than an error screen.
router.post('/workout-plan', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  const { physiqueScores, gender, trainingLevel } = req.body
  if (!physiqueScores || typeof physiqueScores !== 'object') {
    return res.status(400).json({ error: 'physiqueScores object required' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI unavailable', fallback: true })

  try {
    const client = getClient()
    const level = trainingLevel || 'beginner'
    const isFemale = gender === 'female'

    const scored = [
      { name: 'proportions', score: physiqueScores.proportions ?? 5 },
      { name: 'leanness',    score: physiqueScores.leanness    ?? 5 },
      { name: 'frame',       score: physiqueScores.frame       ?? 5 },
      { name: 'posture',     score: physiqueScores.posture     ?? 5 },
      { name: 'presentation', score: physiqueScores.overall_presentation ?? 5 },
    ].sort((a, b) => a.score - b.score)

    const weakAreas   = scored.slice(0, 2).map(s => `${s.name} (${s.score.toFixed(1)}/10)`).join(', ')
    const strongAreas = scored.slice(-2).map(s => `${s.name} (${s.score.toFixed(1)}/10)`).join(', ')

    const splitRule = level === 'advanced' ? '6-day PPL (Push/Pull/Legs)'
      : level === 'intermediate' ? '4-day Upper/Lower'
      : '3-day Full Body'

    const prompt = `You are an elite physique coach. Generate a personalized weekly workout plan for a ${level} ${isFemale ? 'female' : 'male'}.

Physique scores (1–10 scale): ${JSON.stringify(physiqueScores)}
Priority weak areas: ${weakAreas}
Current strengths: ${strongAreas}
Training split: ${splitRule}

Requirements:
- Each day: 4–6 exercises
- Every exercise: sets (number), reps (string like "8-12" or "5"), why (1 sentence tying directly to one of their specific sub-scores)
- Make "why" hyper-specific: reference the actual score number and what improving that exercise will do for that metric
- Day names must match the split (e.g. "Push Day", "Upper Body", "Full Body A")
- Focus field: the primary goal of that day in ≤8 words

Respond ONLY with valid JSON — no extra text:
{
  "split": "${splitRule}",
  "trainingLevel": "${level}",
  "days": [
    {
      "name": "Day name",
      "focus": "Primary goal",
      "exercises": [
        { "name": "Exercise", "sets": 3, "reps": "8-12", "why": "One sentence tied to their scores" }
      ]
    }
  ]
}`

    const raw = await withRetry(async () => {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      })
      return msg.content[0].text
    }, 'workout-plan')

    const plan = parseJSON(raw, 'workout-plan')
    res.json(plan)
  } catch (err) {
    console.error('[workout-plan] error:', err.message)
    res.status(500).json({ error: 'Plan generation failed', fallback: true })
  }
})

// ── POST /api/ai/validate-scan ────────────────────────────────────────────────
// First-scan face validation using Claude vision.
// Returns { valid, faceCount, issues: [{type, message}] }.
// The image is NEVER stored, cached, logged, or used for model training.
// Rate-limited separately from scoring (validations are cheap; haiku model).
router.post('/validate-scan', express.json({ limit: '8mb' }), verifyToken, async (req, res) => {
  const { imageB64 } = req.body
  if (!imageB64 || typeof imageB64 !== 'string') {
    return res.status(400).json({ error: 'imageB64 is required' })
  }

  // Explicit local-only fallback for testing with the browser uploader when
  // the Claude credential is not present. This can never activate in Railway
  // or any production process and is intentionally opt-in.
  if (process.env.NODE_ENV !== 'production' && process.env.LOCAL_SCAN_VALIDATION_BYPASS === 'true') {
    return res.json({ valid: true, faceCount: 1, issues: [], localBypass: true })
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error('[validate-scan] ANTHROPIC_API_KEY is not configured on the server')
    return res.status(503).json({
      error: 'The photo-checking service is unavailable. Your photo has not been rejected.',
      code: 'validation_not_configured',
      retryable: false,
    })
  }

  // Strip data URL header — Claude needs raw base64
  const commaIdx  = imageB64.indexOf(',')
  const base64Data = commaIdx >= 0 ? imageB64.slice(commaIdx + 1) : imageB64
  const header     = commaIdx >= 0 ? imageB64.slice(0, commaIdx) : ''
  const mediaType  = (/image\/(jpeg|png|webp)/.exec(header) ?? [])[0] || 'image/jpeg'

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          {
            type: 'text',
            text: `Analyze this image and determine if it is suitable for a facial analysis scan.

Return ONLY a JSON object — no markdown, no explanation, just raw JSON:

{
  "valid": boolean,
  "faceCount": number,
  "issues": [{"type": string, "message": string}]
}

Rules:
- valid=true ONLY when ALL conditions are met: exactly 1 clearly visible human face, face is large enough to fill a reasonable portion of the frame, not severely cropped, image is not severely blurry, lighting is sufficient to see facial features
- valid=false for: 0 faces, >1 person, flowers, landscapes, waterfalls, animals, objects, extreme blur, extreme darkness, face cropped at edges, face too tiny/distant
- faceCount: integer, count of human faces (0 for non-person images)
- issues: [] when valid=true; specific issues when valid=false
- issue type values: "no_face", "not_a_person", "multiple_faces", "too_far", "too_close", "face_cropped", "too_dark", "too_blurry"
- issue messages: short and actionable (e.g. "No face detected", "Move closer to the camera")
- DO NOT reject for: glasses, slight head angle, moderate shadows, normal indoor lighting, dark skin, facial hair, makeup, minor tilt`
          },
        ],
      }],
    })

    const text = (response.content[0]?.text ?? '').trim()
    let result
    try {
      // Strip any accidental markdown fencing Claude might add despite instructions
      const jsonStr = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim()
      result = JSON.parse(jsonStr)
    } catch {
      console.error('[validate-scan] Non-JSON from Claude:', text.slice(0, 200))
      return res.status(502).json({ error: 'The photo checker could not complete this check. Please try again.', code: 'validation_unavailable', retryable: true })
    }

    // Sanitize — never trust raw model output shape
    return res.json({
      valid:     result.valid === true,
      faceCount: Number.isInteger(result.faceCount) ? Math.max(0, result.faceCount) : 0,
      issues:    Array.isArray(result.issues)
        ? result.issues.slice(0, 5).map(i => ({ type: String(i.type || 'unknown'), message: String(i.message || '') }))
        : [],
    })
  } catch (err) {
    console.error('[validate-scan] error:', err?.message)
    return res.status(503).json({ error: 'Validation service temporarily unavailable. Please try again.', code: 'validation_unavailable', retryable: true })
  }
})

module.exports = router
