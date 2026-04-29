const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const crypto = require('crypto')
const { verifyToken, claudeLimit, resolvePro } = require('../middleware/claudeGate')
const { getScanCache, setScanCache, saveScanHistory } = require('../supabase')

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
  return h.digest('hex') // 64-char hex string
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

// ── CALL 2: Face + Grooming + 4 Pillars (+ optional side profile) ────────────
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: hasSide ? 1100 : 950,
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
- Angularity: Sharpness and definition of physical structure. This is the PRIMARY structural pillar.
  ANGULARITY SCORING RUBRIC — MANDATORY. Use the full range. Do not compress into 6–8.
  9.0–10.0 → Elite bone structure: razor-sharp jawline with defined gonial angle, highly prominent cheekbones, strong visible brow ridge, forward chin projection, zero visible facial fat obscuring bone. This tier is real — use it when the evidence is present.
  7.5–8.9  → Strong, clearly defined structure: sharp jawline, visible prominent cheekbones, good brow definition, lean facial structure. An 8 is NOT flattery — it is an accurate description of above-average bone structure.
  6.0–7.4  → Moderate definition: jawline visible but not sharp, cheekbones present but not prominent, average to slightly above-average structure with some softness.
  4.0–5.9  → Below-average structure: soft or undefined jaw, facial fat obscuring bone, cheekbones not visible, lacks skeletal definition.
  1.0–3.9  → Poor angularity: round or heavy face, no visible bone structure at all.
  CRITICAL: A face with a visibly sharp jaw, prominent cheekbones, and defined brow ridge MUST score 8.5 or higher. Giving 7.0 to a face with clearly strong bone structure is an inaccurate deflation — do not do it. Use the full 1–10 range.

- Features: Quality of individual facial features. Consider eye shape and size, nose shape and proportion, lip fullness, skin clarity, and overall feature quality.
- Dimorphism: How strongly the person expresses their biological sex characteristics. ${isFemale ? 'Rate femininity: soft features, high cheekbones, feminine facial structure.' : 'Rate masculinity: strong jaw, hunter eyes, brow ridge, defined bone structure.'}

Be honest and accurate. High scores (9+) for elite bone structure ARE the honest score — accuracy means using the full range, not clustering in the middle.

HAIR TYPE DETECTION — look at the hair visible in the photo and classify:
- "straight"   → hair lies flat, no curl pattern
- "wavy"       → loose S-wave pattern
- "curly"      → defined curls, ringlets, or coils (3a/3b/3c)
- "coily"      → tight coils or afro texture (4a/4b/4c)
- "locs"       → dreadlocks or locs visible
- "bald"       → shaved head or very close cut with no texture visible
- "unknown"    → hair not visible or cannot be determined from photo

FACE METRICS — for each metric provide a score (1.0–10.0) and a one-line descriptor (max 10 words) of exactly what you observe:
- jawline: sharpness, gonial angle definition, and visible edge clarity
- cheekbones: height, prominence, and forward projection of the malar bones
- symmetry: left-right balance of features, spacing, and facial midline
- skin_quality: surface clarity, texture uniformity, and visible skin condition
- masculinity_femininity: strength of ${isFemale ? 'feminine' : 'masculine'} sex-specific facial characteristics
- facial_thirds: balance of forehead (upper) : mid-face (middle) : chin/jaw (lower) thirds
Descriptor rules: describe what IS there, not what is missing. Max 10 words. No filler phrases ("overall", "somewhat", "rather").
${profileSection}
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

// ── CALL 3 (parallel): Celebrity Lookalike ────────────────────────────────────
// Runs in parallel with calls 1+2. Non-blocking — failure returns null gracefully.
// Uses claude-haiku-4-5-20251001. Now accepts gender to provide appropriate pools.
// Includes automatic fallback retry when generic/unknown names are detected.
async function getCelebrityMatch(faceBase64, faceMediaType, gender = 'male') {
  const client  = getClient()
  const isFemale = gender === 'female'

  // ── Helper: detect if any returned name is generic or unrecognisable ────────
  function isGenericOrUnknown(parsed) {
    if (!parsed) return true
    const names = [parsed.match1, parsed.match2, parsed.match3]
      .filter(Boolean)
      .map(m => (m.celebrity || '').trim().toLowerCase())
    if (names.length === 0) return true
    return names.some(n =>
      !n ||
      n.length < 3 ||
      /unknown|generic|person|individual|n\/a|no match|nobody|placeholder/i.test(n)
    )
  }

  // ── Primary system prompt — expanded to cover models, athletes, influencers ─
  const systemPrompt = `You are a facial match specialist. You identify the most visually similar celebrity, model, athlete, or public figure for any face worldwide — not just Hollywood actors.

YOUR MATCH POOL — draw from ALL of these categories equally:
• Actors & musicians (Hollywood, Bollywood, K-pop, Nollywood, Latin, European)
• Fashion models (Victoria's Secret, Vogue runway, Sports Illustrated, editorial)
• Fitness models, physique athletes, and men's health cover models
• Instagram / TikTok creators with 500k+ followers
• Professional athletes (soccer, basketball, boxing, UFC, NFL, tennis, F1)
• International celebrities from any country or industry

ACCURACY OVER FAME — the most structurally accurate match wins, even if they are less famous than an actor. A runway model who shares identical bone structure beats a mismatched Hollywood star every time.

CANDIDATE POOLS BY ETHNICITY AND GENDER (non-exhaustive — use your full knowledge):

${isFemale ? `FEMALE POOLS:
  WHITE EUROPEAN/AMERICAN (models/actresses): Bella Hadid, Gigi Hadid, Emily Ratajkowski, Kendall Jenner,
    Hailey Bieber, Adriana Lima, Candice Swanepoel, Rosie Huntington-Whiteley, Karlie Kloss, Miranda Kerr,
    Romee Strijd, Sara Sampaio, Barbara Palvin, Elsa Hosk, Sofia Richie, Scarlett Johansson,
    Sydney Sweeney, Florence Pugh, Margot Robbie, Emma Stone, Ana de Armas, Blake Lively,
    Taylor Swift, Dua Lipa, Sabrina Carpenter, Dove Cameron, Madison Beer
  FITNESS/SOCIAL (any ethnicity): Sommer Ray, Paige Hathaway, Whitney Simmons, Tammy Hembrow,
    Addison Rae, Charli D'Amelio, Emma Chamberlain, Dixie D'Amelio, Olivia Rodrigo
  BLACK/MIXED: Naomi Campbell, Iman, Winnie Harlow, Normani, SZA, Doja Cat, Beyoncé, Rihanna,
    Nicki Minaj, Cardi B, Zendaya, Jenna Ortega, Ashley Graham, Paloma Elsesser
  ASIAN/INTERNATIONAL: Lisa (BLACKPINK), Jennie (BLACKPINK), IU, Song Hye-kyo, Somi,
    Priyanka Chopra, Deepika Padukone, Alia Bhatt, Kim Kardashian, Kylie Jenner,
    Selena Gomez, Ariana Grande, Camila Cabello` : `MALE POOLS:
  WHITE EUROPEAN/AMERICAN (actors/models): Timothée Chalamet, Jacob Elordi, Austin Butler, Paul Mescal,
    Tom Holland, Zac Efron, Glen Powell, Richard Madden, Kit Harington, Henry Cavill, Chris Hemsworth,
    Pedro Pascal, Adam Driver, Brad Pitt, Ryan Reynolds, Leonardo DiCaprio, Harry Styles,
    Lucky Blue Smith, David Gandy, Jon Kortajarena, Sean O'Pry, Tyler Cameron, Jordan Barrett
  FITNESS/SOCIAL (any ethnicity): Jeff Seid, David Laid, Ryan Terry, Simeon Panda, Ulisses Jr,
    Steve Cook, Lazar Angelov, Noah Beck, Vinnie Hacker, Chase Hudson, Bryce Hall, MrBeast
  BLACK/MIXED (actors/athletes/musicians): Michael B Jordan, Idris Elba, Winston Duke, Kofi Siriboe,
    Mahershala Ali, John Boyega, Dwayne Johnson, Drake, Travis Scott, The Weeknd, ASAP Rocky,
    LeBron James, Steph Curry, Ja Morant, Devin Booker, Giannis Antetokounmpo,
    Anthony Joshua, KSI, Israel Adesanya, Kevin Hart, Kai Cenat
  ASIAN/INTERNATIONAL: BTS (V/Jin/Jungkook/RM/Suga/J-Hope/Jimin), Park Seo-jun, Song Joong-ki,
    Lee Jong-suk, Lee Min-ho, Godfrey Gao, Simu Liu, Steven Yeun
  LATINO/MIDDLE EASTERN: Bad Bunny, Maluma, J Balvin, Ozuna, Neymar, Kylian Mbappé,
    Rami Malek, Marwan Kenzari, Oscar Isaac, Diego Luna, Gael Garcia Bernal
  SOUTH ASIAN: Hrithik Roshan, Ranveer Singh, Shahid Kapoor, Tiger Shroff, Vidyut Jammwal,
    Dev Patel, Riz Ahmed`}

══ STEP 1: MEASURE THESE TRAITS FIRST ══
1. SKIN TONE: pale / light / medium / tan / brown / dark-brown / deep-dark
2. FACE SHAPE: oval / round / square / oblong / diamond / heart / triangle
3. JAW: sharp-angular / moderate / soft-rounded / wide-square / recessed
4. CHEEKBONES: prominent-high / average / flat / wide
5. EYES: almond / round / hooded / deep-set / wide-set / close-set / monolid
6. NOSE: wide-flat / broad / medium / narrow / upturned / aquiline
7. LIPS: full / medium / thin
8. FACE FULLNESS: very-lean / lean / average / full / heavy
9. ETHNICITY: East-Asian / South-Asian / Southeast-Asian / Black-African / Black-American / Middle-Eastern / Latino / White-European / Mixed

══ STEP 2: MATCHING RULES ══
- SKIN TONE IS NON-NEGOTIABLE: never match across more than one skin tone category.
- FACE SHAPE MUST MATCH: round face → only round-faced matches. Sharp angular jaw → only angular matches.
- CATEGORY IS OPEN: if bone structure matches a model better than an actor, return the model. If they look like an athlete, return the athlete.
- SIMILARITY must be honest: 70–78% = strong (multiple features align), 60–69% = good, 55–59% = moderate. Never 80%+ unless near-identical.
- SHARED TRAITS: name at least 2 specific anatomical features (e.g. "matching high cheekbones, almond eyes, oval face"). Never use "vibe", "energy", or "look".

══ STEP 3: OUTPUT ══
Return ONLY this JSON — no markdown, no explanation, nothing else:
{
  "match1": { "celebrity": "Full Name", "profession": "<Actor|Model|Athlete|Musician|Influencer|Fitness Model>", "similarity": <55–78>, "shared_traits": "<2+ specific anatomical features>" },
  "match2": { "celebrity": "Full Name", "profession": "<profession>", "similarity": <55–75>, "shared_traits": "<2+ specific anatomical features>" },
  "match3": { "celebrity": "Full Name", "profession": "<profession>", "similarity": <55–72>, "shared_traits": "<2+ specific anatomical features>" }
}`

  // ── Fallback system prompt — fame-focused, simpler ──────────────────────────
  const fallbackSystemPrompt = `You are a celebrity identification assistant. Given a face photo, name the most famous person this person looks like — actors, models, athletes, or influencers with mainstream recognition (100k+ followers or widely known name).

Return ONLY this JSON — no markdown, nothing else:
{
  "match1": { "celebrity": "Full Name", "profession": "<Actor|Model|Athlete|Musician|Influencer>", "similarity": <55–75>, "shared_traits": "<2+ specific anatomical features that match>" },
  "match2": { "celebrity": "Full Name", "profession": "<profession>", "similarity": <number>, "shared_traits": "<features>" },
  "match3": { "celebrity": "Full Name", "profession": "<profession>", "similarity": <number>, "shared_traits": "<features>" }
}`

  // ── Primary call ───────────────────────────────────────────────────────────
  let parsed
  try {
    const primaryResp = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system:     systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
          { type: 'text',  text: `Analyze this person's facial features — bone structure, eye shape, jawline, skin tone, and overall aesthetic. Match them to the most visually similar real celebrity, model, athlete, or public figure. Do not default to the most famous person — find the most accurate facial match. If they resemble a model more than an actor, say the model. Return ONLY the JSON.` },
        ],
      }],
    })

    const primaryRaw = primaryResp.content[0]?.text?.trim() ?? ''
    console.log('[celeb] Primary raw (first 300):', primaryRaw.slice(0, 300))

    parsed = parseJSON(primaryRaw, 'Celebrity matcher')
    const primaryLog = [parsed.match1, parsed.match2, parsed.match3]
      .filter(Boolean)
      .map(m => `${m.celebrity} [${m.profession ?? '?'}] ${m.similarity}%`)
      .join(' | ')
    console.log('[celeb] Primary matches:', primaryLog || '(none parsed)')
  } catch (err) {
    console.warn('[celeb] Primary call failed:', err.message)
    throw err
  }

  // ── Fallback: retry if any name looks generic or unrecognisable ────────────
  if (isGenericOrUnknown(parsed)) {
    console.log('[celeb] Generic/unknown name detected — retrying with fallback prompt...')
    try {
      const fallbackResp = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system:     fallbackSystemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: faceMediaType, data: faceBase64 } },
            { type: 'text',  text: `Who is the most famous person this person looks like? Be specific — give a real name of someone with over 100k followers or mainstream recognition. Return ONLY the JSON.` },
          ],
        }],
      })

      const fallbackRaw = fallbackResp.content[0]?.text?.trim() ?? ''
      console.log('[celeb] Fallback raw (first 300):', fallbackRaw.slice(0, 300))

      const fallbackParsed = parseJSON(fallbackRaw, 'Celebrity matcher fallback')
      const fallbackLog = [fallbackParsed.match1, fallbackParsed.match2, fallbackParsed.match3]
        .filter(Boolean)
        .map(m => `${m.celebrity} [${m.profession ?? '?'}] ${m.similarity}%`)
        .join(' | ')
      console.log('[celeb] Fallback matches:', fallbackLog || '(none parsed)')
      return fallbackParsed
    } catch (fallbackErr) {
      console.warn('[celeb] Fallback also failed (returning primary result):', fallbackErr.message)
      // Fall through — return the original parsed result even if names were weak
    }
  }

  return parsed
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

    const { faceImage, bodyImage, sideImage, gender = 'male', skipBody = false } = req.body
    if (!faceImage) {
      return res.status(400).json({ error: 'Face image is required' })
    }
    if (!skipBody && !bodyImage) {
      return res.status(400).json({ error: 'Body image is required (or pass skipBody: true)' })
    }

    // Detect actual media type BEFORE stripping the prefix
    const faceMediaType = getMediaType(faceImage)
    const faceBase64 = stripPrefix(faceImage)
    const bodyB64ForCache = skipBody ? null : stripPrefix(bodyImage)

    // Side profile (optional — undefined / null / missing are all handled)
    const sideBase64    = sideImage ? stripPrefix(sideImage)    : null
    const sideMediaType = sideImage ? getMediaType(sideImage)   : null

    // ── L1: in-process memory cache (ephemeral, fastest path) ─────────────────
    const cacheKey = hashImages(faceBase64, bodyB64ForCache ?? 'SKIP', sideBase64)
    if (scoreCache.has(cacheKey)) {
      console.log('[aiScore] L1 cache hit:', cacheKey)
      return res.json(scoreCache.get(cacheKey))
    }

    // ── L2: Supabase persistent cache (survives deploys, 7-day TTL) ───────────
    const fullHash = computeFullHash(faceBase64, bodyB64ForCache, sideBase64)
    const sbCached = await getScanCache(fullHash)
    if (sbCached) {
      console.log('[aiScore] L2 Supabase cache hit:', fullHash.slice(0, 16))
      // Promote to L1 so subsequent requests in this process skip Supabase entirely
      if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
      scoreCache.set(cacheKey, sbCached)
      return res.json(sbCached)
    }

    console.log('[aiScore] Cache miss — acquiring slot for Claude scoring...')

    // Acquire concurrency slot only now — cache hits above never need it
    await acquireSlot()
    let bodyResult, faceResult, celebResult

    try {
      if (skipBody) {
        // Only run face + celebrity — body defaults applied
        console.log('[aiScore] skipBody=true — running face + celebrity only...')
        console.log('[aiScore] Side profile:', sideBase64 ? 'YES' : 'NO')
        ;[faceResult, celebResult] = await Promise.all([
          withRetry(() => getFaceScore(faceBase64, faceMediaType, gender, sideBase64, sideMediaType)),
          withRetry(() => getCelebrityMatch(faceBase64, faceMediaType, gender)).catch(err => {
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
        console.log('[aiScore] Side profile:', sideBase64 ? 'YES' : 'NO')
        ;[bodyResult, faceResult, celebResult] = await Promise.all([
          withRetry(() => getBodyScore(bodyBase64, bodyMediaType)),
          withRetry(() => getFaceScore(faceBase64, faceMediaType, gender, sideBase64, sideMediaType)),
          withRetry(() => getCelebrityMatch(faceBase64, faceMediaType, gender)).catch(err => {
            console.warn('[aiScore] Celebrity match failed (non-fatal):', err.message)
            return null
          }),
        ])
        console.log('[aiScore] Body:', bodyResult.body_category, bodyResult.body_score, '| cap:', bodyResult.body_cap)
      }
    } finally {
      releaseSlot()
    }

    console.log('[aiScore] Face:', faceResult.face_score, '| grooming:', faceResult.grooming_score, '| structure:', faceResult.facial_structure)
    console.log('[aiScore] Celebrity matches:', celebResult
      ? [celebResult.match1, celebResult.match2, celebResult.match3]
          .filter(Boolean)
          .map(m => `${m.celebrity} [${m.profession ?? 'unknown'}] ${m.similarity}%`)
          .join(' | ')
      : 'unavailable')

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
      bodyReasoning:     bodyResult.reasoning,
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
    }

    // ── Write to both caches (L1 in-memory + L2 Supabase) ─────────────────────
    if (scoreCache.size >= 500) scoreCache.delete(scoreCache.keys().next().value)
    scoreCache.set(cacheKey, result)
    // L2 write is fire-and-forget — never blocks the response
    setScanCache(fullHash, result).then(() => {
      console.log('[aiScore] L2 Supabase cache written:', fullHash.slice(0, 16))
    }).catch(err => {
      console.warn('[aiScore] L2 Supabase cache write failed (non-fatal):', err.message)
    })

    // ── Persist to scan history (fire-and-forget, skip demo users) ────────────
    if (req.userId && req.userId !== 'demo') {
      saveScanHistory(req.userId, {
        overallScore:    result.overallScore,
        faceScore:       result.faceScore,
        bodyScore:       result.bodyScore,
        groomingScore:   result.groomingScore,
        tier:            result.tier,
        celebrityMatch:  result.celebrityMatches?.[0]?.celebrity ?? null,
      }).catch(err => console.warn('[aiScore] scan_history save failed (non-fatal):', err.message))
    }

    res.json(result)
  } catch (err) {
    console.error('[aiScore] Error:', err.message)
    const msg = (err.message || '').toLowerCase()
    const status = err.status ?? err.statusCode ?? 0
    const isRateLimit =
      status === 429 || status === 529 ||
      msg.includes('quota') || msg.includes('rate limit') ||
      msg.includes('rate_limit') || msg.includes('exceeded') ||
      msg.includes('overloaded') || msg.includes('capacity') ||
      msg.includes('too many') || msg.includes('limit')

    if (isRateLimit) {
      return res.status(429).json({ error: 'rate_limited', retryAfter: 60 })
    }
    // Never expose raw Anthropic error strings to the client
    res.status(500).json({ error: 'AI scoring failed — please try again.' })
  }
})

module.exports = router
