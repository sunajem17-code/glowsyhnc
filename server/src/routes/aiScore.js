const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const crypto = require('crypto')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')

const router = express.Router()

// ── Score cache: hash(face+body) → full result ────────────────────────────────
// Prevents re-analyzing the EXACT same photos.
// IMPORTANT: must sample start + middle + end — JPEG headers are identical across
// photos from the same device, so slicing only the start caused everyone on the
// same phone model to get the first user's cached score.
const scoreCache = new Map()
// Force-clear cache on every deploy so stale bad-key entries can't persist
// (cache is in-memory only anyway — this is a no-op on fresh process starts)
scoreCache.clear()

function sampleB64(s) {
  if (!s) return 'null'
  const mid = Math.floor(s.length / 2)
  // Start (after any header), middle, end, plus total length as uniqueness signal
  return s.slice(200, 500) + '|' + s.slice(mid - 150, mid + 150) + '|' + s.slice(-300) + '|len=' + s.length
}

function hashImages(faceB64, bodyB64) {
  return crypto.createHash('sha256')
    .update(sampleB64(faceB64) + '||' + sampleB64(bodyB64))
    .digest('hex')
    .slice(0, 24)
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ── Concurrency queue ─────────────────────────────────────────────────────────
// At most MAX_CONCURRENT scoring requests run simultaneously.
// Additional requests are queued (FIFO) and run as slots free up.
const MAX_CONCURRENT = 2
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
// Retries fn up to 3 times on Anthropic 429 / 529 / overloaded responses.
// Backoff: 2 s → 4 s → 8 s (+ up to 500 ms jitter). Other errors throw immediately.
async function withRetry(fn, maxRetries = 3, baseDelayMs = 2000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = err.status ?? err.statusCode ?? 0
      const msg = (err.message || '').toLowerCase()
      const isRetryable =
        status === 429 ||
        status === 529 ||
        msg.includes('rate limit') ||
        msg.includes('rate_limit') ||
        msg.includes('overloaded') ||
        msg.includes('capacity')

      if (!isRetryable || attempt === maxRetries) throw err

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.warn(`[aiScore] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms — ${err.message?.slice(0, 80)}`)
      await new Promise(resolve => setTimeout(resolve, delay))
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

// ── CALL 1: Body Composition ──────────────────────────────────────────────────
// Focused entirely on body fat. Strict classifier.
async function getBodyScore(bodyBase64, bodyMediaType) {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: `You are a body composition classifier. You output ONLY a JSON object. No explanations. No text. Just JSON.

Classify body fat level from the image using these strict criteria:

OBESE: Large visible stomach, excess fat on chest/back/arms, no muscle definition visible
OVERWEIGHT: Noticeable fat accumulation, soft physique, some definition lost
AVERAGE: Normal fat distribution, not lean but not overweight
ATHLETIC: Visible muscle tone, low body fat, defined physique
LEAN_ATHLETIC: Clearly muscular, very low body fat, highly defined

Score mapping (NON-NEGOTIABLE):
- OBESE        → body_score: 2.0,  body_cap: 4.5
- OVERWEIGHT   → body_score: 3.5,  body_cap: 5.5
- AVERAGE      → body_score: 5.0,  body_cap: 10.0
- ATHLETIC     → body_score: 7.5,  body_cap: 10.0
- LEAN_ATHLETIC → body_score: 9.0, body_cap: 10.0

Return ONLY this JSON — no markdown, nothing else:
{
  "body_category": "<OBESE|OVERWEIGHT|AVERAGE|ATHLETIC|LEAN_ATHLETIC>",
  "body_score": <number>,
  "body_cap": <number>,
  "reasoning": "<one sentence max>",
  "sub_scores": {
    "shoulder_waist_ratio": <number 1.0–10.0, V-taper assessment>,
    "posture": <number 1.0–10.0, alignment and forward head posture>,
    "posture_grade": "<A|B|C|D|F>",
    "body_proportions": <number 1.0–10.0, torso-to-leg ratio and limb symmetry>,
    "body_composition": <number 1.0–10.0, same as body_score>
  },
  "detail": {
    "swr_estimate": "<shoulder-to-waist ratio string e.g. '1.35:1' — estimate from visible proportions>",
    "bf_range": "<estimated body fat % range e.g. '25-30' — two numbers only>",
    "posture_issues": ["<list each that applies: forward_head | rounded_shoulders | anterior_pelvic_tilt | none>"],
    "muscle_mass_rating": "<low|average|above_average|high>",
    "arm_development": "<underdeveloped|average|developed>",
    "chest_development": "<flat|average|developed>",
    "frame": "<narrow|average|wide>"
  }
}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: bodyMediaType, data: bodyBase64 } },
        { type: 'text',  text: 'Classify this body composition. Return ONLY the JSON.' },
      ],
    }],
  })

  return parseJSON(response.content[0]?.text?.trim() || '', 'Body scorer')
}

// ── CALL 2: Face + Grooming + 4 Pillars ──────────────────────────────────────
// Focused on facial structure, grooming, and the 4 aesthetic pillars.
// No body. No overall score. Pillars drive the aesthetic score in code.
async function getFaceScore(faceBase64, faceMediaType, gender) {
  const client = getClient()
  const isFemale = gender === 'female'
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 600,
    system: `You are a facial attractiveness and grooming analyst. You output ONLY a JSON object. No explanations. No text. Just JSON.

Score face and grooming on a 1.0–10.0 scale.

FACE SCORING — assess these features:
- Jawline definition and sharpness
- Cheekbone prominence
- Facial symmetry
- Eye area (shape, spacing, periorbital hollowing)
- Facial thirds ratio (forehead : midface : lower face)
- Skin quality and texture

SKIN CLARITY SCORING (skin_clarity sub-score) — MANDATORY RULES:
- Clear skin (no visible acne, scarring, blemishes, or hyperpigmentation) → MINIMUM 7.5/10
- Mostly clear with minor texture or slight unevenness → 6.5–7.5/10
- Some visible acne, active blemishes, or uneven skin tone → 5.0–6.5/10
- Significant acne, acne scarring, or hyperpigmentation → below 5.0/10
- CRITICAL: Clear smooth skin with no visible problems MUST score 7.5 or higher. Do NOT penalize healthy clear skin.
- Only score below 7.5 if you can visibly see blemishes, acne, scarring, or skin texture problems in the photo.
- If the skin appears smooth and even in tone, assume it is clear unless there is visible evidence otherwise.

Facial structure tiers (strict):
- "soft/round"  → no visible bone structure, round face, fat deposits on jaw: face_score MAX 5.0
- "average"     → some definition, typical bone structure: face_score MAX 6.5
- "defined"     → clear jawline and cheekbones: face_score up to 7.5
- "strong"      → sharp jaw, prominent cheekbones, elite bone structure: face_score up to 10.0

GROOMING SCORING — assess:
- Hair (clean, styled vs greasy/unkempt)
- Facial hair (groomed vs patchy/messy)
- Skin condition (clear vs acne/dull)
- Overall presentation

THE 4 PILLARS — rate each independently on 1.0–10.0:
- Harmony: How well all features work together as a cohesive unit. Consider facial symmetry, facial thirds balance, and overall visual balance.
- Angularity: Sharpness and definition of physical structure. Consider jawline sharpness, cheekbone prominence, brow ridge, chin projection, and overall facial definition.
- Features: Quality of individual facial features. Consider eye shape and size, nose shape and proportion, lip fullness, skin clarity, and overall feature quality.
- Dimorphism: How strongly the person expresses their biological sex characteristics. ${isFemale ? 'Rate femininity: soft features, high cheekbones, feminine facial structure.' : 'Rate masculinity: strong jaw, hunter eyes, brow ridge, defined bone structure.'}

Be honest. Do not inflate scores.

HAIR TYPE DETECTION — look at the hair visible in the photo and classify:
- "straight"   → hair lies flat, no curl pattern
- "wavy"       → loose S-wave pattern
- "curly"      → defined curls, ringlets, or coils (3a/3b/3c)
- "coily"      → tight coils or afro texture (4a/4b/4c)
- "locs"       → dreadlocks or locs visible
- "bald"       → shaved head or very close cut with no texture visible
- "unknown"    → hair not visible or cannot be determined from photo

Return ONLY this JSON — no markdown, nothing else:
{
  "face_score": <number 1.0–10.0>,
  "grooming_score": <number 1.0–10.0>,
  "facial_structure": "<soft/round|average|defined|strong>",
  "hair_type": "<straight|wavy|curly|coily|locs|bald|unknown>",
  "pillars": {
    "harmony": <number 1.0–10.0>,
    "angularity": <number 1.0–10.0>,
    "features": <number 1.0–10.0>,
    "dimorphism": <number 1.0–10.0>
  },
  "sub_scores": {
    "symmetry": <number 1.0–10.0>,
    "jawline_definition": <number 1.0–10.0>,
    "skin_clarity": <number 1.0–10.0>,
    "facial_proportions": <number 1.0–10.0>,
    "eye_area": <number 1.0–10.0>,
    "facial_harmony": <number 1.0–10.0>
  },
  "key_strengths": ["<strength 1>", "<strength 2>"],
  "key_weaknesses": ["<weakness 1>", "<weakness 2>"],
  "top_improvement": "<single most impactful improvement>"
}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
        { type: 'text',  text: `Score this ${gender === 'female' ? 'woman' : 'man'}'s face and grooming. Return ONLY the JSON.` },
      ],
    }],
  })

  return parseJSON(response.content[0]?.text?.trim() || '', 'Face scorer')
}

// ── CALL 3 (parallel): Celebrity Lookalike ────────────────────────────────────
// Runs in parallel with calls 1+2. Non-blocking — failure returns null gracefully.
// Uses claude-haiku-4-5-20251001 (high rate limits; sufficient for structured matching).
async function getCelebrityMatch(faceBase64, faceMediaType) {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 700,
    system: `You are a strict facial structure analyst. Your job is to match faces to celebrities based ONLY on measurable bone structure and physical features — never on vibes, fame, or flattery.

══ STEP 1: MEASURE THESE TRAITS FIRST (do this before thinking of any celebrity) ══

1. SKIN TONE — classify as one of: pale / light / medium / tan / brown / dark-brown / deep-dark
2. FACE SHAPE — classify as one of: oval / round / square / oblong / diamond / heart / triangle
3. JAW — classify as one of: sharp-angular / moderate / soft-rounded / wide-square / recessed
4. CHEEKBONES — classify as one of: prominent-high / average / flat / wide
5. EYES — classify as one of: almond / round / hooded / deep-set / wide-set / close-set / monolid
6. NOSE — classify as one of: wide-flat / broad / medium / narrow / upturned / aquiline / bulbous-tip
7. LIPS — classify as one of: full / medium / thin
8. FACE FULLNESS — classify as one of: very-lean / lean / average / full / heavy
9. ESTIMATED ETHNICITY — classify as one of: East-Asian / South-Asian / Southeast-Asian / Black-African / Black-American / Middle-Eastern / Latino / White-European / Mixed / Other

══ STEP 2: HARD MATCHING RULES (violations = wrong answer) ══

RULE 1 — SKIN TONE IS NON-NEGOTIABLE:
  - pale/light → ONLY match pale/light celebrities
  - medium/tan → ONLY match medium/tan celebrities
  - brown/dark-brown/deep-dark → ONLY match brown/dark celebrities
  - NEVER match across more than one skin tone category

RULE 2 — FACE SHAPE MUST MATCH:
  - round face → ONLY round-faced celebrities (Kevin Hart, Jack Black, etc.)
  - sharp jaw → ONLY sharp-jaw celebrities (Henry Cavill, Michael B Jordan, etc.)
  - soft jaw → ONLY soft-jaw celebrities
  - NEVER match a round soft face to a chiseled angular celebrity

RULE 3 — BODY TYPE MUST MATCH if visible:
  - heavy/full face → ONLY match stocky or full-faced celebrities
  - lean face → ONLY match lean celebrities
  - NEVER match a heavy person to a lean athletic celebrity

RULE 4 — ETHNICITY-AWARE POOL:
  Use the correct celebrity pool based on detected ethnicity:

  BLACK (African/American): Kevin Hart, Idris Elba, Michael B Jordan, Winston Duke, Kofi Siriboe,
    Dwayne Johnson (mixed), Drake, Kendrick Lamar, LeBron James, Giannis Antetokounmpo, Kai Cenat,
    Druski, IShowSpeed, Lil Baby, Travis Scott, Childish Gambino, Mahershala Ali, John Boyega,
    Anthony Joshua, Devin Booker, Steph Curry

  EAST ASIAN: BTS (Jin/RM/Jungkook/V/Suga/J-Hope/Jimin), Steven Yeun, John Cho, Simu Liu,
    Bruce Lee, Godfrey Gao, Song Joong-ki, Park Seo-jun, Lee Min-ho, Daniel Dae Kim, Shang-Chi

  SOUTH/SOUTHEAST ASIAN: Riz Ahmed, Kumail Nanjiani, Dev Patel, Ranveer Singh, Hrithik Roshan,
    Tiger Shroff, Vidyut Jammwal

  MIDDLE EASTERN: Rami Malek, Oscar Isaac (Guatemalan/Cuban), Marwan Kenzari, Tahar Rahim

  LATINO: Bad Bunny, J Balvin, Ozuna, Maluma, Oscar Isaac, Michael Pena, Diego Luna, Gael Garcia Bernal

  WHITE EUROPEAN/AMERICAN: Zac Efron, Tom Holland, Timothée Chalamet, Jacob Elordi, Austin Butler,
    Chris Evans, Ryan Reynolds, Brad Pitt, Leonardo DiCaprio, Harry Styles, Adam Driver,
    Paul Mescal, Pedro Pascal, Kit Harington, Henry Cavill, Charlie Hunnam, Chris Hemsworth,
    MrBeast (Jimmy Donaldson), PewDiePie, KSI (mixed)

  MIXED/AMBIGUOUS: The Weeknd, Bruno Mars, KSI, Dwayne Johnson, Keanu Reeves, Zayn Malik

RULE 5 — SIMILARITY SCORES MUST BE HONEST:
  - 75–78%: Very strong match, multiple features align precisely
  - 65–74%: Good match, primary structural features align
  - 55–64%: Moderate match, some features align but differences are notable
  - Below 55%: Weak match — if this is the best you can do, say so explicitly
  - NEVER give 80%+ unless near-identical
  - Most honest matches will be 60–72%

RULE 6 — SHARED TRAITS MUST BE SPECIFIC AND MEASURABLE:
  BAD: "similar vibe", "both look cool", "same energy"
  GOOD: "both have wide-set almond eyes, broad nose, and round face with full cheeks"
  GOOD: "matching sharp square jaw, high cheekbones, and deep-set eyes"
  Every shared_traits field must name at least 2 specific anatomical features.

RULE 7 — IF NO GOOD MATCH EXISTS:
  Give the closest honest match with similarity 55–58% and explain in shared_traits
  exactly what makes it a weak match (e.g. "closest match available — similar nose shape
  but jaw and face fullness differ significantly").

══ STEP 3: OUTPUT ══

Return ONLY this JSON — no markdown, no explanation, nothing else:
{
  "match1": { "celebrity": "Full Name", "similarity": <number 55–78>, "shared_traits": "<2+ specific anatomical features>" },
  "match2": { "celebrity": "Full Name", "similarity": <number 55–75>, "shared_traits": "<2+ specific anatomical features>" },
  "match3": { "celebrity": "Full Name", "similarity": <number 55–72>, "shared_traits": "<2+ specific anatomical features>" }
}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
        { type: 'text', text: 'Follow the 3-step process. Measure traits first, apply all matching rules, then return the JSON.' },
      ],
    }],
  })
  return parseJSON(response.content[0]?.text?.trim() || '', 'Celebrity matcher')
}

// ── CALL 4: Final score in CODE — AI never touches this ──────────────────────
//
// Normal weights: Aesthetic (4-pillar avg) 55% · Body 35% · Grooming 10%
// Skip-body weights: Aesthetic 70% · Grooming 30% (no body cap applied)
// Body cap enforced with Math.min() — no AI involvement
//
function calculateFinalScore(bodyResult, faceResult, gender = 'male', skipBody = false) {
  const clamp = (v, fallback = 5.0) => Math.min(Math.max(Number(v) || fallback, 1.0), 10.0)

  // 4 Pillars — average becomes the aesthetic (face) component
  const p = faceResult.pillars || {}
  const harmony     = clamp(p.harmony)
  const angularity  = clamp(p.angularity)
  const features    = clamp(p.features)
  const dimorphism  = clamp(p.dimorphism)
  const pillarAvg   = (harmony + angularity + features + dimorphism) / 4

  // Use pillar average if available, otherwise fall back to raw face_score
  const hasPillars = p.harmony != null && p.angularity != null && p.features != null && p.dimorphism != null
  const faceScore     = hasPillars ? Math.round(pillarAvg * 10) / 10 : clamp(faceResult.face_score)
  const bodyScore     = clamp(bodyResult.body_score)
  const groomingScore = clamp(faceResult.grooming_score)
  const bodyCap       = clamp(bodyResult.body_cap, 10.0)

  let weighted, capped
  if (skipBody) {
    // Face 70% + Grooming 30% — no body cap
    weighted = faceScore * 0.70 + groomingScore * 0.30
    capped = weighted
  } else {
    // Weighted average: aesthetic 55%, body 35%, grooming 10%
    weighted = faceScore * 0.55 + bodyScore * 0.35 + groomingScore * 0.10
    // Enforce body cap in code — Math.min() — AI cannot override this
    capped = Math.min(weighted, bodyCap)
  }

  // Round to 1 decimal
  const final = Math.round(capped * 10) / 10

  const bodyFatCapApplied = capped < weighted

  // Tier assignment — exact ranges, gender-aware
  let tier
  if (gender === 'female') {
    if      (final >= 9.5) tier = 'True Eve'
    else if (final >= 8.5) tier = 'Eve'
    else if (final >= 7.0) tier = 'Stacey'
    else if (final >= 6.0) tier = 'High Tier Becky'
    else if (final >= 5.0) tier = 'Mid Tier Becky'
    else if (final >= 4.0) tier = 'Low Tier Becky'
    else                   tier = 'Sub 3'
  } else {
    if      (final >= 9.5) tier = 'True Adam'
    else if (final >= 8.5) tier = 'Adam Lite'
    else if (final >= 7.5) tier = 'Chad'
    else if (final >= 7.0) tier = 'Chadlite'
    else if (final >= 6.0) tier = 'High Tier Normie'
    else if (final >= 5.0) tier = 'Mid Tier Normie'
    else if (final >= 4.0) tier = 'Low Tier Normie'
    else                   tier = 'Sub 3'
  }

  return { final, tier, bodyFatCapApplied, faceScore, bodyScore, groomingScore, harmony, angularity, features, dimorphism, hasPillars }
}

// ── Route ─────────────────────────────────────────────────────────────────────
// verifyToken accepts demo-token as a rate-limited guest (see claudeGate.js).
// resolvePro sets req.isPro so scanLimit can skip the cap for Pro users.
router.post('/score', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  await acquireSlot()
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ error: 'AI scoring unavailable — ANTHROPIC_API_KEY not configured on server' })
    }

    const { faceImage, bodyImage, gender = 'male', skipBody = false } = req.body
    if (!faceImage) {
      return res.status(400).json({ error: 'Face image is required' })
    }
    if (!skipBody && !bodyImage) {
      return res.status(400).json({ error: 'Body image is required (or pass skipBody: true)' })
    }

    // Detect actual media type BEFORE stripping the prefix
    const faceMediaType = getMediaType(faceImage)
    const faceBase64 = stripPrefix(faceImage)

    // ── Cache check — same photo always returns same score ─────────────────────
    const bodyB64ForCache = skipBody ? null : stripPrefix(bodyImage)
    const cacheKey = hashImages(faceBase64, bodyB64ForCache ?? 'SKIP')
    if (scoreCache.has(cacheKey)) {
      console.log('[aiScore] Cache hit:', cacheKey)
      return res.json(scoreCache.get(cacheKey))
    }

    let bodyResult, faceResult, celebResult

    if (skipBody) {
      // Only run face + celebrity — body defaults applied
      console.log('[aiScore] skipBody=true — running face + celebrity only...')
      ;[faceResult, celebResult] = await Promise.all([
        withRetry(() => getFaceScore(faceBase64, faceMediaType, gender)),
        withRetry(() => getCelebrityMatch(faceBase64, faceMediaType)).catch(err => {
          console.warn('[aiScore] Celebrity match failed (non-fatal):', err.message)
          return null
        }),
      ])
      bodyResult = {
        body_category: 'NOT_PROVIDED',
        body_score: 5.0,
        body_cap: 10.0,
        reasoning: 'Body photo not provided — using neutral default score.',
        sub_scores: { shoulder_waist_ratio: null, posture: null, posture_grade: null, body_proportions: null, body_composition: 5.0 },
        detail: null,
      }
    } else {
      const bodyMediaType = getMediaType(bodyImage)
      const bodyBase64 = stripPrefix(bodyImage)
      console.log('[aiScore] Media types — face:', faceMediaType, '| body:', bodyMediaType)

      // Run body + face + celebrity calls in parallel — all fully independent
      console.log('[aiScore] Starting body + face + celebrity scoring in parallel...')
      ;[bodyResult, faceResult, celebResult] = await Promise.all([
        withRetry(() => getBodyScore(bodyBase64, bodyMediaType)),
        withRetry(() => getFaceScore(faceBase64, faceMediaType, gender)),
        withRetry(() => getCelebrityMatch(faceBase64, faceMediaType)).catch(err => {
          console.warn('[aiScore] Celebrity match failed (non-fatal):', err.message)
          return null
        }),
      ])
      console.log('[aiScore] Body:', bodyResult.body_category, bodyResult.body_score, '| cap:', bodyResult.body_cap)
    }

    console.log('[aiScore] Face:', faceResult.face_score, '| grooming:', faceResult.grooming_score, '| structure:', faceResult.facial_structure)
    console.log('[aiScore] Celebrity:', celebResult ? celebResult.match1?.celebrity : 'unavailable')

    // Final score: pure code — no AI involvement
    const { final, tier, bodyFatCapApplied, faceScore, bodyScore, groomingScore, harmony, angularity, features, dimorphism, hasPillars } = calculateFinalScore(bodyResult, faceResult, gender, skipBody)
    console.log('[aiScore] Final:', final, tier, '| cap applied:', bodyFatCapApplied)
    console.log('[aiScore] Pillars — H:', harmony, 'A:', angularity, 'F:', features, 'D:', dimorphism)

    const faceSub = faceResult.sub_scores || {}
    const bodySub = bodyResult.sub_scores || {}
    const r = (v) => v != null ? Math.round(Number(v) * 10) / 10 : null

    const result = {
      overallScore:      final,
      faceScore:         Math.round(faceScore    * 10) / 10,
      bodyScore:         skipBody ? null : Math.round(bodyScore * 10) / 10,
      groomingScore:     Math.round(groomingScore * 10) / 10,
      bodyFatLevel:      skipBody ? null : bodyResult.body_category.toLowerCase(),
      bodySkipped:       skipBody || false,
      bodyFatCapApplied,
      tier,
      facialStructure:   faceResult.facial_structure,
      hairType:          faceResult.hair_type ?? 'unknown',
      faceSubScores: {
        symmetry:          r(faceSub.symmetry),
        jawlineDefinition: r(faceSub.jawline_definition),
        skinClarity:       r(faceSub.skin_clarity),
        facialProportions: r(faceSub.facial_proportions),
        eyeArea:           r(faceSub.eye_area),
        facialHarmony:     r(faceSub.facial_harmony),
      },
      bodySubScores: skipBody ? null : {
        shoulderWaistRatio:  r(bodySub.shoulder_waist_ratio),
        posture:             r(bodySub.posture),
        postureGrade:        bodySub.posture_grade || null,
        bodyProportions:     r(bodySub.body_proportions),
        bodyComposition:     r(bodySub.body_composition ?? bodyResult.body_score),
        compositionCategory: bodyResult.body_category,
      },
      bodyDetail: skipBody ? null : (bodyResult.detail ?? null),
      pillars: hasPillars ? {
        harmony:    Math.round(harmony    * 10) / 10,
        angularity: Math.round(angularity * 10) / 10,
        features:   Math.round(features   * 10) / 10,
        dimorphism: Math.round(dimorphism * 10) / 10,
      } : null,
      keyStrengths:      faceResult.key_strengths,
      keyWeaknesses:     faceResult.key_weaknesses,
      topImprovement:    faceResult.top_improvement,
      bodyReasoning:     bodyResult.reasoning,
      celebrityMatches:  celebResult
        ? [celebResult.match1, celebResult.match2, celebResult.match3]
            .filter(Boolean)
            .map(m => ({
              celebrity:    m.celebrity,
              similarity:   m.similarity,
              reason:       m.shared_traits ?? m.reason ?? '',
              shared_traits: m.shared_traits ?? m.reason ?? '',
            }))
        : null,
      faceTraits: celebResult?.face_traits ?? null,
    }

    // Store in cache (cap at 500 entries to prevent memory leak)
    if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
    scoreCache.set(cacheKey, result)

    res.json(result)
  } catch (err) {
    console.error('[aiScore] Error:', err.message)
    const msg = (err.message || '').toLowerCase()
    const status = err.status ?? err.statusCode ?? 0
    const isRateLimit =
      status === 429 || status === 529 ||
      msg.includes('quota') || msg.includes('rate limit') ||
      msg.includes('rate_limit') || msg.includes('exceeded') ||
      msg.includes('overloaded') || msg.includes('capacity')

    if (isRateLimit) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: 30 })
    }
    res.status(500).json({ error: err.message || 'AI scoring failed' })
  } finally {
    releaseSlot()
  }
})

module.exports = router
