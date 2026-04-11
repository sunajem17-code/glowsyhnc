const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const crypto = require('crypto')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')

const router = express.Router()

// ── Score cache: hash(face+body) → full result ────────────────────────────────
// Prevents re-analyzing the same photos. Same photo = same score every time.
const scoreCache = new Map()

function hashImages(faceB64, bodyB64) {
  // Hash first 1000 chars — enough to fingerprint the image, fast to compute
  return crypto.createHash('sha256')
    .update(faceB64.slice(0, 1000) + '|' + bodyB64.slice(0, 1000))
    .digest('hex')
    .slice(0, 20)
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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
    model: 'claude-opus-4-5',
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
async function getCelebrityMatch(faceBase64, faceMediaType) {
  const client = getClient()
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    system: `You are a facial recognition and celebrity lookalike expert with knowledge of ALL famous people across every category including:
- Hollywood actors and actresses
- YouTubers (MrBeast, KSI, IShowSpeed, Kai Cenat, Duke Dennis, etc)
- Rappers and musicians (Drake, Kendrick, Travis Scott, Lil Baby, etc)
- Athletes (LeBron, Ronaldo, Giannis, Devin Booker, etc)
- Comedians and internet personalities (Druski, Kai Cenat, etc)
- TikTokers and Instagram influencers
- Models and public figures worldwide

Your ONLY job is to look at this face and find who they most resemble.

STEP 1: Analyze these exact traits:
- Face shape (oval/round/square/diamond/heart)
- Jaw definition (sharp/soft/wide/narrow)
- Cheekbone height (high/average/flat)
- Eye shape (almond/round/hooded/deep set)
- Nose shape (wide/narrow/upturned/straight/bulbous)
- Skin tone (light/medium/tan/dark/deep dark)
- Face fullness (lean/average/full/heavy)
- Facial hair style if present

STEP 2: Match to the famous person who most closely shares the SAME combination of these traits. If the person looks exactly like a specific celebrity, name that celebrity. If someone is famous themselves and submits their own photo, you may recognize and name them directly. Prioritize accuracy over flattery. A heavy set dark skinned person should match to heavy set dark skinned celebrities. A lean light skinned person should match to lean light skinned celebrities. NEVER match across completely different body types or skin tones.

STEP 3: Return ONLY this JSON:
{
  "match1": { "celebrity": "exact name", "similarity": 75, "shared_traits": "round face, dark skin, full cheeks" },
  "match2": { "celebrity": "exact name", "similarity": 68, "shared_traits": "wide nose, full face, soft jaw" },
  "match3": { "celebrity": "exact name", "similarity": 62, "shared_traits": "similar eye shape and skin tone" }
}

Hard rules:
- Max similarity score is 78 unless near identical match
- Must match skin tone
- Must match face fullness and body type visible in photo
- Include YouTubers, rappers, athletes, not just actors
- Be honest not flattering`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
        { type: 'text', text: 'Analyze this face and match to celebrities based on structural similarity only. Return ONLY the JSON.' },
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
    const cacheKeyRaw = skipBody ? faceBase64.slice(0, 1000) + '|SKIP' : faceBase64.slice(0, 1000) + '|' + stripPrefix(bodyImage).slice(0, 1000)
    const cacheKey = crypto.createHash('sha256').update(cacheKeyRaw).digest('hex').slice(0, 20)
    if (scoreCache.has(cacheKey)) {
      console.log('[aiScore] Cache hit:', cacheKey)
      return res.json(scoreCache.get(cacheKey))
    }

    let bodyResult, faceResult, celebResult

    if (skipBody) {
      // Only run face + celebrity — body defaults applied
      console.log('[aiScore] skipBody=true — running face + celebrity only...')
      ;[faceResult, celebResult] = await Promise.all([
        getFaceScore(faceBase64, faceMediaType, gender),
        getCelebrityMatch(faceBase64, faceMediaType).catch(err => {
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
        getBodyScore(bodyBase64, bodyMediaType),
        getFaceScore(faceBase64, faceMediaType, gender),
        getCelebrityMatch(faceBase64, faceMediaType).catch(err => {
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
      bodyScore:         Math.round(bodyScore     * 10) / 10,
      groomingScore:     Math.round(groomingScore * 10) / 10,
      bodyFatLevel:      bodyResult.body_category.toLowerCase(),
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
      bodySubScores: {
        shoulderWaistRatio:  r(bodySub.shoulder_waist_ratio),
        posture:             r(bodySub.posture),
        postureGrade:        bodySub.posture_grade || null,
        bodyProportions:     r(bodySub.body_proportions),
        bodyComposition:     r(bodySub.body_composition ?? bodyResult.body_score),
        compositionCategory: bodyResult.body_category,
      },
      bodyDetail: bodyResult.detail ?? null,
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
    res.status(500).json({ error: err.message || 'AI scoring failed' })
  }
})

module.exports = router
