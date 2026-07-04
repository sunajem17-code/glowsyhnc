const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const crypto = require('crypto')
const { RekognitionClient, RecognizeCelebritiesCommand } = require('@aws-sdk/client-rekognition')
const { verifyToken, claudeLimit, scanLimit, resolvePro } = require('../middleware/claudeGate')
const { getScanCache, setScanCache, saveScanHistory } = require('../supabase')

// ── AWS Rekognition client ────────────────────────────────────────────────────
function getRekognitionClient() {
  return new RekognitionClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

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

// ── CALL 1: Face + Grooming + 4 Pillars (+ optional side profile) ────────────
// Focused on facial structure, grooming, and the 4 aesthetic pillars.
// When sideBase64 is provided a second image is sent and profile metrics are
// returned in the "profile" key. No body. No overall score.
async function getFaceScore(faceBase64, faceMediaType, gender, sideBase64 = null, sideMediaType = null) {
  const client = getClient()
  const isFemale = gender === 'female'
  const hasSide = !!sideBase64

  const profileSection = hasSide ? `

SIDE PROFILE ANALYSIS — A side-profile photo has been provided as Image 2. Analyze the lateral view:
- profile_score: Overall lateral facial aesthetics 1.0–10.0. Strong jaw/chin projection, tall straight nose bridge, and forward mid-face score highest.
- nose_bridge: "soft" (low/flat bridge), "medium" (average height), "strong" (tall and straight), or "aquiline" (curved/Roman nose).
- jawline_projection: "recessed" (jaw sits behind vertical), "average" (neutral), "projected" (forward jaw), or "strong" (strong forward projection).
- chin_projection: "recessed" (chin behind Ricketts E-line), "average" (on the line), "projected" (slightly ahead), or "prominent" (well ahead of E-line).
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
    max_tokens: hasSide ? 1100 : 950,
    temperature: 0,
    system: `You are a facial attractiveness and grooming analyst. You output ONLY a JSON object. No explanations. No text. Just JSON.

Score face and grooming on a 1.0–10.0 scale.

FACE SCORING — assess these features:
- ${isFemale ? 'Facial softness, high cheekbones, feminine bone structure, large eyes, full lips' : 'Jawline definition and sharpness, cheekbone prominence, brow ridge, masculine structure'}
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
  FEMALE ANGULARITY SCORING RUBRIC:
  9.0–10.0 → Elite feminine structure: high prominent cheekbones, clean facial lines, defined but soft jawline, model-tier bone structure.
  7.5–8.9  → Strong feminine definition: visible cheekbones, clean jaw, refined facial structure above average.
  6.0–7.4  → Moderate definition: some cheekbone visibility, average feminine structure, slight softness.
  4.0–5.9  → Below-average structure: full face with minimal bone definition.
  1.0–3.9  → Poor structure: heavy or round face, no visible bone structure.
  CRITICAL: A female face with high cheekbones and refined structure MUST score 8.0+. Do NOT apply male standards.` :
  `Sharpness and definition of physical structure. This is the PRIMARY structural pillar.
  ANGULARITY SCORING RUBRIC — MANDATORY. Use the full range. Do not compress into 6–8.
  9.0–10.0 → Elite bone structure: razor-sharp jawline with defined gonial angle, highly prominent cheekbones, strong visible brow ridge, forward chin projection, zero visible facial fat obscuring bone. This tier is real — use it when the evidence is present.
  7.5–8.9  → Strong, clearly defined structure: sharp jawline, visible prominent cheekbones, good brow definition, lean facial structure. An 8 is NOT flattery — it is an accurate description of above-average bone structure.
  6.0–7.4  → Moderate definition: jawline visible but not sharp, cheekbones present but not prominent, average to slightly above-average structure with some softness.
  4.0–5.9  → Below-average structure: soft or undefined jaw, facial fat obscuring bone, cheekbones not visible, lacks skeletal definition.
  1.0–3.9  → Poor angularity: round or heavy face, no visible bone structure at all.
  CRITICAL: A face with a visibly sharp jaw, prominent cheekbones, and defined brow ridge MUST score 8.5 or higher. Giving 7.0 to a face with clearly strong bone structure is an inaccurate deflation — do not do it. Use the full 1–10 range.`}

- Features: Quality of individual facial features. ${isFemale ? 'Consider eye size and shape (large almond eyes score highest), nose refinement, lip fullness, brow shape, and skin clarity. Skin clarity is weighted 1.5× for females.' : 'Consider eye shape and size, nose shape and proportion, lip fullness, skin clarity, and overall feature quality.'}
- Dimorphism: ${isFemale ?
  'Rate FEMININITY — how strongly this face expresses feminine sex characteristics. High score: large eyes, high soft cheekbones, smooth skin, delicate features, soft jaw. Low score: masculine jaw, heavy brow ridge, wide nose, angular masculine structure on a female face.' :
  'Rate masculinity: strong jaw, hunter eyes, brow ridge, defined bone structure.'}

Be honest and accurate. High scores (9+) for elite bone structure ARE the honest score — accuracy means using the full range, not clustering in the middle.

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

  return parseJSON(response.content[0]?.text?.trim() || '', 'Face scorer')
}

// ── CALL 2: Physique Scoring (optional — only when bodyImage provided) ────────
async function getPhysiqueScore(bodyBase64, bodyMediaType, gender = 'male') {
  const client = getClient()
  const isFemale = gender === 'female'

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
- overall_presentation: Grooming, clothing fit, how well the body is presented. Clean presentation = high score.`}

SCORING RULES:
- Use the FULL 1–10 range. Do not cluster around 5–6.
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

// ── Rekognition: call RecognizeCelebrities, return raw CelebrityFaces array ──
async function rekognizeImage(faceBase64) {
  const client  = getRekognitionClient()
  const bytes   = Buffer.from(faceBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
  const cmd     = new RecognizeCelebritiesCommand({ Image: { Bytes: bytes } })

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Rekognition timed out after 10s')), 10_000)
  )
  const resp = await Promise.race([client.send(cmd), timeout])
  return resp.CelebrityFaces ?? []
}

const NO_MATCH = { celebrity: 'No close match found', profession: null, similarity: 0, shared_traits: 'No celebrity match detected' }

// Known-female celebrity names drawn from our own CELEB_POOLS female list.
// Used to filter cross-gender Rekognition results without an external lookup.
const KNOWN_FEMALE_CELEBS = new Set([
  'Angelina Jolie','Megan Fox','Charlize Theron','Cate Blanchett','Eva Green',
  'Monica Bellucci','Bella Hadid','Naomi Campbell','Kendall Jenner','Hailey Bieber',
  'Gigi Hadid','Adriana Lima','Joan Smalls','Winnie Harlow','Rihanna','Beyoncé',
  'Rosalía','Sommer Ray','Ana Cheri','Natalie Portman','Emma Watson','Zendaya',
  'Florence Pugh','Anya Taylor-Joy','Daisy Ridley','Lupita Nyongo','Letitia Wright',
  'Olivia Rodrigo','Sabrina Carpenter','Billie Eilish','Gracie Abrams','Halle Bailey',
  'SZA','Gemma Chan','Jennifer Aniston','Anne Hathaway','Sandra Bullock',
  'Reese Witherspoon','Blake Lively','Scarlett Johansson','Millie Bobby Brown',
  'Sydney Sweeney','Selena Gomez','Camila Cabello','Dua Lipa','Ariana Grande',
  'Jennifer Lopez','Normani','Tyla','Doja Cat','Ari Lennox','Jorja Smith',
  'Megan Thee Stallion','Adele','Lizzo','Meghan Trainor','Kelly Clarkson',
  'Rebel Wilson','Chrissy Metz','Ashley Graham','Tess Holliday','Alix Earle',
  'Emma Chamberlain','Addison Rae','Charli DAmelio','Dixie DAmelio','Pokimane',
  'Valkyrae','Liza Koshy','Lilly Singh','Rachel Zegler','Haifa Wehbe',
])

// ── CALL 3 (parallel): Celebrity Lookalike via AWS Rekognition ────────────────
// Rekognition is the only path. No Claude fallback.
async function getCelebrityMatch(faceBase64, gender = 'male') {
  const isFemale = gender === 'female'
  let rekogFaces = []
  try {
    rekogFaces = await withRetry(() => rekognizeImage(faceBase64), 'rekognition')
    console.log(`[CELEB] Rekognition returned ${rekogFaces.length} matches`)
  } catch (err) {
    console.warn(`[CELEB] Rekognition failed: ${err.message}`)
    return { match1: NO_MATCH, match2: NO_MATCH, match3: NO_MATCH }
  }

  if (rekogFaces.length === 0) {
    console.log('[CELEB] Rekognition returned 0 matches')
    return { match1: NO_MATCH, match2: NO_MATCH, match3: NO_MATCH }
  }

  // Filter cross-gender matches. For male users, exclude names we know are female.
  // For female users we have no exhaustive male exclusion list, so pass all through —
  // Rekognition rarely matches female faces to male celebrities anyway.
  const genderFiltered = isFemale
    ? rekogFaces
    : rekogFaces.filter(r => !KNOWN_FEMALE_CELEBS.has(r.Name))
  // If filtering wiped everything, fall back to unfiltered to avoid returning 3x NO_MATCH
  const faces = genderFiltered.length > 0 ? genderFiltered : rekogFaces
  if (genderFiltered.length === 0) {
    console.warn(`[CELEB] Gender filter removed all ${rekogFaces.length} matches — using unfiltered`)
  }

  const mapped = faces.slice(0, 3).map(r => ({
    celebrity:    r.Name,
    profession:   'Celebrity',
    similarity:   Math.round(r.MatchConfidence),
    shared_traits: 'Matched by AWS Rekognition facial recognition',
    source:       'rekognition',
  }))

  while (mapped.length < 3) mapped.push(NO_MATCH)

  console.log(`[CELEB] Final matches: ${mapped.map(m => `${m.celebrity} ${m.similarity}%`).join(' | ')}`)
  return { match1: mapped[0], match2: mapped[1], match3: mapped[2] }
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

  // Tier assignment — exact ranges, gender-aware
  // MALE:   Sub 3 (<4) · Low Tier Normie (4–4.9) · Mid Tier Normie (5–5.9)
  //         High Tier Normie (6–6.9) · Chadlite (7–7.9) · Chad (8–8.9)
  //         Adam Lite (9–9.4) · True Adam (9.5–10)
  // FEMALE: Sub 3 (<4) · Low Tier Becky (4–4.9) · Mid Tier Becky (5–5.9)
  //         High Tier Becky (6–6.9) · Stacy (7–7.9) · Eve (8–8.9)
  //         Eve Lite (9–9.4) · True Eve (9.5–10)
  let tier
  if (gender === 'female') {
    if      (final >= 9.5) tier = 'True Eve'
    else if (final >= 9.0) tier = 'Eve Lite'
    else if (final >= 8.0) tier = 'Eve'
    else if (final >= 7.0) tier = 'Stacy'
    else if (final >= 6.0) tier = 'High Tier Becky'
    else if (final >= 5.0) tier = 'Mid Tier Becky'
    else if (final >= 4.0) tier = 'Low Tier Becky'
    else                   tier = 'Sub 3'
  } else {
    if      (final >= 9.5) tier = 'True Adam'
    else if (final >= 9.0) tier = 'Adam Lite'
    else if (final >= 8.0) tier = 'Chad'
    else if (final >= 7.0) tier = 'Chadlite'
    else if (final >= 6.0) tier = 'High Tier Normie'
    else if (final >= 5.0) tier = 'Mid Tier Normie'
    else if (final >= 4.0) tier = 'Low Tier Normie'
    else                   tier = 'Sub 3'
  }

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

  return { final, tier, faceScore, faceOnlyScore: Math.round(aestheticRaw * 10) / 10, groomingScore, harmony, angularity, features, dimorphism, hasPillars }
}

// ── Route ─────────────────────────────────────────────────────────────────────
// verifyToken accepts demo-token as a rate-limited guest (see claudeGate.js).
// resolvePro sets req.isPro so scanLimit can skip the cap for Pro users.
router.post('/score', verifyToken, resolvePro, scanLimit, claudeLimit, async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ error: 'AI scoring unavailable — ANTHROPIC_API_KEY not configured on server' })
    }

    const { faceImage, sideImage, bodyImage, gender = 'male', previousScore } = req.body
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
    const sbCached = await getScanCache(fullHash)
    if (sbCached) {
      console.log('[aiScore] L2 Supabase cache hit:', fullHash.slice(0, 16))
      if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
      scoreCache.set(cacheKey, sbCached)
      return res.json(sbCached)
    }

    console.log('[aiScore] Cache miss — acquiring slot for Claude scoring...')
    console.log('[aiScore] Inputs — gender:', gender, '| side:', sideBase64 ? 'YES' : 'NO', '| body:', bodyBase64 ? 'YES' : 'NO')

    // Acquire concurrency slot only now — cache hits above never need it
    await acquireSlot()
    let faceResult, celebResult = null, physiqueResult = null, computedScores

    try {
      // ── STEP 1: Face scoring (REQUIRED) ──────────────────────────────────────
      // This is the only step that can produce a hard failure. If it throws,
      // we re-throw so the outer catch returns a 500 to the client.
      console.log('[aiScore] STEP 1 — Face scoring...')
      try {
        faceResult = await withRetry(
          () => getFaceScore(faceBase64, faceMediaType, gender, sideBase64, sideMediaType),
          'face'
        )
        console.log('[aiScore] STEP 1 OK — face_score:', faceResult.face_score, '| structure:', faceResult.facial_structure, '| grooming:', faceResult.grooming_score)
      } catch (faceErr) {
        console.error(`[aiScore] STEP 1 FAILED — face scoring threw: "${faceErr.message}" | userId=${req.userId} gender=${gender} hasSide=${!!sideBase64}`)
        throw faceErr  // only face failure escalates to a full error response
      }

      // ── STEP 2 + 3: Celebrity matching + Physique scoring (both OPTIONAL) ─────
      // Run in parallel. Promise.allSettled never rejects — each step lives or dies
      // independently. A physique failure degrades to face-only, never kills the result.
      console.log('[aiScore] STEP 2+3 — Celebrity match + Physique scoring in parallel...')
      const [celebSettled, physiqueSettled] = await Promise.allSettled([
        getCelebrityMatch(faceBase64, gender),
        bodyBase64
          ? withRetry(() => getPhysiqueScore(bodyBase64, bodyMediaType, gender), 'physique')
          : Promise.resolve(null),
      ])

      if (celebSettled.status === 'fulfilled') {
        celebResult = celebSettled.value
        console.log('[aiScore] STEP 2 OK — celeb matches:',
          celebResult
            ? [celebResult.match1, celebResult.match2, celebResult.match3]
                .filter(Boolean).map(m => `${m.celebrity} ${m.similarity}%`).join(' | ')
            : 'none')
      } else {
        console.warn(`[aiScore] STEP 2 FAILED — celeb match non-fatal: "${celebSettled.reason?.message}" | userId=${req.userId}`)
        celebResult = null
      }

      if (physiqueSettled.status === 'fulfilled') {
        physiqueResult = physiqueSettled.value
        if (physiqueResult) console.log('[aiScore] STEP 3 OK — physique overall:', physiqueResult.overall)
        else console.log('[aiScore] STEP 3 — no body photo, skipped')
      } else {
        console.warn(`[aiScore] STEP 3 FAILED — physique non-fatal, falling back to face-only: "${physiqueSettled.reason?.message}" | userId=${req.userId} gender=${gender}`)
        physiqueResult = null
      }

      // ── STEP 4: Overall score calculation ─────────────────────────────────────
      // If calculation throws with physique data, retry without it before failing.
      console.log('[aiScore] STEP 4 — Calculating final score...')
      try {
        computedScores = calculateFinalScore(faceResult, gender, physiqueResult)
      } catch (calcErr) {
        console.error(`[aiScore] STEP 4 FAILED with physique — retrying face-only: "${calcErr.message}" | physiqueResult=${JSON.stringify(physiqueResult)}`)
        computedScores = calculateFinalScore(faceResult, gender, null)
        physiqueResult = null  // reflect that physique was dropped
        console.log('[aiScore] STEP 4 face-only retry OK')
      }
    } finally {
      releaseSlot()
    }

    // Final score: pure code — no AI involvement (computedScores already calculated above)
    const { final: rawFinal, tier, faceScore, faceOnlyScore, groomingScore, harmony, angularity, features, dimorphism, hasPillars } = computedScores
    console.log('[aiScore] Final:', rawFinal, tier, physiqueResult ? `(face ${faceOnlyScore} × ${FACE_WEIGHT} + physique ${physiqueResult.overall} × ${PHYSIQUE_WEIGHT})` : '(face only)')
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
      celebrityMatches:  celebResult
        ? [celebResult.match1, celebResult.match2, celebResult.match3]
            .filter(Boolean)
            .map(m => ({
              celebrity:    m.celebrity,
              profession:   m.profession   ?? null,
              similarity:   m.similarity,
              reason:       m.shared_traits ?? m.reason ?? '',
              shared_traits: m.shared_traits ?? m.reason ?? '',
            }))
        : null,
      faceTraits: celebResult?.face_traits ?? null,
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
          celebrityMatch:  result.celebrityMatches?.[0]?.celebrity ?? null,
        }).catch(err => console.warn('[aiScore] scan_history save failed (non-fatal):', err.message))
      } catch (e) {
        console.warn('[aiScore] scan_history call error (non-fatal):', e.message)
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
