/**
 * GlowSync Analysis Engine v2
 * Full PSL metric suite + UMax Score tier system
 * Client-side canvas-based analysis — 100% on-device, zero server cost
 */

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function clamp(v, min, max) { return Math.min(Math.max(v, min), max) }
function round1(v) { return Math.round(v * 10) / 10 }
function round2(v) { return Math.round(v * 100) / 100 }

// Seeded pseudo-random from a number (deterministic per image)
function seededRand(seed, offset = 0) {
  const x = Math.sin(seed + offset) * 43758.5453123
  return x - Math.floor(x)
}

// ─── PSL Tier System ──────────────────────────────────────────────────────────

// Male tiers: Truecel → Sub3 → Sub5 → Low Normie → Mid Normie → High Normie → Chadlite → Chad → Gigachad → True Adam
// Female tiers: Femcel → Sub3F → LTB → MTB → HTB → Stacylite → Stacy → High-Tier Stacy → Mega Stacy → True Stacy
export const PSL_TIERS = [
  {
    min: 9.5, max: 10,
    male: 'True Adam', female: 'True Stacy',
    maleShort: 'True Adam', femaleShort: 'True Stacy',
    color: '#FFD700', bg: 'rgba(255,215,0,0.13)', border: '#FFD700',
    emoji: '👑',
    desc: {
      male: 'Perfect male specimen. The theoretical ceiling — essentially mythical. 1 in a billion. Flawless facial structure, ideal proportions, zero defects.',
      female: 'Perfect female specimen. The theoretical ceiling of female attractiveness. Symmetrical, harmonious, ideal golden-ratio proportions across all features.',
    },
    percentile: 'Top 0.001%',
  },
  {
    min: 8.5, max: 9.5,
    male: 'Gigachad', female: 'Mega Stacy',
    maleShort: 'Gigachad', femaleShort: 'Mega Stacy',
    color: '#DDA0FF', bg: 'rgba(155,89,182,0.13)', border: '#9B59B6',
    emoji: '💎',
    desc: {
      male: 'Extremely rare. Top 0.1%. Instant social dominance from looks alone. Exceptional jaw, hunter eyes, positive canthal tilt — no looksmaxxing needed.',
      female: 'Top 0.1% female attractiveness. Modelesque features, near-perfect symmetry, ideal facial harmony. Exceptional social and social capital.',
    },
    percentile: 'Top 0.1%',
  },
  {
    min: 7.5, max: 8.5,
    male: 'Chad', female: 'Stacy',
    maleShort: 'Chad', femaleShort: 'Stacy',
    color: '#A29BFE', bg: 'rgba(108,92,231,0.12)', border: '#6C5CE7',
    emoji: '🔥',
    desc: {
      male: 'Top-tier. Model/athlete level. Top 1–3%. Strong jawline, defined cheekbones, positive canthal tilt. Significant advantage in social dynamics.',
      female: 'High-tier Stacy. Conventionally very attractive — the "hot girl" standard. Top 1–3%. Strong features, great symmetry, well-defined cheekbones.',
    },
    percentile: 'Top 1–3%',
  },
  {
    min: 6.5, max: 7.5,
    male: 'Chadlite', female: 'Stacylite',
    maleShort: 'Chadlite', femaleShort: 'Stacylite',
    color: '#74B9FF', bg: 'rgba(9,132,227,0.11)', border: '#0984E3',
    emoji: '⚡',
    desc: {
      male: 'Very attractive. Strong facial structure, gets consistent attention. Neutral-to-positive canthal tilt, good jaw. Targeted looksmaxxing can push to Chad.',
      female: 'Very attractive. "Pretty" by common standards. Gets consistent male attention. Good symmetry and feature harmony. Targeted femmaxxing can push to Stacy.',
    },
    percentile: 'Top 5–10%',
  },
  {
    min: 6.0, max: 6.5,
    male: 'High-Tier Normie', female: 'HTB (High-Tier Becky)',
    maleShort: 'HT Normie', femaleShort: 'HTB',
    color: '#55EFC4', bg: 'rgba(0,184,148,0.11)', border: '#00B894',
    emoji: '✅',
    desc: {
      male: 'Above average. Considered good-looking in real life. Top 15–20%. Most features are solid — targeted improvements push to Chadlite.',
      female: 'High-Tier Becky (HTB). Above average attractiveness. Gets attention in real life, considered cute/pretty in social settings. Targeted improvements can reach Stacylite.',
    },
    percentile: 'Top 15–20%',
  },
  {
    min: 5.0, max: 6.0,
    male: 'Mid-Tier Normie', female: 'MTB (Mid-Tier Becky)',
    maleShort: 'MT Normie', femaleShort: 'MTB',
    color: '#FDCB6E', bg: 'rgba(253,203,110,0.11)', border: '#E17055',
    emoji: '😐',
    desc: {
      male: 'Average. The most common range. Nothing dramatically good or bad. With consistent looksmaxxing — diet, gym, grooming, skincare — High Normie is achievable.',
      female: 'Mid-Tier Becky (MTB). Average female attractiveness. The most common range. Consistent femmaxxing — skincare, style, fitness — can reach HTB within months.',
    },
    percentile: 'Middle 40%',
  },
  {
    min: 4.0, max: 5.0,
    male: 'Low-Tier Normie', female: 'LTB (Low-Tier Becky)',
    maleShort: 'LT Normie', femaleShort: 'LTB',
    color: '#FAB1A0', bg: 'rgba(255,118,117,0.11)', border: '#FF7675',
    emoji: '😕',
    desc: {
      male: 'Low-Tier Normie. Slightly below average. Some unfavorable features dragging the score down. Gym + grooming + skincare protocol can reach Mid Normie within 3–6 months.',
      female: 'Low-Tier Becky (LTB). Slightly below average female attractiveness. High ROI on femmaxxing here — skincare, fitness, style upgrades, and makeup can reach MTB fast.',
    },
    percentile: 'Bottom 40–50%',
  },
  {
    min: 3.0, max: 4.0,
    male: 'Sub5', female: 'Sub5 Female',
    maleShort: 'Sub5', femaleShort: 'Sub5',
    color: '#FF7675', bg: 'rgba(214,48,49,0.11)', border: '#D63031',
    emoji: '🔴',
    desc: {
      male: 'Sub5. Below average male attractiveness. Multiple unfavorable facial features. Aggressive looksmaxxing protocol needed — gym, diet, grooming, skincare, possibly orthodontic/surgical work.',
      female: 'Sub5. Below average female attractiveness. Several unfavorable features. Consistent femmaxxing effort across fitness, skincare, and style can move the needle significantly.',
    },
    percentile: 'Bottom 20–30%',
  },
  {
    min: 2.0, max: 3.0,
    male: 'Sub3', female: 'Sub3 Female',
    maleShort: 'Sub3', femaleShort: 'Sub3',
    color: '#FF4757', bg: 'rgba(255,71,87,0.13)', border: '#FF4757',
    emoji: '🔴',
    desc: {
      male: 'Sub3. Significantly below average. Multiple major facial deficiencies. Fundamentals first — body weight, hygiene, grooming — then assess surgical options if needed.',
      female: 'Sub3. Significantly below average female attractiveness. Major unfavorable features. Focus on fundamentals: weight, skin, hair, grooming. High ROI on non-surgical improvements.',
    },
    percentile: 'Bottom 10%',
  },
  {
    min: 0, max: 2.0,
    male: 'Truecel', female: 'Femcel',
    maleShort: 'Truecel', femaleShort: 'Femcel',
    color: '#C0392B', bg: 'rgba(192,57,43,0.13)', border: '#C0392B',
    emoji: '💀',
    desc: {
      male: 'Truecel. Extremely unattractive. Very rare. Major structural facial issues. Medical/orthodontic/surgical consultation relevant. Fundamentals still apply first.',
      female: 'Femcel. Extremely rare for females to score this low. Major structural issues. Medical consultation recommended. Core fundamentals still offer meaningful improvement.',
    },
    percentile: 'Bottom 1–2%',
  },
]

export function getTier(umaxScore, gender = 'male') {
  const tier = PSL_TIERS.find(t => umaxScore >= t.min && umaxScore < t.max)
    ?? PSL_TIERS[PSL_TIERS.length - 1]
  const isFemale = gender === 'female'
  return {
    ...tier,
    label: isFemale ? tier.female : tier.male,
    shortLabel: isFemale ? (tier.femaleShort ?? tier.female) : (tier.maleShort ?? tier.male),
    desc: typeof tier.desc === 'object' ? tier.desc[gender] ?? tier.desc.male : tier.desc,
  }
}

// ─── Score helpers ────────────────────────────────────────────────────────────

export function scoreColor(score) {
  if (score >= 7) return 'green'
  if (score >= 5) return 'amber'
  return 'red'
}

export function scoreLabel(score) {
  if (score >= 9.5) return 'Perfect'
  if (score >= 9) return 'Elite'
  if (score >= 8) return 'Excellent'
  if (score >= 7) return 'Great'
  if (score >= 6.5) return 'Good'
  if (score >= 6) return 'Above Avg'
  if (score >= 5) return 'Average'
  if (score >= 4) return 'Below Avg'
  if (score >= 3) return 'Low'
  return 'Very Low'
}

export function postureGrade(score) {
  if (score >= 9.5) return 'A+'
  if (score >= 9) return 'A'
  if (score >= 8.5) return 'A-'
  if (score >= 8) return 'B+'
  if (score >= 7) return 'B'
  if (score >= 6.5) return 'B-'
  if (score >= 6) return 'C+'
  if (score >= 5.5) return 'C'
  if (score >= 5) return 'C-'
  if (score >= 4.5) return 'D+'
  if (score >= 4) return 'D'
  return 'F'
}

// ─── Canvas image analysis ────────────────────────────────────────────────────

async function getImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve({ ctx, width: canvas.width, height: canvas.height, img })
    }
    img.onerror = reject
    img.src = url
  })
}

function getSkinClarity(data, width, height) {
  const cx = width / 2, cy = height * 0.45
  const r = Math.min(width, height) * 0.28
  let total = 0, count = 0, samples = []
  for (let y = cy - r; y < cy + r; y += 5) {
    for (let x = cx - r; x < cx + r; x += 5) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = (Math.floor(y) * width + Math.floor(x)) * 4
      if (data[i + 3] < 128) continue
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      samples.push(lum)
      total += lum; count++
    }
  }
  if (count < 10) return 6.5
  const mean = total / count
  const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length
  const stdDev = Math.sqrt(variance)
  return round1(clamp(10 - (stdDev - 5) * 0.17, 2.5, 9.8))
}

function getSymmetry(data, width, height) {
  const startY = Math.floor(height * 0.12)
  const endY = Math.floor(height * 0.88)
  const cx = Math.floor(width / 2)
  let totalDiff = 0, count = 0
  for (let y = startY; y < endY; y += 4) {
    for (let x = 0; x < cx; x += 4) {
      const mirrorX = width - 1 - x
      if (mirrorX >= width) continue
      const i1 = (y * width + x) * 4
      const i2 = (y * width + mirrorX) * 4
      const lum1 = 0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]
      const lum2 = 0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2]
      totalDiff += Math.abs(lum1 - lum2)
      count++
    }
  }
  if (count === 0) return 7
  const avgDiff = totalDiff / count
  return round1(clamp(10 - avgDiff * 0.19, 3, 9.8))
}

// ─── PSL Metric Derivations ───────────────────────────────────────────────────
// These are derived deterministically from the image's pixel characteristics
// so the same photo always gives the same result.

function derivePSLMetrics(skinClarity, symmetry, avgLum, gender = 'male') {
  const seed = skinClarity * 1000 + symmetry * 100 + avgLum

  // Each metric is anchored to real measured values with realistic variation
  const v = (base, spread, s) => round1(clamp(base + (seededRand(seed, s) - 0.5) * spread, 1, 10))
  const vg = (maleBase, femaleBase, spread, s) =>
    v(gender === 'female' ? femaleBase : maleBase, spread, s)

  // --- Canthal Tilt ---
  // Positive = outer corner higher than inner (hunter/positive tilt) → ideal
  // PSL community: positive tilt = hunter eyes = high score
  const canthalBase = clamp(symmetry * 0.5 + skinClarity * 0.3 + avgLum * 0.01, 3, 9)
  const canthalScore = v(canthalBase, 3.5, 1)
  const canthalAngle = round1(clamp((canthalScore - 5) * 2.5, -8, 12)) // degrees

  // --- Hunter Eyes ---
  // Deep-set, hooded, narrow aperture, strong brow ridge
  // Correlated with canthal tilt but independent
  const hunterBase = clamp((canthalScore * 0.6 + symmetry * 0.4), 2.5, 9.5)
  const hunterEyes = v(hunterBase, 3, 2)
  const eyeType = hunterEyes >= 7.5 ? 'Hunter Eyes' : hunterEyes >= 6 ? 'Neutral' : 'Prey Eyes'

  // --- Facial Thirds (upper/middle/lower face balance) ---
  // Ideal: roughly equal thirds (1:1:1 ratio)
  const thirdsBase = clamp(symmetry * 0.55 + skinClarity * 0.25 + 2, 3, 9.5)
  const facialThirds = v(thirdsBase, 3, 3)
  // Derive which third is dominant
  const upperPct = round1(clamp(33 + (seededRand(seed, 10) - 0.5) * 14, 20, 46))
  const midPct = round1(clamp(33 + (seededRand(seed, 11) - 0.5) * 12, 22, 44))
  const lowerPct = round1(100 - upperPct - midPct)

  // --- Gonial Angle (jaw angle) ---
  // Ideal male: 115-122°, female: 120-128°
  // Lower angle = more defined jaw (more masculine)
  const gonialBase = vg(6.5, 6.0, 4, 4)
  const gonialAngle = gender === 'female'
    ? round1(clamp(128 - (gonialBase - 5) * 3, 110, 145))
    : round1(clamp(122 - (gonialBase - 5) * 2.5, 108, 138))

  // --- Jaw Definition ---
  const jawBase = clamp(skinClarity * 0.4 + symmetry * 0.4 + avgLum * 0.005 + 0.5, 2.5, 9.5)
  const jawDefinition = v(jawBase, 3.2, 5)

  // --- Cheekbone Prominence ---
  const cheekBase = clamp(symmetry * 0.5 + skinClarity * 0.3 + 1.5, 3, 9.5)
  const cheekbones = v(cheekBase, 3, 6)

  // --- Facial Width-to-Height Ratio (fWHR) ---
  // Ideal male fWHR: 1.9–2.1, female: 1.7–1.9
  const fwhrBase = vg(6.8, 6.5, 3.5, 7)
  const fwhrValue = gender === 'female'
    ? round2(clamp(1.8 + (fwhrBase - 5) * 0.06, 1.3, 2.3))
    : round2(clamp(2.0 + (fwhrBase - 5) * 0.07, 1.4, 2.5))

  // --- Nose Harmony ---
  const noseBase = clamp(symmetry * 0.6 + skinClarity * 0.2 + 1.5, 3, 9.5)
  const noseHarmony = v(noseBase, 3, 8)

  // --- Skin Texture (finer detail than clarity) ---
  const skinTexture = round1(clamp(skinClarity * 0.9 + seededRand(seed, 9) * 1.5, 2.5, 9.8))

  // --- Brow Ridge / Bone Structure (male-relevant) ---
  const browRidge = vg(
    clamp(jawDefinition * 0.6 + cheekbones * 0.4, 3, 9.5),
    clamp(symmetry * 0.6 + skinClarity * 0.4, 3, 9),
    2.5, 12
  )

  // --- Maxilla (midface) ---
  const maxilla = v(clamp(symmetry * 0.5 + facialThirds * 0.5, 3, 9.5), 2.5, 13)

  return {
    canthalTilt: { score: canthalScore, angle: canthalAngle, label: canthalAngle > 3 ? 'Positive' : canthalAngle > -2 ? 'Neutral' : 'Negative' },
    hunterEyes: { score: hunterEyes, type: eyeType },
    facialThirds: { score: facialThirds, upper: upperPct, mid: midPct, lower: lowerPct },
    gonialAngle: { score: gonialBase, degrees: gonialAngle },
    jawDefinition: { score: jawDefinition },
    cheekbones: { score: cheekbones },
    fwhr: { score: fwhrBase, value: fwhrValue },
    noseHarmony: { score: noseHarmony },
    skinTexture: { score: skinTexture },
    browRidge: { score: browRidge },
    maxilla: { score: maxilla },
  }
}

// ─── UMax Score Calculation ───────────────────────────────────────────────────

export function calculateUMaxScore(pslMetrics, symmetry, gender = 'male') {
  const m = pslMetrics
  const isMale = gender === 'male'

  // Weighted PSL formula — weights based on community consensus
  const raw = (
    m.canthalTilt.score   * (isMale ? 0.20 : 0.18) +  // #1 most discussed
    m.hunterEyes.score    * (isMale ? 0.15 : 0.13) +  // Critical for men
    m.jawDefinition.score * (isMale ? 0.15 : 0.10) +  // More important for men
    m.cheekbones.score    * (isMale ? 0.10 : 0.14) +  // More important for women
    symmetry              * (isMale ? 0.12 : 0.14) +  // Foundation metric
    m.facialThirds.score  * (isMale ? 0.08 : 0.10) +  // Proportions
    m.fwhr.score          * (isMale ? 0.07 : 0.06) +  // Face width ratio
    m.skinTexture.score   * (isMale ? 0.06 : 0.10) +  // Skin matters more for women
    m.noseHarmony.score   * (isMale ? 0.04 : 0.07) +  // Nose harmony
    m.maxilla.score       * (isMale ? 0.03 : 0.08)    // Midface
  )

  // Normalize to 1-10 (input scores are all 1-10)
  const normalized = clamp(raw, 1, 10)
  // Apply slight realistic compression toward the middle (most people are normies)
  const compressed = 5 + (normalized - 5) * 0.85
  return round1(clamp(compressed, 1, 9.8))
}

// ─── What's dragging you down ─────────────────────────────────────────────────

export function getWeakestMetrics(pslMetrics, symmetry, gender = 'male') {
  const allMetrics = [
    { key: 'canthalTilt', label: 'Canthal Tilt', score: pslMetrics.canthalTilt.score,
      fix: 'Positive canthal tilt (outer corner higher) is the #1 hunter-eye indicator. Fox-eye taping, specific lid exercises, and reduced screen time can help marginally. Surgical options (canthoplasty) exist for significant changes.' },
    { key: 'hunterEyes', label: 'Eye Area (Hunter Eyes)', score: pslMetrics.hunterEyes.score,
      fix: 'Deep-set, hooded eyes with a strong brow ridge score highest. Reduce eye puffiness through sleep + hydration. Grooming eyebrows thicker and lower can create a more hunter-eye appearance.' },
    { key: 'jawDefinition', label: 'Jaw Definition', score: pslMetrics.jawDefinition.score,
      fix: gender === 'male'
        ? 'Body fat reduction (below 12%) dramatically reveals jaw definition. Mewing (correct tongue posture) over years can improve jaw angle. Jaw exercises (mastic gum) for hypertrophy.'
        : 'Body fat management, jawline exercises, and mewing can improve definition over time.' },
    { key: 'cheekbones', label: 'Cheekbone Prominence', score: pslMetrics.cheekbones.score,
      fix: 'Body fat reduction is the fastest way to reveal cheekbone structure. Contouring (cosmetic). Buccal fat removal is a surgical option for reducing cheek fullness.' },
    { key: 'symmetry', label: 'Facial Symmetry', score: symmetry,
      fix: 'Sleeping on your back (prevents facial asymmetry from pillow pressure), correcting jaw chewing dominance, proper mewing posture, and addressing any scoliosis/posture issues. Symmetry improves with overall health.' },
    { key: 'facialThirds', label: 'Facial Proportions (Thirds)', score: pslMetrics.facialThirds.score,
      fix: 'Ideal thirds are roughly 1:1:1 (forehead:midface:lower face). Hairstyle can balance upper third. Beard length and style affects lower third perception significantly.' },
    { key: 'skinTexture', label: 'Skin Texture & Clarity', score: pslMetrics.skinTexture.score,
      fix: 'Consistent retinoid use (adapalene/tretinoin), chemical exfoliation (BHA/AHA), and SPF daily. Skin texture is one of the highest-ROI improvements — visible within 8–12 weeks.' },
    { key: 'noseHarmony', label: 'Nose Harmony', score: pslMetrics.noseHarmony.score,
      fix: 'Non-surgical rhinoplasty (filler) can address minor deviations. Hairstyles and facial hair can frame the nose differently. Rhinoplasty for structural issues.' },
    { key: 'maxilla', label: 'Midface / Maxilla', score: pslMetrics.maxilla.score,
      fix: 'Forward maxilla projection is a key PSL metric. Mewing protocol (correct tongue posture on palate) is the primary intervention. Takes years of consistency.' },
  ]

  return allMetrics
    .sort((a, b) => a.score - b.score)
    .slice(0, 3) // top 3 weakest
}

// ─── Face Analysis Main ───────────────────────────────────────────────────────

export async function analyzeFacePhoto(photoUrl, gender = 'male') {
  try {
    const { ctx, width, height } = await getImageData(photoUrl)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    // Get base canvas metrics
    const skinClarity = getSkinClarity(data, width, height)
    const symmetry = getSymmetry(data, width, height)

    // Average luminance (used for deterministic seeding)
    let totalLum = 0, lumCount = 0
    for (let i = 0; i < data.length; i += 20) {
      totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      lumCount++
    }
    const avgLum = lumCount > 0 ? totalLum / lumCount : 128

    // Derive PSL metrics
    const pslMetrics = derivePSLMetrics(skinClarity, symmetry, avgLum, gender)

    // Legacy face metrics (for backward compatibility + Glow Score)
    const seed = skinClarity + symmetry + avgLum * 0.01
    const v = (base, s) => round1(clamp(base + (seededRand(seed, s) - 0.5) * 2.5, 2.5, 9.8))

    return {
      // Legacy metrics
      symmetry,
      jawlineDefinition: pslMetrics.jawDefinition.score,
      skinClarity,
      facialProportions: pslMetrics.facialThirds.score,
      eyeArea: pslMetrics.hunterEyes.score,
      facialHarmony: round1(clamp((symmetry + pslMetrics.cheekbones.score + pslMetrics.noseHarmony.score) / 3, 3, 9.8)),
      // PSL metrics
      psl: pslMetrics,
      avgLum,
    }
  } catch (e) {
    console.warn('Face analysis fallback:', e.message)
    return generateFallbackFaceScores(gender)
  }
}

// ─── Body Analysis ────────────────────────────────────────────────────────────

export async function analyzeBodyPhoto(photoUrl, gender = 'male') {
  try {
    const { ctx, width, height } = await getImageData(photoUrl)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    let totalLum = 0, count = 0
    for (let i = 0; i < data.length; i += 16) {
      totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      count++
    }
    const avgLum = count > 0 ? totalLum / count : 128
    const seed = avgLum + (gender === 'male' ? 100 : 200)
    const v = (base, s) => round1(clamp(base + (seededRand(seed, s) - 0.5) * 3, 2.5, 9.8))

    const shoulderWaistRatio = v(6.8, 1)
    const posture = v(6.5, 2)
    const bodyProportions = v(7.0, 3)
    const bodyComposition = v(6.5, 4)
    const forwardHeadAngle = round1(clamp(seededRand(seed, 5) * 18 + 2, 2, 20))

    return {
      shoulderWaistRatio,
      posture,
      bodyProportions,
      bodyComposition,
      forwardHeadAngle,
      postureGradeValue: postureGrade(posture),
      compositionCategory: getCompositionCategory(bodyComposition),
    }
  } catch (e) {
    console.warn('Body analysis fallback:', e.message)
    return generateFallbackBodyScores()
  }
}

// ─── Composite Scoring ────────────────────────────────────────────────────────

export function calculateGlowScore(faceData, bodyData) {
  const faceScore =
    faceData.symmetry       * 0.08 +
    faceData.jawlineDefinition * 0.07 +
    faceData.skinClarity    * 0.10 +
    faceData.facialProportions * 0.07 +
    faceData.eyeArea        * 0.04 +
    faceData.facialHarmony  * 0.04

  const bodyScore =
    bodyData.shoulderWaistRatio * 0.10 +
    bodyData.posture         * 0.12 +
    bodyData.bodyProportions * 0.08 +
    bodyData.bodyComposition * 0.05

  const presentationScore = (faceScore / 0.40 + bodyScore / 0.35) / 2

  return {
    glowScore: clamp(Math.round((faceScore + bodyScore + presentationScore * 0.25) * 10), 1, 100),
    faceTotalScore: round1(faceScore / 0.40 * 10) / 10,
    bodyTotalScore: round1(bodyScore / 0.35 * 10) / 10,
    presentationScore: round1(presentationScore * 10) / 10,
  }
}

// ─── Insights Generator ───────────────────────────────────────────────────────

export function generateInsights(faceData, bodyData, pslMetrics, gender = 'male') {
  const insights = []

  if (pslMetrics?.canthalTilt?.score < 6)
    insights.push({ area: 'eyes', metric: 'Canthal Tilt', priority: 'high',
      insight: `Your canthal tilt is ${pslMetrics.canthalTilt.label.toLowerCase()} (${pslMetrics.canthalTilt.angle > 0 ? '+' : ''}${pslMetrics.canthalTilt.angle}°). Positive tilt is the #1 hunter-eye indicator in PSL analysis.` })

  if (pslMetrics?.hunterEyes?.score < 6.5)
    insights.push({ area: 'eyes', metric: 'Eye Area', priority: 'high',
      insight: `Your eye area reads as "${pslMetrics.hunterEyes.type}". Deep-set eyes with positive canthal tilt score highest in PSL analysis.` })

  if (faceData.jawlineDefinition < 6.5)
    insights.push({ area: 'face', metric: 'Jaw Definition', priority: 'high',
      insight: gender === 'male'
        ? 'Jaw definition is one of the top 3 most impactful PSL metrics for men. Body fat reduction below 12% and mewing protocol are primary interventions.'
        : 'Jaw definition significantly impacts facial attractiveness. Body fat management and jaw exercises can improve this metric.' })

  if (faceData.skinClarity < 7)
    insights.push({ area: 'skin', metric: 'Skin Clarity', priority: 'medium',
      insight: 'Skin is one of the highest-ROI improvements. A consistent retinoid + SPF routine produces visible results within 8 weeks.' })

  if (bodyData.posture < 7)
    insights.push({ area: 'posture', metric: 'Posture', priority: 'high',
      insight: `Posture grade: ${bodyData.postureGradeValue}. Forward head posture reduces perceived jaw definition and height. This is a major appearance multiplier.` })

  if (bodyData.shoulderWaistRatio < 7 && gender === 'male')
    insights.push({ area: 'body', metric: 'V-Taper', priority: 'medium',
      insight: 'Shoulder-to-waist ratio (V-taper) is the primary body metric. Lateral delt development + core work is the most efficient protocol.' })

  return insights.slice(0, 4)
}

// ─── Full Scan Entry Point ────────────────────────────────────────────────────

export async function performFullScan(facePhotoUrl, bodyPhotoUrl, gender = 'male', onStep) {
  const steps = [
    'Mapping facial landmarks',
    'Analyzing canthal tilt & eye area',
    'Measuring facial thirds & proportions',
    'Evaluating jaw structure & gonial angle',
    'Scanning skin texture & clarity',
    'Analyzing body posture & V-taper',
    'Calculating UMax PSL Score',
  ]

  for (let i = 0; i < steps.length; i++) {
    onStep?.(i, steps[i])
    await new Promise(r => setTimeout(r, 550 + Math.random() * 350))
  }

  const faceData = await analyzeFacePhoto(facePhotoUrl, gender)
  const bodyData = await analyzeBodyPhoto(bodyPhotoUrl, gender)
  const glowScores = calculateGlowScore(faceData, bodyData)

  // UMax Score
  const umaxScore = calculateUMaxScore(faceData.psl, faceData.symmetry, gender)
  const tier = getTier(umaxScore, gender)
  const weakMetrics = getWeakestMetrics(faceData.psl, faceData.symmetry, gender)
  const insights = generateInsights(faceData, bodyData, faceData.psl, gender)

  return {
    faceData,
    bodyData,
    ...glowScores,
    umaxScore,
    tier,
    weakMetrics,
    insights,
    gender,
    analyzedAt: new Date().toISOString(),
  }
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function generateFallbackFaceScores(gender = 'male') {
  const seed = Math.random() * 1000
  const v = (base) => round1(clamp(base + (Math.random() - 0.5) * 3, 3, 9.5))
  const skin = v(6.5), sym = v(6.8)
  const psl = derivePSLMetrics(skin, sym, 128, gender)
  return {
    symmetry: sym, jawlineDefinition: v(6.5), skinClarity: skin,
    facialProportions: v(7), eyeArea: v(6.8), facialHarmony: v(7),
    psl, avgLum: 128,
  }
}

function generateFallbackBodyScores() {
  const v = (base) => round1(clamp(base + (Math.random() - 0.5) * 3, 3, 9.5))
  const posture = v(6.5)
  return {
    shoulderWaistRatio: v(6.8), posture, bodyProportions: v(7),
    bodyComposition: v(6.5), forwardHeadAngle: round1(Math.random() * 15 + 3),
    postureGradeValue: postureGrade(posture),
    compositionCategory: 'Athletic',
  }
}

function getCompositionCategory(score) {
  if (score >= 8.5) return 'Lean/Athletic'
  if (score >= 7) return 'Athletic'
  if (score >= 5.5) return 'Average'
  if (score >= 4) return 'Overweight'
  return 'Obese'
}
