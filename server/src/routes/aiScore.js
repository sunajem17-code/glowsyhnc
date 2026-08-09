const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const crypto = require('crypto')
const { verifyToken, claudeLimit, scanLimit, resolvePro } = require('../middleware/claudeGate')
const { getScanCache, setScanCache, saveScanHistory } = require('../supabase')
const { getTier } = require('../lib/tier')
const { updateLeaderboard } = require('./leaderboard')

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

function hashImages(faceB64, bodyB64, sideB64 = null) {
  return crypto.createHash('sha256')
    .update(sampleB64(faceB64) + '||' + sampleB64(bodyB64) + '||' + (sideB64 ? sampleB64(sideB64) : 'noside'))
    .digest('hex')
    .slice(0, 24)
}

// Full SHA256 over complete image content — used for the persistent Supabase cache.
// Unlike hashImages() (which samples), this hashes the entire base64 payload so
// two different images can never produce the same key. Prefix must already be stripped.
function computeFullHash(faceB64, bodyB64, sideB64 = null) {
  const h = crypto.createHash('sha256')
  h.update(faceB64)
  h.update('||')
  h.update(bodyB64 ?? 'skip')
  h.update('||SIDE:')
  h.update(sideB64 ?? 'noside')
  h.update('||v3') // bump to bust Supabase cache — Rekognition path replaces Claude lookalike
  return h.digest('hex') // 64-char hex string
}

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
      const isRetryable = is429 || is529

      const typeTag = is429 ? '429_RATE_LIMIT' : is529 ? '529_OVERLOADED' : `${status}_ERROR`

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

// ── CALL 1: Core score — Face + Grooming + 4 Pillars (+ optional side profile) ──
// Focused on facial structure, grooming, and the 4 aesthetic pillars. This is
// deliberately the SMALL/FAST call — the 30-metric extended breakdown lives in
// its own call (getExtendedMetrics, below) so the user's core result doesn't
// wait on generating 30 extra {score, descriptor} pairs. Splitting cut the
// time-to-first-result roughly in half in real testing (~35s combined ->
// ~18s core alone), since output-token generation dominates latency here,
// not image/input processing.
// When sideBase64 is provided a second image is sent and profile metrics are
// returned in the "profile" key. No body. No overall score.
async function getCoreScore(faceBase64, faceMediaType, gender, sideBase64 = null, sideMediaType = null, sideProfileGeometry = null) {
  const client = getClient()
  const isFemale = gender === 'female'
  const hasSide = !!sideBase64

  // sideProfileGeometry (when present) comes from Apple's Vision framework
  // running VNDetectFaceLandmarksRequest on-device against the actual side
  // profile photo — a real angle computed from detected landmark pixels,
  // not a visual guess. It's a 2D projection (no depth, unlike the ARKit
  // front-face mesh) so it's an estimate too, just a measured one — give
  // the model a factual anchor without overriding its own visual read.
  const measuredGeometryNote = (hasSide && sideProfileGeometry?.facialConvexityDegrees != null)
    ? `\nMEASURED REFERENCE (from on-device landmark detection, not a visual estimate): facial convexity angle ≈ ${sideProfileGeometry.facialConvexityDegrees.toFixed(1)}°. A straighter/more obtuse angle reads as a flatter profile; a sharper angle reads as more convex/protrusive. Use this as a factual anchor for jawline_projection and chin_projection — don't contradict it without clear photographic reason, but your visual read still governs profile_score and nose_bridge.`
    : ''

  const profileSection = hasSide ? `

SIDE PROFILE ANALYSIS — A side-profile photo has been provided as Image 2. Analyze the lateral view:
- profile_score: Overall lateral facial aesthetics 1.0–10.0. Strong jaw/chin projection, tall straight nose bridge, and forward mid-face score highest.
- nose_bridge: "soft" (low/flat bridge), "medium" (average height), "strong" (tall and straight), or "aquiline" (curved/Roman nose).
- jawline_projection: "recessed" (jaw sits behind vertical), "average" (neutral), "projected" (forward jaw), or "strong" (strong forward projection).
- chin_projection: "recessed" (chin behind Ricketts E-line), "average" (on the line), "projected" (slightly ahead), or "prominent" (well ahead of E-line).${measuredGeometryNote}
Include a "profile" object in your JSON response.` : ''

  const profileSchema = hasSide ? `,
  "profile": {
    "profile_score": <number 1.0–10.0>,
    "nose_bridge": "<soft|medium|strong|aquiline>",
    "jawline_projection": "<recessed|average|projected|strong>",
    "chin_projection": "<recessed|average|projected|prominent>"
  }` : ''

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    // extended_metrics (30 more {score, descriptor} pairs) moved to its own
    // call (getExtendedMetrics) — this budget only needs to cover the core
    // fields + optional profile block now.
    max_tokens: hasSide ? 1300 : 1100,
    temperature: 0,
    system: `You are a facial attractiveness and grooming analyst. You output ONLY a JSON object. No explanations. No text. Just JSON.

Score face and grooming on a 1.0–10.0 scale.

SCORE DISTRIBUTION — READ FIRST, applies to every 1.0–10.0 score in this prompt (face_score, pillars, sub_scores, face_metrics):
Think of scores as a bell curve across the general population, not a curve of dating-app profile photos or influencers:
- 5.0 is the TRUE MIDDLE — an average person you'd pass on the street, nothing notably attractive or unattractive about them. This is where MOST people land, not a "bad" score.
- 3.0 — below-average on a given metric: e.g. weak/undefined jawline hidden by fat, visibly asymmetric features, noticeable acne. Common, not rare.
- 7.0 — clearly above-average: e.g. a visibly defined jawline, above-average symmetry, healthy even skin. This is a genuinely "good" score — do not reserve 7+ for only exceptional cases.
- 9.0 — genuinely exceptional, model/celebrity-tier on that specific metric. This should be rare — most photos, even good-looking ones, should NOT get a 9 across the board.
Do not compress everyone into 6–8 out of a desire to be polite or avoid a "harsh" number — an accurate 3 or 4 is exactly as valid an output as an accurate 8 or 9 when the photo supports it. A realistic population sample run through this prompt should produce scores spread across the full 1–10 range, roughly centered on 5, not clustered at 7–8.

FACE SCORING — assess these features:
- ${isFemale ? 'Facial softness, high cheekbones, feminine bone structure, large eyes, full lips' : 'Jawline definition and sharpness, cheekbone prominence, brow ridge, masculine structure'}
- Facial symmetry
- Eye area (shape, spacing, periorbital hollowing)
- Facial thirds ratio (forehead : midface : lower face)
- Skin quality and texture

SKIN CLARITY SCORING (skin_clarity sub-score) — use the full range, calibrated to the general population, not just "acne vs no acne":
- 9.0–10.0 → Exceptional: poreless, even tone, visible glow/luminosity, zero texture irregularities. Rare — top few percent.
- 7.0–8.9  → Clear and healthy: no active blemishes, good tone evenness. Some normal minor texture (visible pores, faint lines) is fine and does not disqualify this tier.
- 5.0–6.9  → Average: generally acceptable skin with visible texture, minor unevenness, occasional blemish, mild redness, or dullness — this is the most common real-world outcome, not a penalty tier.
- 3.0–4.9  → Below average: noticeable acne, uneven tone, visible scarring, or dullness a viewer would register at a glance.
- 1.0–2.9  → Poor: significant active acne, heavy scarring, or pronounced hyperpigmentation.
Do not default to 7.5+ just because no acne is visible — "no visible problems" describes most people's skin and belongs in the 5.0–6.9 average band, not the 7+ tier. Reserve 7+ for skin that reads as genuinely healthy/even, not merely "not broken out."

SYMMETRY SCORING (symmetry sub-score) — use these anchors:
- 9.0–10.0 → Near-perfect left-right mirror symmetry, no visible asymmetry in eyes, brows, or jaw.
- 7.0–8.9  → Good symmetry with only minor, hard-to-notice asymmetry.
- 5.0–6.9  → Average — most people have some visible asymmetry (one eye slightly higher, jaw slightly off-center) at this level; this is normal, not a flaw.
- 3.0–4.9  → Noticeable asymmetry visible without close inspection.
- 1.0–2.9  → Pronounced, immediately obvious facial asymmetry.
${isFemale ? '- FEMALE: Skin and grooming are weighted MORE heavily. Clear glowing skin, neat brows, healthy hair are major scoring factors.' : ''}

${isFemale ? `FEMALE FACIAL STRUCTURE TIERS (strict):
- "heavy"       → significant facial fat obscuring all bone structure, puffy: face_score MAX 4.5
- "soft/round"  → round face with soft features, minimal bone definition — CAN be attractive for females: face_score MAX 6.5
- "average"     → typical female bone structure, some definition: face_score MAX 7.5
- "defined"     → visible cheekbones, clean facial lines, feminine bone structure: face_score up to 8.5
- "elite"       → high cheekbones, perfect facial thirds, model-tier feminine structure: face_score up to 10.0

FEMALE JAWLINE RULES — different from males:
- Soft rounded jaw on a female = feminine = POSITIVE. Do NOT penalize soft jaws on females.
- A very sharp masculine jaw on a female = reduces femininity = may lower Dimorphism score.
- Ideal female jaw: softly defined, not overly sharp, blends smoothly into neck.` :
`Facial structure tiers (strict):
- "soft/round"  → no visible bone structure, round face, fat deposits on jaw: face_score MAX 5.0
- "average"     → some definition, typical bone structure: face_score MAX 6.5
- "defined"     → clear jawline and cheekbones: face_score up to 7.5
- "strong"      → sharp jaw, prominent cheekbones, elite bone structure: face_score up to 10.0`}

GROOMING SCORING — assess:
- Hair (clean, styled vs greasy/unkempt)
${isFemale ? '- Makeup application (enhances natural features vs absent or heavy)' : '- Facial hair (groomed vs patchy/messy)'}
- Skin condition (clear vs acne/dull)
- Overall presentation
${isFemale ? '- FEMALE: Grooming is weighted 1.5× more than for males. Neat brows, healthy hair, and clear skin heavily boost the score.' : ''}

THE 4 PILLARS — rate each independently on 1.0–10.0:
- Harmony: How well all features work together as a cohesive unit. Consider facial symmetry, facial thirds balance, and overall visual balance.
- Angularity: ${isFemale ?
  `For females — assess FEMININE facial refinement, NOT masculine sharpness.
  FEMALE ANGULARITY SCORING RUBRIC — use the full range, narrow tiers below, calibrated to the general population:
  9.0–10.0 → Elite/distinctive feminine structure: high prominent cheekbones, clean facial lines, refined jaw, model-tier bone structure. Rare — top few percent, not just "pretty."
  7.0–8.9  → Strong feminine definition: visible cheekbones, clean jawline, refined structure that reads as distinctive, not merely pleasant. A real above-average score — but reserve 8+ specifically for structure that stands out, not decent structure that's simply fine.
  5.0–6.9  → Average: some cheekbone presence, typical feminine structure, some softness. This is where MOST women land — average bone structure is the common case, not a deficiency.
  3.0–4.9  → Below-average structure: cheekbones sit flat with no forward projection or visible height, the jawline is full and rounds directly into the neck with no distinct edge or corner, and the face reads as soft throughout with no bone landmarks breaking the surface. This is a common, honest read when structural definition is genuinely absent — not a harsher judgment than the evidence supports.
  1.0–2.9  → Poor structure: heavy or round face, no visible bone structure.
  CRITICAL: reserve 8.0+ for structure that is genuinely distinctive — high prominent cheekbones AND clean refined jaw together, the kind of face that stands out for its structure specifically. A face with decent-but-ordinary definition (some cheekbone presence, nothing that jumps out) belongs in the 5.0–6.9 average band, not 7+. Most faces — including conventionally attractive ones — have average bone structure; distinctive structure is uncommon by definition.
  Equally, a full face with minimal bone definition must land in the 3.0–4.9 band, not be rounded up to 5+ out of politeness.` :
  `Sharpness and definition of physical structure. This is the PRIMARY structural pillar.
  ANGULARITY SCORING RUBRIC — MANDATORY. Use the full range, narrow tiers below, calibrated to the general population — do not let genuinely average structure drift into the 6-7+ range.
  9.0–10.0 → Elite/distinctive bone structure: razor-sharp jawline with defined gonial angle, highly prominent cheekbones, strong visible brow ridge, forward chin projection, zero visible facial fat obscuring bone. Genuinely rare — top few percent, not just "solidly good."
  7.0–8.9  → Strong, clearly defined structure: sharp jawline, visible prominent cheekbones, good brow definition, lean facial structure. A real above-average score — but reserve 8+ specifically for structure that's distinctive at a glance, not merely competent.
  5.0–6.9  → Average: jawline visible but soft, cheekbones present but not prominent, typical bone structure with some softness or minor fat coverage. This is where MOST people land — average bone structure is not a deficiency, it's the common case.
  3.0–4.9  → Below-average structure: jawline is soft and undefined with no visible gonial angle — the lower face curves smoothly into the neck with no distinct corner where jaw meets ear. Cheekbones sit flat against the face with no forward projection or shadow beneath them. Brow ridge is minimal or flat, adding no visible ledge above the eyes. Facial fat softens or fully obscures whatever bone structure is underneath. This is a common, honest read when jaw and cheekbone definition are genuinely absent from the photo — not a harsher judgment than the evidence supports.
  1.0–2.9  → Poor angularity: round or heavy face, no visible bone structure at all.
  CRITICAL: reserve 8.5+ for bone structure that is genuinely distinctive — visibly sharp jaw AND prominent cheekbones AND strong brow ridge together, the kind of face that stands out in a crowd for its structure specifically. A face with decent-but-ordinary definition (jawline visible, some cheekbone presence, nothing that jumps out) belongs in the 5.0–6.9 average band, not 7+. Most faces — including conventionally fine-looking ones — have average bone structure; distinctive structure is uncommon by definition.
  Equally, a face with a soft or undefined jaw and minimal cheekbone visibility must land in the 3.0–4.9 band, not be rounded up to 5+ out of politeness.`}

- Features: Quality of individual facial features. ${isFemale ? 'Consider eye size and shape (large almond eyes score highest), nose refinement, lip fullness, brow shape, and skin clarity. Skin clarity is weighted 1.5× for females.' : 'Consider eye shape and size, nose shape and proportion, lip fullness, skin clarity, and overall feature quality.'}
- Dimorphism: ${isFemale ?
  `Rate FEMININITY — how strongly this face expresses feminine sex characteristics.
  FEMININITY SCORING RUBRIC — use the full range, calibrated to the general population:
  9.0–10.0 → Extremely high feminine dimorphism: large eyes, high soft cheekbones, delicate jaw, smooth features — unmistakably, strikingly feminine at a glance. Rare.
  7.0–8.9  → Clearly feminine: soft jaw, notable cheekbone softness, refined features — above-average feminine expression, distinctive rather than merely typical.
  5.0–6.9  → Average femininity: typical female features, nothing that stands out as especially delicate or masculine-leaning. Most women land here.
  3.0–4.9  → Below-average feminine expression: the jaw is heavier or squarer and does not taper toward the chin, the brow ridge is flatter or more prominent than the soft arch typical of feminine brows, and the overall bone structure reads as more neutral or masculine-leaning rather than distinctly feminine.
  1.0–2.9  → Notably masculine-leaning features for a female face.
  Reserve 8+ for femininity that is genuinely striking, not just present — an ordinary, unremarkable-but-clearly-female face belongs in the 5.0–6.9 average band.` :
  `Rate masculinity: strong jaw, hunter eyes, brow ridge, defined bone structure.
  MASCULINITY SCORING RUBRIC — use the full range, calibrated to the general population:
  9.0–10.0 → Extremely high masculine dimorphism: heavy brow ridge, deep-set "hunter" eyes, wide strong jaw, thick neck — reads as unmistakably, powerfully masculine at a glance. Rare.
  7.0–8.9  → Clearly masculine: visible brow ridge, defined jaw, masculine proportions — above-average masculine expression, distinctive rather than merely typical.
  5.0–6.9  → Average masculinity: typical male features, some brow/jaw presence, nothing that stands out as especially masculine or soft. Most men land here.
  3.0–4.9  → Below-average masculine expression: brow ridge is flat with no shadow or protrusion over the eyes, the jaw is narrow or tapered rather than wide, the face shape reads as round or soft rather than angular, and the neck is slender without visible thickness. The face reads as mild or gender-neutral rather than distinctly masculine — this is common, not a flaw.
  1.0–2.9  → Very low masculine expression: notably soft/rounded features for a male face.
  Reserve 8+ for masculinity that is genuinely striking, not just present — an ordinary, unremarkable-but-clearly-male face belongs in the 5.0–6.9 average band.`}

Be honest and accurate — this cuts both ways. High scores (9+) for elite bone structure ARE the honest score when the evidence supports it, and low scores (3–4) for below-average structure are equally honest and should be used just as readily. Accuracy means using the full range in both directions, not clustering in the middle OR only being willing to go high.

HAIR TYPE DETECTION — look at the hair visible in the photo and classify:
- "straight"   → hair lies flat, no curl pattern
- "wavy"       → loose S-wave pattern
- "curly"      → defined curls, ringlets, or coils (3a/3b/3c)
- "coily"      → tight coils or afro texture (4a/4b/4c)
- "locs"       → dreadlocks or locs visible
- "bald"       → shaved head or very close cut with no texture visible
- "unknown"    → hair not visible or cannot be determined from photo

PERCEIVED ETHNICITY — classify the most visually apparent ethnic background from facial features only. Use the closest single match:
- "white"         → Northern/Southern/Eastern European ancestry
- "black"         → Sub-Saharan African ancestry
- "east_asian"    → East Asian (Chinese, Japanese, Korean, Southeast Asian)
- "south_asian"   → South Asian (Indian, Pakistani, Bangladeshi, Sri Lankan)
- "latino"        → Latin American or Hispanic (regardless of skin tone)
- "middle_eastern"→ Arab, Persian, Turkish, or Levantine ancestry
- "mixed"         → Clearly mixed or ambiguous — cannot confidently assign one group
Base this only on visual facial features visible in the photo. If uncertain, use "mixed".

FACE METRICS — for each metric provide a score (1.0–10.0) and a one-line descriptor (max 10 words) of exactly what you observe:
- jawline: sharpness, gonial angle definition, and visible edge clarity
- cheekbones: height, prominence, and forward projection of the malar bones
- symmetry: left-right balance of features, spacing, and facial midline
- skin_quality: surface clarity, texture uniformity, and visible skin condition
- masculinity_femininity: strength of ${isFemale ? 'feminine' : 'masculine'} sex-specific facial characteristics
- facial_thirds: balance of forehead (upper) : mid-face (middle) : chin/jaw (lower) thirds
Descriptor rules: describe what IS there, not what is missing. Max 10 words. No filler phrases ("overall", "somewhat", "rather").
${profileSection}
KEY STRENGTHS — MANDATORY: return EXACTLY 2 items in key_strengths. Each item MUST name a specific observable facial feature from this face (e.g. jawline, cheekbones, symmetry, skin, eye area, facial thirds, brow ridge). Write a complete sentence explaining WHY that feature scores well — the exact structural or visual trait that makes it attractive and what it contributes to the overall look. Generic or vague observations ("good overall appearance", "balanced features") are not allowed — name the specific feature and describe what you actually see. Example: "Your jawline shows strong gonial angle definition and visible lower-face edge clarity — this creates facial shadow and the angular frame that drives high attractiveness ratings."

TOP IMPROVEMENT — write 3–4 sentences. (1) Name the weakest specific trait by name. (2) Explain exactly what makes it score low — describe the specific structural or visual evidence observable in this face. (3) Give a concrete, specific protocol: what type of product, routine, or action and how often — not a generic suggestion. Make it genuinely useful for THIS person based on what you observed.

Return ONLY this JSON — no markdown, nothing else:
{
  "face_score": <number 1.0–10.0>,
  "grooming_score": <number 1.0–10.0>,
  "facial_structure": "<soft/round|average|defined|strong>",
  "hair_type": "<straight|wavy|curly|coily|locs|bald|unknown>",
  "perceived_ethnicity": "<white|black|east_asian|south_asian|latino|middle_eastern|mixed>",
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
  "top_improvement": "<single most impactful improvement>",
  "face_metrics": {
    "jawline":                { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
    "cheekbones":             { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
    "symmetry":               { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
    "skin_quality":           { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
    "masculinity_femininity": { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
    "facial_thirds":          { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" }
  }${profileSchema}
}`,
    messages: [{
      role: 'user',
      content: hasSide ? [
        { type: 'text',  text: 'Image 1 — front-facing photo:' },
        { type: 'image', source: { type: 'base64', media_type: faceMediaType,  data: faceBase64  } },
        { type: 'text',  text: 'Image 2 — side profile (right side):' },
        { type: 'image', source: { type: 'base64', media_type: sideMediaType,  data: sideBase64  } },
        { type: 'text',  text: `Score this ${gender === 'female' ? 'woman' : 'man'}'s face, grooming, and side profile. Return ONLY the JSON.` },
      ] : [
        { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
        { type: 'text',  text: `Score this ${gender === 'female' ? 'woman' : 'man'}'s face and grooming. Return ONLY the JSON.` },
      ],
    }],
  })

  return parseJSON(response.content[0]?.text?.trim() || '', 'Core scorer')
}

// ── CALL: Extended Metrics — 30-metric breakdown, split out of the core call ──
// Split off from getCoreScore purely for latency: this is the slow, deep
// breakdown (Eyes/Lower Third/Midface/Upper Third/Miscellaneous) that isn't
// needed for the user's headline score, so it runs as its own call the client
// fires in parallel with (or right after) the core call and patches in once
// it resolves — see /score/extended-metrics route below.
async function getExtendedMetrics(faceBase64, faceMediaType, gender) {
  const client = getClient()
  const isFemale = gender === 'female'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    temperature: 0,
    system: `You are a facial structure analyst. You output ONLY a JSON object. No explanations. No text. Just JSON.

SCORE DISTRIBUTION — every score is 1.0–10.0, a bell curve across the general population: 5.0 = true average (most people), 3.0 = below average (common, not rare), 7.0 = above average (a real, achievable good score), 9.0 = genuinely exceptional (rare, top few percent). Use the full range — do not compress everyone into 6–8.

EXTENDED METRICS — a deeper, 30-metric breakdown across 5 categories. Each metric gets a score (1.0–10.0) and a one-line descriptor (max 10 words) of exactly what you observe. Scoring direction is consistent for every metric: 10.0 = the most aesthetically favorable outcome, 1.0 = the least (including the hair-loss and bloat metrics — e.g. norwood_stage: 10.0 = full undiminished hairline, 1.0 = advanced recession; bloat: 10.0 = no visible puffiness/water retention, 1.0 = heavy visible bloat).

eyes:
- orbital_depth: depth-set vs. protruding position of the eye socket relative to the brow and cheekbone plane
- canthal_tilt: upward or downward angle of the outer eye corner relative to the inner corner
- eyebrow_density: thickness, fullness, and coverage of the eyebrow hair
- eyelash_density: thickness and fullness of visible eyelashes
- eyelid_exposure: amount of visible eyelid skin between the lash line and brow (hooded vs. open)
- under_eye_health: presence or absence of dark circles, puffiness, or hollowing beneath the eyes

lower_third:
- lips: fullness, definition, and proportion of upper to lower lip
- mandible: overall lower jawbone width, definition, and forward projection
- gonial_angle: sharpness of the jaw angle where the ramus meets the body of the mandible
- ramus: vertical height and width of the jawbone segment connecting the jaw to the skull
- hyoid_skin_tightness: tightness and definition of the skin and muscle under the chin and upper neck (submental area)
- jaw_width: width of the jaw relative to the rest of the face

midface:
- cheekbones: height, prominence, and forward projection of the malar bones
- maxilla: forward projection and width of the upper jawbone/midface support structure
- nose: proportion, straightness, and refinement of the nose relative to the face
- ipd: inter-pupillary distance — spacing between the eyes relative to face width
- fwhr: facial width-to-height ratio — bizygomatic width relative to upper-face height
- compactness: how tightly the midface features sit together versus how spread out the midface reads

upper_third:
- norwood_stage: stage of hairline recession/male-pattern hair loss progression, if any is visible
- forehead_proportion: height and width of the forehead relative to the rest of the face
- hairline_recession: degree of hairline recession at the temples and frontal hairline
- hair_thinning: visible thinning or reduced density across the scalp
- hairline_density: density and evenness of hair along the hairline itself
- forehead_slope: degree of forward or backward slope of the forehead in profile

miscellaneous:
- skin: overall skin quality, tone evenness, and texture
- harmony: how cohesively all facial features and proportions work together as a whole
- symmetry: left-right balance across the whole face
- neck_width: thickness and proportion of the neck relative to the head and shoulders
- bloat: visible facial or under-skin puffiness/water retention affecting definition
- bone_mass: overall robustness and density of visible facial bone structure

CONFIDENCE ON HARD-TO-ASSESS METRICS: ramus and forehead_slope describe structures that are genuinely difficult to judge accurately from a single front-facing photo without a side profile — a front view mostly hides the jaw's vertical ramus segment and the forehead's true slope. Still provide your best visual estimate and a real score for both, but naturally flag the lower confidence in the descriptor text itself (e.g. "Likely average ramus height, hard to confirm without a side view" or "Forehead appears near-vertical from this angle, slope uncertain") rather than presenting either with the same false precision as metrics that are clearly visible head-on.

This face is ${isFemale ? "a woman's" : "a man's"} — use ${isFemale ? 'feminine' : 'masculine'} framing where relevant (e.g. norwood_stage / hairline metrics still apply to both).

Return ONLY this JSON — no markdown, nothing else:
{
  "extended_metrics": {
    "eyes": {
      "orbital_depth":     { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "canthal_tilt":      { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "eyebrow_density":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "eyelash_density":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "eyelid_exposure":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "under_eye_health":  { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" }
    },
    "lower_third": {
      "lips":                  { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "mandible":              { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "gonial_angle":          { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "ramus":                 { "score": <number 1.0–10.0>, "descriptor": "<max 10 words, flag low confidence>" },
      "hyoid_skin_tightness":  { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "jaw_width":             { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" }
    },
    "midface": {
      "cheekbones":    { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "maxilla":       { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "nose":          { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "ipd":           { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "fwhr":          { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "compactness":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" }
    },
    "upper_third": {
      "norwood_stage":         { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "forehead_proportion":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "hairline_recession":    { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "hair_thinning":         { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "hairline_density":      { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "forehead_slope":        { "score": <number 1.0–10.0>, "descriptor": "<max 10 words, flag low confidence>" }
    },
    "miscellaneous": {
      "skin":        { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "harmony":     { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "symmetry":    { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "neck_width":  { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "bloat":       { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" },
      "bone_mass":   { "score": <number 1.0–10.0>, "descriptor": "<max 10 words>" }
    }
  }
}`,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
        { type: 'text',  text: `Give the 30-metric extended breakdown for this ${gender === 'female' ? 'woman' : 'man'}'s face. Return ONLY the JSON.` },
      ],
    }],
  })

  return parseJSON(response.content[0]?.text?.trim() || '', 'Extended metrics scorer')
}

// Shapes a raw extended_metrics object (snake_case keys, as returned by
// getExtendedMetrics) into the camelCase shape the client expects. Shared by
// the /score route (in case a cached combined result predates the split) and
// the /score/extended-metrics route below, so the two never drift apart.
function shapeExtendedMetrics(em) {
  if (!em) return null
  const r = (v) => v != null ? Math.round(Number(v) * 10) / 10 : null
  const metric = (cat, key) => cat?.[key]?.score != null
    ? { score: r(cat[key].score), descriptor: cat[key].descriptor ?? null }
    : null
  const category = (catKey, keyMap) => {
    const cat = em[catKey]
    if (!cat) return null
    const out = {}
    for (const [camel, snake] of Object.entries(keyMap)) out[camel] = metric(cat, snake)
    return out
  }
  return {
    eyes: category('eyes', {
      orbitalDepth:    'orbital_depth',
      canthalTilt:     'canthal_tilt',
      eyebrowDensity:  'eyebrow_density',
      eyelashDensity:  'eyelash_density',
      eyelidExposure:  'eyelid_exposure',
      underEyeHealth:  'under_eye_health',
    }),
    lowerThird: category('lower_third', {
      lips:               'lips',
      mandible:           'mandible',
      gonialAngle:        'gonial_angle',
      ramus:              'ramus',
      hyoidSkinTightness: 'hyoid_skin_tightness',
      jawWidth:           'jaw_width',
    }),
    midface: category('midface', {
      cheekbones:  'cheekbones',
      maxilla:     'maxilla',
      nose:        'nose',
      ipd:         'ipd',
      fwhr:        'fwhr',
      compactness: 'compactness',
    }),
    upperThird: category('upper_third', {
      norwoodStage:        'norwood_stage',
      foreheadProportion:  'forehead_proportion',
      hairlineRecession:   'hairline_recession',
      hairThinning:        'hair_thinning',
      hairlineDensity:     'hairline_density',
      foreheadSlope:       'forehead_slope',
    }),
    miscellaneous: category('miscellaneous', {
      skin:      'skin',
      harmony:   'harmony',
      symmetry:  'symmetry',
      neckWidth: 'neck_width',
      bloat:     'bloat',
      boneMass:  'bone_mass',
    }),
  }
}

// ── CALL 2: Physique Scoring (optional — only when bodyImage provided) ────────
async function getPhysiqueScore(bodyBase64, bodyMediaType, gender = 'male', bodyGeometry = null) {
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
        { type: 'text',  text: `Score this ${isFemale ? 'woman' : 'man'}'s physique. Return ONLY the JSON.` },
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

// ── Blend weights — tune here, not scattered through code ─────────────────────
const FACE_WEIGHT     = 0.70  // face pillars contribute 70% of overall when physique present
const PHYSIQUE_WEIGHT = 0.30  // physique overall contributes 30% when body photo provided

// ── Final score in CODE — AI never touches this ───────────────────────────────
//
// Formula (face only):    overall = (harmony + angularity + features + dimorphism) / 4
// Formula (face + body):  overall = faceAvg * FACE_WEIGHT + physiqueAvg * PHYSIQUE_WEIGHT
// Grooming score is tracked separately and does NOT affect the overall score.
//
function calculateFinalScore(faceResult, gender = 'male', physiqueResult = null) {
  // ── Input validation ──────────────────────────────────────────────────────────
  if (!faceResult || typeof faceResult !== 'object') {
    throw new Error('calculateFinalScore: faceResult is required and must be an object')
  }
  physiqueResult = physiqueResult ?? null  // explicit null-safe default

  const clamp = (v, fallback = 5.0) => Math.min(Math.max(Number(v) || fallback, 1.0), 10.0)

  // ── 4 Face Pillars ─────────────────────────────────────────────────────────
  const p = faceResult.pillars || {}
  let harmony     = clamp(p.harmony)
  let angularity  = clamp(p.angularity)
  let features    = clamp(p.features)
  let dimorphism  = clamp(p.dimorphism)
  const hasPillars = p.harmony != null && p.angularity != null && p.features != null && p.dimorphism != null

  const pillarAvg    = (harmony + angularity + features + dimorphism) / 4
  const aestheticRaw = hasPillars ? pillarAvg : clamp(faceResult.face_score)

  const faceScore     = Math.round(aestheticRaw * 10) / 10
  const groomingScore = clamp(faceResult.grooming_score)

  // ── Blend physique into overall when body photo was provided ───────────────
  const physiqueOverall  = physiqueResult?.overall ?? null
  const hasPhysique      = physiqueOverall != null
  const blendedRaw       = hasPhysique
    ? aestheticRaw * FACE_WEIGHT + clamp(physiqueOverall) * PHYSIQUE_WEIGHT
    : aestheticRaw

  const final = Math.round(blendedRaw * 10) / 10

  // NOTE: tier is intentionally NOT computed here. `final` at this point is the
  // raw blended score, before rescan anchoring is applied by the caller. Tier
  // must be derived from the anchored score the user actually sees — see
  // getTier() call in the /score route, after anchoring is resolved.

  // Pillar floor rule: when overall >= 8.0, no individual pillar can be more than
  // 1.5 points below the overall score. Prevents contradictory displays
  // (e.g. 8.5 overall with 5.0 harmony). Only adjusts displayed values — final unchanged.
  if (final >= 8.0 && hasPillars) {
    const pillarFloor = Math.round((final - 1.5) * 10) / 10
    harmony    = Math.max(harmony,    pillarFloor)
    angularity = Math.max(angularity, pillarFloor)
    features   = Math.max(features,   pillarFloor)
    dimorphism = Math.max(dimorphism, pillarFloor)
  }

  return { final, faceScore, faceOnlyScore: Math.round(aestheticRaw * 10) / 10, groomingScore, harmony, angularity, features, dimorphism, hasPillars }
}

// ── Route ─────────────────────────────────────────────────────────────────────
// verifyToken accepts demo-token as a rate-limited guest (see claudeGate.js).
// resolvePro sets req.isPro so scanLimit can skip the cap for Pro users.
router.post('/score', verifyToken, resolvePro, scanLimit, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      console.error(`[aiScore] POST /score — ANTHROPIC_API_KEY not configured — ${new Date().toISOString()}`)
      return res.status(500).json({ error: 'AI scoring unavailable — ANTHROPIC_API_KEY not configured on server' })
    }

    const { faceImage, sideImage, bodyImage, gender = 'male', previousScore, bodyGeometry, sideProfileGeometry } = req.body
    if (!faceImage) {
      return res.status(400).json({ error: 'Face image is required' })
    }

    // Detect actual media type BEFORE stripping the prefix
    const faceMediaType = getMediaType(faceImage)
    const faceBase64    = stripPrefix(faceImage)

    // Side profile (optional)
    const sideBase64    = sideImage ? stripPrefix(sideImage)  : null
    const sideMediaType = sideImage ? getMediaType(sideImage) : null

    // Body/physique photo (optional)
    const bodyBase64    = bodyImage ? stripPrefix(bodyImage)  : null
    const bodyMediaType = bodyImage ? getMediaType(bodyImage) : null

    // ── L1: in-process memory cache ───────────────────────────────────────────
    // v2: suffix bumped to invalidate stale celebrity results from before the
    // bone-structure-only prompt rewrite (temperature 0.1 + no celebrity name examples)
    const cacheKey = hashImages(faceBase64, 'FACE_ONLY_v3', sideBase64)
    if (scoreCache.has(cacheKey)) {
      console.log('[aiScore] L1 cache hit:', cacheKey)
      return res.json(scoreCache.get(cacheKey))
    }

    // ── L2: Supabase persistent cache ─────────────────────────────────────────
    const fullHash = computeFullHash(faceBase64, null, sideBase64)
    const tL2Start = Date.now()
    const sbCached = await getScanCache(fullHash)
    console.log(`[aiScore:TIMING] L2 Supabase cache lookup took ${Date.now() - tL2Start}ms`)
    if (sbCached) {
      console.log('[aiScore] L2 Supabase cache hit:', fullHash.slice(0, 16))
      if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
      scoreCache.set(cacheKey, sbCached)
      return res.json(sbCached)
    }

    console.log('[aiScore] Cache miss — acquiring slot for Claude scoring...')
    console.log('[aiScore] Inputs — gender:', gender, '| side:', sideBase64 ? 'YES' : 'NO', '| body:', bodyBase64 ? 'YES' : 'NO')

    const tRouteStart = Date.now()

    // Acquire concurrency slot only now — cache hits above never need it
    const tSlotWaitStart = Date.now()
    await acquireSlot()
    console.log(`[aiScore:TIMING] slot acquire wait: ${Date.now() - tSlotWaitStart}ms`)
    let faceResult, physiqueResult = null, computedScores

    try {
      // ── STEP 1 + STEP 3 in parallel — Face (REQUIRED) + Physique (OPTIONAL) ──
      // Physique has zero data dependency on the face result, so both calls
      // fire at once instead of face-then-physique. Face failure must still
      // hard-fail the whole request; physique failure must stay non-fatal
      // (fall back to face-only) — so physique's promise is caught internally
      // and resolves to null rather than rejecting, while face's promise is
      // left to reject naturally into the outer catch below.
      console.log('[aiScore] STEP 1 — Face scoring...')
      const tFaceStart = Date.now()
      const facePromise = withRetry(
        () => getCoreScore(faceBase64, faceMediaType, gender, sideBase64, sideMediaType, sideProfileGeometry),
        'face'
      ).then(result => {
        console.log(`[aiScore:TIMING] STEP 1 (face) took ${Date.now() - tFaceStart}ms`)
        console.log('[aiScore] STEP 1 OK — face_score:', result.face_score, '| structure:', result.facial_structure, '| grooming:', result.grooming_score)
        return result
      }).catch(faceErr => {
        console.log(`[aiScore:TIMING] STEP 1 (face) FAILED after ${Date.now() - tFaceStart}ms`)
        console.error(`[aiScore] STEP 1 FAILED — face scoring threw: "${faceErr.message}" | userId=${req.userId} gender=${gender} hasSide=${!!sideBase64}`)
        throw faceErr  // only face failure escalates to a full error response
      })

      console.log('[aiScore] STEP 3 — Physique scoring...')
      const tPhysiqueStart = Date.now()
      const physiquePromise = bodyBase64
        ? withRetry(() => getPhysiqueScore(bodyBase64, bodyMediaType, gender, bodyGeometry), 'physique')
            .then(result => {
              console.log(`[aiScore:TIMING] STEP 3 (physique) took ${Date.now() - tPhysiqueStart}ms`)
              console.log('[aiScore] STEP 3 OK — physique overall:', result.overall)
              return result
            })
            .catch(physiqueErr => {
              console.log(`[aiScore:TIMING] STEP 3 (physique) FAILED after ${Date.now() - tPhysiqueStart}ms`)
              console.warn(`[aiScore] STEP 3 FAILED — physique non-fatal, falling back to face-only: "${physiqueErr.message}" | userId=${req.userId} gender=${gender}`)
              return null
            })
        : (console.log('[aiScore] STEP 3 — no body photo, skipped'), Promise.resolve(null))

      ;[faceResult, physiqueResult] = await Promise.all([facePromise, physiquePromise])

      // ── STEP 4: Overall score calculation ─────────────────────────────────────
      // If calculation throws with physique data, retry without it before failing.
      console.log('[aiScore] STEP 4 — Calculating final score...')
      const tCalcStart = Date.now()
      try {
        computedScores = calculateFinalScore(faceResult, gender, physiqueResult)
        console.log(`[aiScore:TIMING] STEP 4 (calc) took ${Date.now() - tCalcStart}ms`)
      } catch (calcErr) {
        console.error(`[aiScore] STEP 4 FAILED with physique — retrying face-only: "${calcErr.message}" | physiqueResult=${JSON.stringify(physiqueResult)}`)
        computedScores = calculateFinalScore(faceResult, gender, null)
        physiqueResult = null  // reflect that physique was dropped
        console.log('[aiScore] STEP 4 face-only retry OK')
      }
    } finally {
      releaseSlot()
      console.log(`[aiScore:TIMING] TOTAL pipeline (post-cache-check) took ${Date.now() - tRouteStart}ms`)
    }

    // Final score: pure code — no AI involvement (computedScores already calculated above)
    const { final: rawFinal, faceScore, faceOnlyScore, groomingScore, harmony, angularity, features, dimorphism, hasPillars } = computedScores
    console.log('[aiScore] Final:', rawFinal, physiqueResult ? `(face ${faceOnlyScore} × ${FACE_WEIGHT} + physique ${physiqueResult.overall} × ${PHYSIQUE_WEIGHT})` : '(face only)')
    console.log('[aiScore] Pillars — H:', harmony, 'A:', angularity, 'F:', features, 'D:', dimorphism)

    // Rescan anchoring — cap score movement at ±1.0 per rescan to prevent
    // photo-variance-driven score jumps. Only applied when previousScore is provided.
    let final = rawFinal
    const prevNum = typeof previousScore === 'number' && previousScore >= 1 && previousScore <= 10
      ? previousScore
      : null
    if (prevNum !== null) {
      const delta = rawFinal - prevNum
      if (Math.abs(delta) > 0.5) {
        final = Math.round((prevNum + Math.sign(delta) * Math.min(Math.abs(delta), 1.0)) * 10) / 10
        console.log(`[aiScore] Rescan anchoring: raw=${rawFinal} prev=${prevNum} anchored=${final}`)
      }
    }

    // Tier MUST be derived from the anchored `final` — this is the same score
    // returned as overallScore below and what every screen displays. Computing
    // tier from rawFinal here previously caused the reveal animation (which used
    // this tier string) to show a different label than screens that recomputed
    // tier client-side from the anchored score.
    const tier = getTier(final, gender)
    console.log('[aiScore] Tier:', tier)

    const faceSub = faceResult.sub_scores || {}
    const r = (v) => v != null ? Math.round(Number(v) * 10) / 10 : null

    const result = {
      overallScore:      final,
      faceOnlyScore:     faceOnlyScore,   // face pillar avg before physique blend
      faceScore:         Math.round(faceScore    * 10) / 10,
      groomingScore:     Math.round(groomingScore * 10) / 10,
      tier,
      facialStructure:    faceResult.facial_structure,
      hairType:           faceResult.hair_type ?? 'unknown',
      perceivedEthnicity: faceResult.perceived_ethnicity ?? 'mixed',
      faceSubScores: {
        symmetry:          r(faceSub.symmetry),
        jawlineDefinition: r(faceSub.jawline_definition),
        skinClarity:       r(faceSub.skin_clarity),
        facialProportions: r(faceSub.facial_proportions),
        eyeArea:           r(faceSub.eye_area),
        facialHarmony:     r(faceSub.facial_harmony),
      },
      pillars: hasPillars ? {
        harmony:    Math.round(harmony    * 10) / 10,
        angularity: Math.round(angularity * 10) / 10,
        features:   Math.round(features   * 10) / 10,
        dimorphism: Math.round(dimorphism * 10) / 10,
      } : null,
      keyStrengths:      faceResult.key_strengths,
      keyWeaknesses:     faceResult.key_weaknesses,
      topImprovement:    faceResult.top_improvement,
      faceMetrics: (() => {
        const fm = faceResult.face_metrics
        if (!fm) return null
        const metric = (key) => fm[key]?.score != null
          ? { score: r(fm[key].score), descriptor: fm[key].descriptor ?? null }
          : null
        return {
          jawline:               metric('jawline'),
          cheekbones:            metric('cheekbones'),
          symmetry:              metric('symmetry'),
          skinQuality:           metric('skin_quality'),
          masculinityFemininity: metric('masculinity_femininity'),
          facialThirds:          metric('facial_thirds'),
        }
      })(),
      // extended_metrics no longer comes from the core call — it's fetched
      // separately via POST /score/extended-metrics so the core result isn't
      // held up waiting on it. 'pending' tells the client to fire that
      // follow-up call and patch the result in once it resolves.
      extendedMetrics: null,
      extendedMetricsStatus: 'pending',
      // Side profile — null when no side photo was provided
      hasSideProfile: !!sideBase64,
      profileScore:   faceResult.profile?.profile_score ?? null,
      profileData:    faceResult.profile ?? null,
      // Physique — null when no body photo was provided
      physiqueScore:  physiqueResult ?? null,
      bodyFatLevel:   physiqueResult?.body_fat_level ?? null,
    }

    // ── Write to both caches (L1 in-memory + L2 Supabase) ─────────────────────
    if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
    scoreCache.set(cacheKey, result)
    // L2 write is fire-and-forget — never blocks the response
    // Wrapped in try-catch so a missing/undefined export can't propagate to the outer catch
    try {
      setScanCache(fullHash, result).then(() => {
        console.log('[aiScore] L2 Supabase cache written:', fullHash.slice(0, 16))
      }).catch(err => {
        console.warn('[aiScore] L2 Supabase cache write failed (non-fatal):', err.message)
      })
    } catch (e) {
      console.warn('[aiScore] L2 cache call error (non-fatal):', e.message)
    }

    // ── Persist to scan history (fire-and-forget, skip demo users) ────────────
    // Wrapped in try-catch so a TypeError (e.g. undefined function) is non-fatal
    if (req.userId && req.userId !== 'demo') {
      try {
        saveScanHistory(req.userId, {
          overallScore:    result.overallScore,
          faceScore:       result.faceScore,
          groomingScore:   result.groomingScore,
          tier:            result.tier,
        }).catch(err => console.warn('[aiScore] scan_history save failed (non-fatal):', err.message))
      } catch (e) {
        console.warn('[aiScore] scan_history call error (non-fatal):', e.message)
      }
      // Update leaderboard server-side with Claude's verified score — never from client
      try { updateLeaderboard(req.userId, result.overallScore) } catch (e) {
        console.warn('[aiScore] leaderboard update failed (non-fatal):', e.message)
      }
    }

    res.json(result)
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

    // Full error detail always logged to Railway — including retry-exhausted errors
    console.error(`[aiScore] ROUTE ERROR — userId=${req.userId} status=${status} retryExhausted=${!!err.retryExhausted} msg="${msg.slice(0, 300)}"`)

    if (isRateLimit) {
      // 'rate_limited' is the machine-readable code the client checks for countdown/auto-retry
      return res.status(429).json({ error: 'rate_limited', retryAfter: 60 })
    }

    // Generic server error — client shows fallback message
    res.status(500).json({ error: 'server_error' })
  }
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

    const { bodyImage, gender = 'male', bodyGeometry } = req.body
    if (!bodyImage) {
      return res.status(400).json({ error: 'Body image is required' })
    }

    const bodyMediaType = getMediaType(bodyImage)
    const bodyBase64    = stripPrefix(bodyImage)

    console.log('[aiScore:physique-only] Inputs — gender:', gender)

    await acquireSlot()
    let physiqueResult
    try {
      physiqueResult = await withRetry(() => getPhysiqueScore(bodyBase64, bodyMediaType, gender, bodyGeometry), 'physique-only')
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
// The 30-metric breakdown, split out of the core /score call purely for
// latency (see getExtendedMetrics above) — the client fires this in parallel
// with (or right after) /score and patches the result in once it resolves.
// Not gated by scanLimit (that's for full scans) — only claudeLimit, same as
// /score/physique, since this is a single follow-up Claude call, not a scan.
router.post('/score/extended-metrics', verifyToken, resolvePro, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ error: 'AI scoring unavailable — ANTHROPIC_API_KEY not configured on server' })
    }

    const { faceImage, gender = 'male' } = req.body
    if (!faceImage) {
      return res.status(400).json({ error: 'Face image is required' })
    }

    const faceMediaType = getMediaType(faceImage)
    const faceBase64    = stripPrefix(faceImage)

    // Same two-tier cache as /score, namespaced with an 'EXTENDED' marker so
    // these keys never collide with the core-score cache for the same photo.
    const cacheKey = hashImages(faceBase64, 'EXTENDED_METRICS_v1', null)
    if (scoreCache.has(cacheKey)) {
      console.log('[aiScore:extended] L1 cache hit:', cacheKey)
      return res.json(scoreCache.get(cacheKey))
    }
    const fullHash = computeFullHash(faceBase64, 'EXTENDED_METRICS_v1', null)
    const sbCached = await getScanCache(fullHash)
    if (sbCached) {
      console.log('[aiScore:extended] L2 Supabase cache hit:', fullHash.slice(0, 16))
      if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
      scoreCache.set(cacheKey, sbCached)
      return res.json(sbCached)
    }

    console.log('[aiScore:extended] Inputs — gender:', gender)

    await acquireSlot()
    let extendedRaw
    const tStart = Date.now()
    try {
      extendedRaw = await withRetry(() => getExtendedMetrics(faceBase64, faceMediaType, gender), 'extended-metrics')
      console.log(`[aiScore:TIMING] extended-metrics call took ${Date.now() - tStart}ms`)
    } finally {
      releaseSlot()
    }

    const result = { extendedMetrics: shapeExtendedMetrics(extendedRaw.extended_metrics) }

    if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
    scoreCache.set(cacheKey, result)
    try {
      setScanCache(fullHash, result).then(() => {
        console.log('[aiScore:extended] L2 Supabase cache written:', fullHash.slice(0, 16))
      }).catch(err => {
        console.warn('[aiScore:extended] L2 Supabase cache write failed (non-fatal):', err.message)
      })
    } catch (e) {
      console.warn('[aiScore:extended] L2 cache call error (non-fatal):', e.message)
    }

    res.json(result)
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

    console.error(`[aiScore:extended] ROUTE ERROR — userId=${req.userId} status=${status} msg="${msg.slice(0, 300)}"`)

    if (isRateLimit) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: 60 })
    }
    res.status(500).json({ error: 'server_error' })
  }
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

module.exports = router
