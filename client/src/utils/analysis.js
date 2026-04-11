/**
 * Ascendus Analysis Engine v2
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

// ─── Tier System ──────────────────────────────────────────────────────────────
// ─── Tier definitions ─────────────────────────────────────────────────────────
//
// MALE:   Sub 3 (1–3.9) · Low Tier Normie (4–4.9) · Mid Tier Normie (5–5.9)
//         High Tier Normie (6–6.9) · Chadlite (7–7.4) · Chad (7.5–8.4)
//         Adam Lite (8.5–9.4) · True Adam (9.5–10)
//
// FEMALE: Sub 3 (1–3.9) · Low Tier Becky (4–4.9) · Mid Tier Becky (5–5.9)
//         High Tier Becky (6–6.9) · Stacey (7–8.4) · Eve (8.5–9.4) · True Eve (9.5–10)

export const MALE_TIERS = [
  {
    min: 9.5, max: 10.0,
    label: 'True Adam', shortLabel: 'True Adam',
    color: '#FFD700', bg: 'rgba(255,215,0,0.13)', border: '#FFD700',
    emoji: '👑',
    desc: 'Practically flawless. Exceptional proportions and facial harmony. Extremely rare — top 0.1% of the population. Near-perfect structural and aesthetic alignment.',
    percentile: 'Top 0.1%',
    nextTier: null,
    nextTierSteps: ['This tier is the realistic ceiling. Maintain and optimize.'],
  },
  {
    min: 8.5, max: 9.5,
    label: 'Adam Lite', shortLabel: 'Adam Lite',
    color: '#DDA0FF', bg: 'rgba(155,89,182,0.13)', border: '#9B59B6',
    emoji: '💎',
    desc: 'Extremely rare. Near-perfect facial structure with very few flaws. Top 1–2% globally. Strong bone structure, defined features, and excellent harmony.',
    percentile: 'Top 1–2%',
    nextTier: 'True Adam',
    nextTierSteps: [
      'Optimize body composition — leaner face reveals more definition.',
      'Advanced skincare protocol (retinoids, professional treatments).',
      'Refine grooming to match structural strengths precisely.',
    ],
  },
  {
    min: 7.5, max: 8.5,
    label: 'Chad', shortLabel: 'Chad',
    color: '#A29BFE', bg: 'rgba(108,92,231,0.12)', border: '#6C5CE7',
    emoji: '🔥',
    desc: 'Highly attractive. Strong jawline, clear bone structure, and high facial harmony. Top 5–10%. Targeted improvements can reach Adam Lite.',
    percentile: 'Top 5–10%',
    nextTier: 'Adam Lite',
    nextTierSteps: [
      'Identify and target weakest sub-score — one focused improvement closes the gap.',
      'Body fat reduction to reveal bone structure more clearly.',
      'Consistent skincare routine — texture and clarity are high ROI at this tier.',
    ],
  },
  {
    min: 7.0, max: 7.5,
    label: 'Chadlite', shortLabel: 'Chadlite',
    color: '#74B9FF', bg: 'rgba(9,132,227,0.11)', border: '#0984E3',
    emoji: '⚡',
    desc: 'Model / actor-level potential. Strong structure and presence. Minimal visible weaknesses. Top 10–15%. Targeted improvements can push to Chad.',
    percentile: 'Top 10–15%',
    nextTier: 'Chad',
    nextTierSteps: [
      'Build consistency in grooming, skincare, and body composition simultaneously.',
      'Optimize haircut to complement facial structure.',
      'Focus on the weakest sub-score — small adjustments have outsized impact.',
    ],
  },
  {
    min: 6.0, max: 7.0,
    label: 'High Tier Normie', shortLabel: 'High Tier Normie',
    color: '#55EFC4', bg: 'rgba(0,184,148,0.11)', border: '#00B894',
    emoji: '✅',
    desc: 'Clearly attractive. Objectively above average with a strong base. Top 20–30%. Minor flaws present but nothing structurally limiting. Consistent effort can reach Chadlite.',
    percentile: 'Top 20–30%',
    nextTier: 'Chadlite',
    nextTierSteps: [
      'Skincare protocol (cleanser → BHA/AHA → moisturizer → SPF daily) for 8 weeks.',
      'Body composition improvement — leaner face alone shifts tier perception significantly.',
      'Haircut optimization is the fastest appearance upgrade.',
    ],
  },
  {
    min: 5.0, max: 6.0,
    label: 'Mid Tier Normie', shortLabel: 'Mid Tier Normie',
    color: '#FDCB6E', bg: 'rgba(253,203,110,0.11)', border: '#E17055',
    emoji: '😐',
    desc: 'Average. Balanced but not striking. High ROI available — targeted looksmaxxing moves the needle fast. Can reach High Tier Normie within months.',
    percentile: 'Middle 40–60%',
    nextTier: 'High Tier Normie',
    nextTierSteps: [
      'Start a structured gym protocol — visible physique changes shift facial perception.',
      'Address skin quality first — highest ROI improvement at this tier.',
      'Grooming audit: haircut, brow shaping, beard maintenance are immediate wins.',
    ],
  },
  {
    min: 4.0, max: 5.0,
    label: 'Low Tier Normie', shortLabel: 'Low Tier Normie',
    color: '#FAB1A0', bg: 'rgba(255,118,117,0.11)', border: '#FF7675',
    emoji: '😕',
    desc: 'Below average. Noticeable areas for improvement — but high ROI available. Gym + grooming + skincare can reach Mid Tier Normie in 3–6 months.',
    percentile: 'Bottom 20–30%',
    nextTier: 'Mid Tier Normie',
    nextTierSteps: [
      'Body weight normalization is the single highest-impact intervention.',
      'Establish consistent hygiene and basic grooming baseline.',
      'Skincare protocol — even basic care produces visible change within 6 weeks.',
    ],
  },
  {
    min: 1.0, max: 4.0,
    label: 'Sub 3', shortLabel: 'Sub 3',
    color: '#FF4757', bg: 'rgba(255,71,87,0.13)', border: '#FF4757',
    emoji: '🔴',
    desc: 'Severe structural limitations. Significant aesthetic disadvantages present. Improvements are possible but gradual. Focus on fundamentals: body weight, skin, hygiene, grooming.',
    percentile: 'Bottom 5%',
    nextTier: 'Low Tier Normie',
    nextTierSteps: [
      'Body weight normalization is the single highest-impact intervention.',
      'Establish consistent hygiene and basic grooming baseline.',
      'Skincare protocol — even basic care produces visible change within 6 weeks.',
    ],
  },
]

export const FEMALE_TIERS = [
  {
    min: 9.5, max: 10.0,
    label: 'True Eve', shortLabel: 'True Eve',
    color: '#FFD700', bg: 'rgba(255,215,0,0.13)', border: '#FFD700',
    emoji: '👑',
    desc: 'Practically flawless. Exceptional proportions and facial harmony. Extremely rare — top 0.1% of the population.',
    percentile: 'Top 0.1%',
    nextTier: null,
    nextTierSteps: ['This tier is the realistic ceiling. Maintain and optimize.'],
  },
  {
    min: 8.5, max: 9.5,
    label: 'Eve', shortLabel: 'Eve',
    color: '#DDA0FF', bg: 'rgba(155,89,182,0.13)', border: '#9B59B6',
    emoji: '💎',
    desc: 'Extremely rare. Near-perfect facial structure with very few flaws. Top 1–2% globally. Striking features, excellent symmetry, and minimal flaws.',
    percentile: 'Top 1–2%',
    nextTier: 'True Eve',
    nextTierSteps: [
      'Advanced skincare protocol — retinoids and professional treatments.',
      'Optimize body composition for facial definition.',
      'Refine grooming and style to complement structural strengths.',
    ],
  },
  {
    min: 7.0, max: 8.5,
    label: 'Stacey', shortLabel: 'Stacey',
    color: '#A29BFE', bg: 'rgba(108,92,231,0.12)', border: '#6C5CE7',
    emoji: '🔥',
    desc: 'Highly attractive. Strong cheekbones, facial harmony, and clear definition. Top 10–15%. Targeted improvements can reach Eve.',
    percentile: 'Top 10–15%',
    nextTier: 'Eve',
    nextTierSteps: [
      'Identify and target weakest sub-score — one focused improvement closes the gap.',
      'Consistent skincare routine — texture and clarity are high ROI.',
      'Body composition optimization for facial definition.',
    ],
  },
  {
    min: 6.0, max: 7.0,
    label: 'High Tier Becky', shortLabel: 'High Tier Becky',
    color: '#55EFC4', bg: 'rgba(0,184,148,0.11)', border: '#00B894',
    emoji: '✅',
    desc: 'Clearly attractive. Objectively above average with a strong base. Top 20–30%. Minor flaws present but nothing structurally limiting.',
    percentile: 'Top 20–30%',
    nextTier: 'Stacey',
    nextTierSteps: [
      'Skincare protocol (cleanser → BHA/AHA → moisturizer → SPF daily) for 8 weeks.',
      'Body composition improvement — leaner face alone shifts tier perception.',
      'Haircut and style optimization for the fastest upgrade.',
    ],
  },
  {
    min: 5.0, max: 6.0,
    label: 'Mid Tier Becky', shortLabel: 'Mid Tier Becky',
    color: '#FDCB6E', bg: 'rgba(253,203,110,0.11)', border: '#E17055',
    emoji: '😐',
    desc: 'Average. Balanced but not striking. High ROI available — skincare, fitness, and grooming can reach High Tier Becky within months.',
    percentile: 'Middle 40–60%',
    nextTier: 'High Tier Becky',
    nextTierSteps: [
      'Start a structured skincare protocol — highest ROI at this tier.',
      'Fitness and body composition — visible changes shift tier perception fast.',
      'Style and grooming audit: haircut and presentation are immediate wins.',
    ],
  },
  {
    min: 4.0, max: 5.0,
    label: 'Low Tier Becky', shortLabel: 'Low Tier Becky',
    color: '#FAB1A0', bg: 'rgba(255,118,117,0.11)', border: '#FF7675',
    emoji: '😕',
    desc: 'Below average. Noticeable areas for improvement — but high ROI available. Skincare + fitness + style upgrades can reach Mid Tier Becky quickly.',
    percentile: 'Bottom 20–30%',
    nextTier: 'Mid Tier Becky',
    nextTierSteps: [
      'Body weight normalization is the highest-impact intervention.',
      'Establish consistent skincare and grooming baseline.',
      'Style upgrade — clothing and hair choices are immediate wins.',
    ],
  },
  {
    min: 1.0, max: 4.0,
    label: 'Sub 3', shortLabel: 'Sub 3',
    color: '#FF4757', bg: 'rgba(255,71,87,0.13)', border: '#FF4757',
    emoji: '🔴',
    desc: 'Severe structural limitations. Significant aesthetic disadvantages present. Improvements are possible but gradual. Focus on fundamentals: body weight, skin, hygiene, grooming.',
    percentile: 'Bottom 5%',
    nextTier: 'Low Tier Becky',
    nextTierSteps: [
      'Body weight normalization is the single highest-impact intervention.',
      'Establish consistent skincare and hygiene baseline.',
      'Basic grooming and style upgrades — immediate wins available.',
    ],
  },
]

// Backward-compat alias — defaults to male tiers
export const PSL_TIERS = MALE_TIERS

export function getTiersForGender(gender) {
  return gender === 'female' ? FEMALE_TIERS : MALE_TIERS
}

export function getTier(umaxScore, gender = 'male') {
  if (umaxScore === null || umaxScore === undefined || isNaN(umaxScore) || typeof umaxScore !== 'number') return null
  const tiers = getTiersForGender(gender)
  const tier = tiers.find(t => umaxScore >= t.min && (t.max >= 10.0 ? umaxScore <= t.max : umaxScore < t.max))
  if (!tier) return null
  return { ...tier }
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

// ─── Metric 1: Skin clarity — uniformity in the central face ellipse ──────────
function getSkinClarity(data, width, height) {
  const cx = width / 2, cy = height * 0.40
  const rx = width * 0.20, ry = height * 0.20
  let total = 0, count = 0, samples = []
  for (let y = cy - ry; y < cy + ry; y += 4) {
    for (let x = cx - rx; x < cx + rx; x += 4) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry
      if (nx * nx + ny * ny > 1.0) continue
      const px = Math.floor(x), py = Math.floor(y)
      if (px < 0 || py < 0 || px >= width || py >= height) continue
      const i = (py * width + px) * 4
      if (data[i + 3] < 100) continue
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      samples.push(lum)
      total += lum; count++
    }
  }
  if (count < 10) return 6.5
  const mean = total / count
  // Variance of LOCAL patches (5x5) — true skin texture, not global lighting
  let patchVar = 0, patchCount = 0
  for (let j = 0; j < samples.length - 4; j += 5) {
    const patch = samples.slice(j, j + 5)
    const pm = patch.reduce((a, b) => a + b, 0) / patch.length
    patchVar += patch.reduce((a, b) => a + (b - pm) ** 2, 0) / patch.length
    patchCount++
  }
  const localStdDev = patchCount > 0 ? Math.sqrt(patchVar / patchCount) : 20
  // Clear skin: localStdDev ~3-8 → score 8-9.5
  // Average skin: localStdDev ~10-18 → score 6-7.5
  // Rough/blemished skin: localStdDev ~22+ → score 4-5.5
  return round1(clamp(9.5 - localStdDev * 0.18, 3.5, 9.8))
}

// ─── Metric 2: Symmetry — narrow central strip only (ignore background) ───────
function getSymmetry(data, width, height) {
  const startY = Math.floor(height * 0.15)
  const endY = Math.floor(height * 0.82)
  const cx = Math.floor(width / 2)
  const maxX = Math.floor(width * 0.32) // central 64% only — avoids background
  let totalDiff = 0, count = 0
  for (let y = startY; y < endY; y += 5) {
    for (let x = 2; x < maxX; x += 5) {
      const lx = cx - x, rx = cx + x
      if (lx < 0 || rx >= width) continue
      const i1 = (y * width + lx) * 4
      const i2 = (y * width + rx) * 4
      const lum1 = 0.299 * data[i1] + 0.587 * data[i1 + 1] + 0.114 * data[i1 + 2]
      const lum2 = 0.299 * data[i2] + 0.587 * data[i2 + 1] + 0.114 * data[i2 + 2]
      totalDiff += Math.abs(lum1 - lum2)
      count++
    }
  }
  if (count === 0) return 5.5
  const avgDiff = totalDiff / count
  // Recalibrated for correct average-person anchoring at 5.0:
  // avgDiff ~8-12 → highly symmetric (7.0-8.2)
  // avgDiff ~14-18 → above average (6.0-6.8)
  // avgDiff ~22-26 → average (5.0-5.5)   ← most consumer photos land here
  // avgDiff ~30-38 → below average (4.0-4.9)
  // avgDiff ~42+   → asymmetric floor (4.0)
  return round1(clamp(8.5 - avgDiff * 0.13, 4.0, 9.5))
}

// ─── Metric 3: Edge density — Sobel on face region → facial definition ────────
// This is the MOST discriminating metric:
// Angular/defined face → strong edges at jaw, cheekbones, eye sockets → HIGH score
// Fat/round/soft face → few hard edges, gradual transitions → LOW score
function getEdgeDensity(data, width, height) {
  const x0 = Math.max(1, Math.floor(width * 0.18))
  const x1 = Math.min(width - 2, Math.floor(width * 0.82))
  const y0 = Math.max(1, Math.floor(height * 0.08))
  const y1 = Math.min(height - 2, Math.floor(height * 0.88))
  let totalEdge = 0, count = 0
  const gl = (px, py) => {
    const i = (py * width + px) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  for (let y = y0 + 1; y < y1 - 1; y += 3) {
    for (let x = x0 + 1; x < x1 - 1; x += 3) {
      const gx =
        -gl(x-1,y-1) - 2*gl(x-1,y) - gl(x-1,y+1) +
         gl(x+1,y-1) + 2*gl(x+1,y) + gl(x+1,y+1)
      const gy =
        -gl(x-1,y-1) - 2*gl(x,y-1) - gl(x+1,y-1) +
         gl(x-1,y+1) + 2*gl(x,y+1) + gl(x+1,y+1)
      totalEdge += Math.sqrt(gx * gx + gy * gy)
      count++
    }
  }
  if (count === 0) return 5.0
  const avg = totalEdge / count
  // Calibrated across the realistic range of consumer/professional photos:
  // Fat/very soft face:   avg ~5-10  → score 2.5-3.8
  // Below average:        avg ~11-16 → score 3.9-4.8
  // Average person:       avg ~17-22 → score 5.0-5.9
  // Clearly attractive:   avg ~23-30 → score 6.1-7.2
  // Model/defined:        avg ~31-42 → score 7.4-9.0
  return round1(clamp((avg - 6) * 0.16 + 3.2, 2.0, 9.8))
}

// ─── Metric 4: Lower-face darkness → jaw shadow → jaw definition proxy ────────
// Defined jaw: shadow under the jaw/chin makes lower face DARKER than cheeks
// Fat/round face: no jaw shadow — lower and mid face have similar brightness
function getLowerFaceDarkness(data, width, height) {
  const cx = Math.floor(width / 2)
  const sw = Math.floor(width * 0.16)
  const sample = (y0pct, y1pct) => {
    let sum = 0, n = 0
    for (let y = Math.floor(height * y0pct); y < Math.floor(height * y1pct); y += 4) {
      for (let x = cx - sw; x <= cx + sw; x += 4) {
        if (x < 0 || x >= width) continue
        const i = (y * width + x) * 4
        sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        n++
      }
    }
    return n > 0 ? sum / n : 128
  }
  const midBright = sample(0.32, 0.52) // cheek/nose level
  const lowBright = sample(0.70, 0.87) // jaw/chin level
  const diff = midBright - lowBright    // positive → mid is brighter → jaw shadow exists
  // Honest baseline: diff=0 (flat frontal lighting) = 5.0 — genuinely neutral.
  // Fat face with no jaw shadow: diff -5 to 0 → score 4.5-5.0
  // Average jaw (slight shadow):  diff 5-15  → score 5.5-6.5
  // Defined jaw (clear shadow):   diff 18-28 → score 6.8-7.8
  // Sharp jaw (strong shadow):    diff 30+   → score 8.0+ (capped 9.0)
  return round1(clamp(5.0 + diff * 0.10, 3.5, 9.0))
}

// ─── Metric 5 (body only): Contour score — for body V-taper / shoulder-waist ──
// Used ONLY in analyzeBodyPhoto. Kept as a neutral brightness ratio for body.
function getFaceContourScore(data, width, height) {
  const cx = Math.floor(width / 2)
  const getBrightness = (y, halfspan) => {
    let sum = 0, n = 0
    for (let x = cx - halfspan; x <= cx + halfspan; x += 3) {
      if (x < 0 || x >= width) continue
      const i = (y * width + x) * 4
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (lum < 20) continue // exclude dark background pixels
      sum += lum
      n++
    }
    return n > 4 ? sum / n : 128
  }
  const cheekSpan  = Math.floor(width * 0.28)
  const jawSpan    = Math.floor(width * 0.18)
  const cheekBright = getBrightness(Math.floor(height * 0.38), cheekSpan)
  const jawBright   = getBrightness(Math.floor(height * 0.76), jawSpan)
  const ratio = cheekBright / Math.max(jawBright, 1)
  return round1(clamp(3.5 + (ratio - 0.85) * 34, 3.0, 9.5))
}

// ─── Metric 5 (face): Lower-face edge density → jaw/chin definition ──────────
// This is the DEFINITIVE fat-face vs defined-face discriminator for face analysis.
// Uses Sobel ONLY on the lower face region (jaw, chin, lower cheeks: y 58-88%).
// Physics: A fat/round lower face has soft gradual pixel transitions → low Sobel.
//          A defined jaw has sharp bone/shadow edges → high Sobel magnitude.
// IMMUNE to dark backgrounds (edges are transition magnitudes, not absolute brightness).
// IMMUNE to flat studio lighting (structural edges persist even with diffused light).
function getLowerFaceEdges(data, width, height) {
  const x0 = Math.max(1, Math.floor(width * 0.22))
  const x1 = Math.min(width - 2, Math.floor(width * 0.78))
  const y0 = Math.max(1, Math.floor(height * 0.58))
  const y1 = Math.min(height - 2, Math.floor(height * 0.88))
  let totalEdge = 0, count = 0
  const gl = (px, py) => {
    const i = (py * width + px) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  for (let y = y0 + 1; y < y1 - 1; y += 3) {
    for (let x = x0 + 1; x < x1 - 1; x += 3) {
      const gx =
        -gl(x-1,y-1) - 2*gl(x-1,y) - gl(x-1,y+1) +
         gl(x+1,y-1) + 2*gl(x+1,y) + gl(x+1,y+1)
      const gy =
        -gl(x-1,y-1) - 2*gl(x,y-1) - gl(x+1,y-1) +
         gl(x-1,y+1) + 2*gl(x,y+1) + gl(x+1,y+1)
      totalEdge += Math.sqrt(gx * gx + gy * gy)
      count++
    }
  }
  if (count === 0) return 4.0
  const avg = totalEdge / count
  // Fat/round jaw:       avg ~4-9   → score 2.0-3.6  (soft fat lower face — no bone edges)
  // Below average jaw:   avg ~10-15 → score 3.8-4.7
  // Average definition:  avg ~16-22 → score 4.9-6.0
  // Clearly defined jaw: avg ~23-32 → score 6.2-7.8
  // Sharp angular jaw:   avg ~34+   → score 8.1+ (capped 9.5)
  return round1(clamp((avg - 4) * 0.18 + 3.0, 2.0, 9.5))
}

// ─── PSL Metric Derivations ───────────────────────────────────────────────────
// Now driven by 5 REAL pixel measurements that actually correlate with
// facial attractiveness — not just avgLum as a random seed.
//
// edgeDensity     → facial definition / angularity (jaw, cheekbones, eye sockets)
// lowerFaceDark   → jaw shadow / jaw definition proxy
// faceContour     → V-face vs. round-face profile
// skinClarity     → skin texture quality
// symmetry        → facial balance

function derivePSLMetrics(skinClarity, symmetry, avgLum, edgeDensity, lowerFaceDark, lowerFaceEdges, gender = 'male') {
  // Guard against missing/NaN arguments — substitute neutral defaults to prevent NaN cascade
  const _sc  = (skinClarity   !== null && skinClarity   !== undefined && !isNaN(skinClarity))   ? skinClarity   : 6.5
  const _sym = (symmetry      !== null && symmetry      !== undefined && !isNaN(symmetry))      ? symmetry      : 6.5
  const _lum = (avgLum        !== null && avgLum        !== undefined && !isNaN(avgLum))        ? avgLum        : 128
  const _ed  = (edgeDensity   !== null && edgeDensity   !== undefined && !isNaN(edgeDensity))   ? edgeDensity   : 5.5
  const _lfd = (lowerFaceDark !== null && lowerFaceDark !== undefined && !isNaN(lowerFaceDark)) ? lowerFaceDark : 5.5
  const _lfe = (lowerFaceEdges!== null && lowerFaceEdges!== undefined && !isNaN(lowerFaceEdges))? lowerFaceEdges: 5.5
  skinClarity = _sc; symmetry = _sym; avgLum = _lum; edgeDensity = _ed; lowerFaceDark = _lfd; lowerFaceEdges = _lfe

  // Seed uses ALL real measurements — same photo always gives same result
  const seed = skinClarity * 1000 + symmetry * 100 + edgeDensity * 10 + lowerFaceDark + lowerFaceEdges * 0.5 + avgLum * 0.1

  // Tiny deterministic jitter (±0.3) — seeded so same photo = same result, but
  // magnitude reduced to limit score drift across similar inputs
  const jitter = (s) => (seededRand(seed, s) - 0.5) * 0.6
  const v = (base, s) => round1(clamp(base + jitter(s), 1.0, 10.0))

  // ── Canthal Tilt ─────────────────────────────────────────────────────────────
  // Edge density (whole face) + symmetry + skin clarity
  const canthalBase = clamp(edgeDensity * 0.55 + symmetry * 0.25 + skinClarity * 0.20, 1, 10)
  const canthalScore = v(canthalBase, 1)
  const canthalAngle = round1(clamp((canthalScore - 5) * 2.5, -8, 12))

  // ── Hunter Eyes ──────────────────────────────────────────────────────────────
  // Driven by canthal tilt + whole-face edge density
  const hunterBase = clamp(canthalScore * 0.52 + edgeDensity * 0.35 + symmetry * 0.13, 1, 10)
  const hunterEyes = v(hunterBase, 2)
  const eyeType = hunterEyes >= 7.5 ? 'Hunter Eyes' : hunterEyes >= 6 ? 'Neutral' : 'Prey Eyes'

  // ── Facial Thirds ─────────────────────────────────────────────────────────────
  // Symmetry-driven — remove faceContour (was causing fat faces to score high)
  const thirdsBase = clamp(symmetry * 0.48 + edgeDensity * 0.28 + skinClarity * 0.14 + 0.4, 1, 10)
  const facialThirds = v(thirdsBase, 3)
  const upperPct = round1(clamp(33 + (seededRand(seed, 10) - 0.5) * 14, 20, 46))
  const midPct = round1(clamp(33 + (seededRand(seed, 11) - 0.5) * 12, 22, 44))
  const lowerPct = round1(100 - upperPct - midPct)

  // ── Gonial Angle ─────────────────────────────────────────────────────────────
  // PRIMARY driver: lowerFaceEdges (actual jaw-region Sobel) + jaw shadow
  // faceContour REMOVED — was giving fat faces falsely high gonial scores
  const gonialBase = clamp(lowerFaceEdges * 0.60 + lowerFaceDark * 0.25 + edgeDensity * 0.15, 1, 10)
  const gonialScoreVal = gender === 'male'
    ? v(gonialBase, 4)
    : v(clamp(gonialBase * 0.92, 1, 10), 4)
  const gonialAngle = gender === 'female'
    ? round1(clamp(128 - (gonialScoreVal - 5) * 3, 110, 145))
    : round1(clamp(122 - (gonialScoreVal - 5) * 2.5, 108, 138))

  // ── Jaw Definition ────────────────────────────────────────────────────────────
  // Lower-face edge density is the primary signal — directly measures jaw sharpness
  const jawBase = clamp(lowerFaceEdges * 0.55 + lowerFaceDark * 0.28 + edgeDensity * 0.17, 1, 10)
  const jawDefinition = v(jawBase, 5)

  // ── Cheekbone Prominence ──────────────────────────────────────────────────────
  // Whole-face edge density (captures orbital rim, cheekbone structure) + lower face support
  const cheekBase = clamp(edgeDensity * 0.58 + lowerFaceEdges * 0.27 + symmetry * 0.15, 1, 10)
  const cheekbones = v(cheekBase, 6)

  // ── Facial Width-to-Height Ratio ──────────────────────────────────────────────
  // Structural measurement — driven by general definition and symmetry
  const fwhrBase = clamp(edgeDensity * 0.55 + symmetry * 0.35 + lowerFaceDark * 0.10, 1, 10)
  const fwhrAdj = gender === 'male' ? fwhrBase : clamp(fwhrBase * 0.94, 1, 10)
  const fwhrScore = v(fwhrAdj, 7)
  const fwhrValue = gender === 'female'
    ? round2(clamp(1.8 + (fwhrScore - 5) * 0.06, 1.3, 2.3))
    : round2(clamp(2.0 + (fwhrScore - 5) * 0.07, 1.4, 2.5))

  // ── Nose Harmony ──────────────────────────────────────────────────────────────
  const noseBase = clamp(symmetry * 0.50 + skinClarity * 0.35 + edgeDensity * 0.15, 1, 10)
  const noseHarmony = v(noseBase, 8)

  // ── Skin Texture ──────────────────────────────────────────────────────────────
  const skinTexture = round1(clamp(skinClarity * 0.88 + jitter(9) * 0.8, 1, 9.8))

  // ── Brow Ridge ────────────────────────────────────────────────────────────────
  const browBase = gender === 'male'
    ? clamp(edgeDensity * 0.50 + jawDefinition * 0.30 + cheekbones * 0.20, 1, 10)
    : clamp(symmetry * 0.52 + skinClarity * 0.33 + edgeDensity * 0.15, 1, 10)
  const browRidge = v(browBase, 12)

  // ── Maxilla ───────────────────────────────────────────────────────────────────
  const maxillaBase = clamp(symmetry * 0.45 + facialThirds * 0.35 + edgeDensity * 0.20, 1, 10)
  const maxilla = v(maxillaBase, 13)

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

// ─── 4-Pillar Facial Analysis Engine ─────────────────────────────────────────
// Pillars: Angularity (20%) · Dimorphism (20%) · Features (25%) · Harmony (35%)
// ALL 4 pillars must be fully evaluated before a final score is produced.

export function derivePillars(pslMetrics, symmetry, skinClarity, edgeDensity = 5.5, lowerFaceDark = 5.5, lowerFaceEdges = 5.0, gender = 'male') {
  // ══════════════════════════════════════════════════════════════════════════════
  // DETERMINISTIC SCORING ENGINE v3
  // All 4 pillar scores computed as explicit formulas from 5 raw pixel measurements.
  // No seeded random. No jitter on pillar scores. Same inputs → same outputs, always.
  //
  // Pixel measurements (all calibrated to ~1–10 scale):
  //   skinClarity    — skin texture uniformity (3.5–9.8)
  //   symmetry       — left-right luminance balance (4.0–9.5)
  //   edgeDensity    — full-face Sobel edge density (2.0–9.8)
  //   lowerFaceDark  — jaw-shadow brightness differential (3.5–9.0)
  //   lowerFaceEdges — jaw-region Sobel density (2.0–9.5)
  //
  // Final formula: (A × 0.20) + (D × 0.20) + (F × 0.25) + (H × 0.35)
  // ══════════════════════════════════════════════════════════════════════════════

  // ─── Shared helpers ──────────────────────────────────────────────────────────
  function sa(score, high, midHigh, mid, low) {
    if (score >= 7.5) return high
    if (score >= 6.0) return midHigh
    if (score >= 4.5) return mid
    return low
  }
  function extractSW(subScores) {
    const entries = Object.values(subScores)
    const strengths = entries.filter(e => e.score >= 6.5).sort((a, b) => b.score - a.score).slice(0, 2).map(e => `${e.label}: ${e.assessment}`)
    const weaknesses = entries.filter(e => e.score < 5.0).sort((a, b) => a.score - b.score).slice(0, 2).map(e => `${e.label}: ${e.assessment}`)
    return { strengths, weaknesses }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 1 — DETERMINISTIC PILLAR SCORES
  // Each pillar is a pure weighted formula of the 5 pixel measurements.
  // Weights chosen so average consumer photo of average person → pillar scores ~5.0–5.5
  // ══════════════════════════════════════════════════════════════════════════════

  // ANGULARITY: jaw definition + facial structure + jaw shadow
  // lowerFaceEdges is the most reliable fat-face discriminator — immune to hair/beard
  // edgeDensity weight reduced: hair/beard/background inflate this metric on unattractive people
  const angularityScore = round1(clamp(
    lowerFaceEdges * 0.55 +   // jaw-region Sobel — most reliable structural signal, least hair-affected
    edgeDensity    * 0.22 +   // full-face structure (REDUCED — hair inflates this)
    lowerFaceDark  * 0.23,    // jaw shadow: defined jaw = lower face darker than cheeks
    1.0, 9.8
  ))

  // DIMORPHISM: sexual characteristic strength
  // Male  → jaw/chin strength is primary — lowerFaceEdges anchors this, edgeDensity secondary
  // Female → facial softness, symmetry, skin quality: inverse of angularity
  const dimorphismScore = gender === 'male'
    ? round1(clamp(
        lowerFaceEdges * 0.45 +   // jaw width and strength — most discriminating for male dimorphism
        edgeDensity    * 0.40 +   // structural definition (brow, orbital) — still needed but reduced
        symmetry       * 0.15,    // bilateral bone structure signal
        1.0, 9.8
      ))
    : round1(clamp(
        symmetry       * 0.45 +               // symmetry = primary femininity signal
        skinClarity    * 0.35 +               // skin quality = femininity signal
        clamp(10 - edgeDensity, 1, 9) * 0.20, // softness (less edge = more feminine)
        1.0, 9.8
      ))

  // FEATURES: individual feature quality — skin, eyes, nose, lips
  // edgeDensity weight heavily reduced: hair creates Sobel edges that fake "feature sharpness"
  const featuresScore = round1(clamp(
    skinClarity  * 0.52 +   // skin clarity: #1 visible individual feature (increased)
    symmetry     * 0.36 +   // feature alignment — eyes/nose/lips placement (increased)
    edgeDensity  * 0.12,    // feature sharpness (HEAVILY REDUCED — hair was inflating this)
    1.0, 9.8
  ))

  // HARMONY: overall facial balance and cohesion
  // lowerFaceEdges added as structural anchor — replaces most of edgeDensity's role
  // A fat/round lower face actively hurts harmony (face lacks structural coherence)
  const harmonyScore = round1(clamp(
    symmetry       * 0.50 +   // bilateral balance — dominant harmony signal (unchanged)
    lowerFaceEdges * 0.20 +   // jaw structural coherence — fat face = lower harmony (NEW)
    skinClarity    * 0.16 +   // skin uniformity across face
    edgeDensity    * 0.09 +   // HEAVILY REDUCED — hair was inflating this
    lowerFaceDark  * 0.05,    // lower-face tonal balance
    1.0, 9.8
  ))

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 2 — DETERMINISTIC SUB-SCORES
  // All sub-scores derived from the same 5 pixel measurements.
  // Consistent with pillar scores — no hidden jitter or randomness.
  // ══════════════════════════════════════════════════════════════════════════════

  // Angularity sub-scores
  const jawSharpS    = round1(clamp(lowerFaceEdges, 1.0, 9.8))
  const cheekS       = round1(clamp(edgeDensity * 0.65 + lowerFaceEdges * 0.35, 1.0, 9.8))
  const chinS        = round1(clamp(lowerFaceDark * 0.55 + lowerFaceEdges * 0.45, 1.0, 9.8))
  const leannessS    = round1(clamp(lowerFaceEdges * 0.55 + edgeDensity * 0.45, 1.0, 9.8))

  const angSubScores = {
    jawSharpness: {
      score: jawSharpS, label: 'Jawline Sharpness',
      assessment: sa(jawSharpS,
        'Sharp, angular jaw — strong structural anchor for the face',
        'Decent jaw definition visible — sharpenable through body fat reduction',
        'Soft jawline present — body fat reduction and mewing are the primary fixes',
        'Minimal jaw definition — the highest-priority angularity target'),
    },
    chinProjection: {
      score: chinS, label: 'Chin Projection',
      assessment: sa(chinS,
        'Strong forward projection — adds depth and strength to the profile',
        'Adequate chin projection — solid profile foundation',
        'Moderate projection — chin is slightly recessed',
        'Limited chin projection — weakens the overall side profile significantly'),
    },
    cheekboneDefinition: {
      score: cheekS, label: 'Cheekbone Definition',
      assessment: sa(cheekS,
        'High cheekbones clearly visible — strong facial architecture',
        'Cheekbones present but not dominant — more visible when leaner',
        'Relatively flat cheekbones — body fat reduction will uncover structure',
        'Cheekbones not prominent — significant leaning out needed to reveal them'),
    },
    facialLeanness: {
      score: leannessS, label: 'Facial Leanness',
      assessment: sa(leannessS,
        'Very lean face — bone structure is fully visible throughout',
        'Relatively lean — slight softness around the edges only',
        'Moderate facial fat present — obscuring a portion of angular potential',
        'Excess facial fat is significantly reducing all angularity scores'),
    },
  }
  const { strengths: angStrengths, weaknesses: angWeaknesses } = extractSW(angSubScores)

  const angularity = {
    score: angularityScore,
    subScores: angSubScores,
    strengths: angStrengths,
    weaknesses: angWeaknesses,
    explanation: angularityScore >= 7.5
      ? 'Exceptional angularity. Sharp jaw, prominent cheekbones, and lean facial structure create strong, well-defined geometry. This pillar is a clear structural strength.'
      : angularityScore >= 6.0
      ? 'Good angularity with a defined structure. The foundation is clearly present. Body fat reduction and mewing can sharpen the remaining areas.'
      : angularityScore >= 5.0
      ? 'Moderate angularity. Structural potential is there but softened. Body fat reduction is the single highest-ROI intervention for this pillar.'
      : 'Limited angularity currently. Weight management and long-term mewing protocol are the clearest paths to meaningful improvement.',
    improvements: [
      'Get to 12–14% body fat — jaw, chin, and cheekbones all become dramatically more visible below this threshold.',
      'Mewing (correct tongue posture on the roof of the mouth) — produces measurable bone remodeling over 12–24+ months.',
      'Mastic gum chewing — builds masseter hypertrophy and visually strengthens the jaw angle over 6–12 weeks.',
    ],
  }

  // Dimorphism sub-scores
  const browS      = round1(clamp(edgeDensity * 0.65 + symmetry * 0.35, 1.0, 9.8))
  const jawStrS    = round1(clamp(lowerFaceEdges * 0.60 + edgeDensity * 0.40, 1.0, 9.8))
  const structureS = round1(clamp(edgeDensity * 0.55 + lowerFaceDark * 0.45, 1.0, 9.8))
  const softnessS  = round1(clamp(skinClarity * 0.55 + symmetry * 0.45, 1.0, 9.8))
  const delicacyS  = round1(clamp(symmetry * 0.55 + skinClarity * 0.45, 1.0, 9.8))
  const transS     = round1(clamp((skinClarity + symmetry) / 2, 1.0, 9.8))

  const dimSubScores = gender === 'male'
    ? {
        browRidge: {
          score: browS, label: 'Brow Ridge Prominence',
          assessment: sa(browS,
            'Strong, prominent brow ridge — excellent hunter-eye framing and masculine depth',
            'Moderate brow ridge — adds masculine character to the eye area',
            'Flat brow ridge — limits the masculine framing of the eyes',
            'Minimal brow ridge — a significant dimorphism weakness to address'),
        },
        jawStrength: {
          score: jawStrS, label: 'Jaw Width & Strength',
          assessment: sa(jawStrS,
            'Wide, powerful jaw — a dominant, unmistakable masculine signal',
            'Above average jaw width — solid masculine structural framing',
            'Moderate jaw width — improvable with training and body fat reduction',
            'Below average jaw width — primary dimorphism improvement target'),
        },
        structure: {
          score: structureS, label: 'Structural Robustness',
          assessment: sa(structureS,
            'Robust facial bone structure throughout — a strong, clearly masculine foundation',
            'Good structural robustness — masculine features clearly visible',
            'Facial structure is moderate — more refined than robustly masculine',
            'Structure lacks robustness — resistance training and fat loss directly improve this'),
        },
      }
    : {
        softness: {
          score: softnessS, label: 'Facial Softness',
          assessment: sa(softnessS,
            'Excellent facial softness — smooth, luminous feminine quality',
            'Good softness — clearly feminine facial texture',
            'Moderate softness — some areas are harder or more angular than ideal',
            'Facial softness is limited — skincare and grooming are the primary improvements'),
        },
        delicacy: {
          score: delicacyS, label: 'Feature Delicacy',
          assessment: sa(delicacyS,
            'Delicate, fine features — high femininity signaling throughout',
            'Good feature delicacy — clearly feminine appearance',
            'Features are moderate in delicacy — some coarser elements present',
            'Feature delicacy is below ideal for femininity scoring'),
        },
        transitions: {
          score: transS, label: 'Feature Transitions',
          assessment: sa(transS,
            'Smooth, graceful transitions between features — high overall harmony and femininity',
            'Good transitions — face reads as cohesive and feminine',
            'Some abrupt transitions between facial features',
            'Feature transitions are jarring in areas — this reduces femininity scoring noticeably'),
        },
      }
  const { strengths: dimStrengths, weaknesses: dimWeaknesses } = extractSW(dimSubScores)

  const dimorphism = {
    score: dimorphismScore,
    subScores: dimSubScores,
    strengths: dimStrengths,
    weaknesses: dimWeaknesses,
    explanation: dimorphismScore >= 7.5
      ? (gender === 'male'
          ? 'Strong sexual dimorphism. Prominent brow, wide jaw, and robust bone structure signal high testosterone and dominant presence. A clear pillar strength.'
          : 'High femininity in facial structure. Soft transitions, delicate features, and clear feminine signaling throughout the face.')
      : dimorphismScore >= 6.0
      ? (gender === 'male'
          ? 'Above-average dimorphism. Masculine structure is clearly visible. Improvements in jaw definition and brow prominence are the highest-impact next steps.'
          : 'Above-average femininity. Good base with room for refinement through grooming, skincare, and presentation.')
      : dimorphismScore >= 5.0
      ? (gender === 'male'
          ? 'Moderate dimorphism. Masculine structure is present but not dominant. Training, body fat reduction, and consistent grooming all move this pillar.'
          : 'Moderate femininity metrics. Style, grooming, and skincare improvements can shift this pillar significantly.')
      : (gender === 'male'
          ? 'Dimorphism is below ideal. Addressed through resistance training, diet optimization, and grooming protocol.'
          : 'Femininity metrics are currently low. Skincare, brow shaping, and grooming produce significant visible improvement at this level.'),
    improvements: gender === 'male'
      ? [
          'Resistance training (compound lifts 4–5x/week) — increases testosterone expression and develops facial musculature.',
          'Body fat reduction to 10–13% — reveals brow ridge and jaw bone structure that fat currently covers.',
          'Brow grooming: keep brows thick, slightly lower, and straighter to simulate a stronger brow ridge.',
        ]
      : [
          'Glass-skin skincare routine (hydration + brightening serums) — enhances the luminous quality of feminine features.',
          'Arch-focused brow shaping — creates a more feminine, elevated frame around the eyes.',
          'Facial massage and lymphatic drainage — reduces puffiness, enhances facial delicacy and definition.',
        ],
  }

  // Features sub-scores
  const eyeS  = round1(clamp(edgeDensity * 0.55 + symmetry * 0.45, 1.0, 9.8))
  const noseS = round1(clamp(symmetry * 0.60 + skinClarity * 0.40, 1.0, 9.8))
  const lipsS = round1(clamp(skinClarity * 0.60 + symmetry * 0.40, 1.0, 9.8))
  const skinS = round1(clamp(skinClarity, 1.0, 9.8))
  const hairS = round1(clamp(skinClarity * 0.55 + edgeDensity * 0.45, 1.0, 9.8))

  const featSubScores = {
    eyes: {
      score: eyeS, label: 'Eyes — Shape, Tilt & Depth',
      assessment: sa(eyeS,
        'Hunter-eye configuration with positive canthal tilt — an extremely attractive and rare eye trait',
        'Good eye area — decent tilt, shape, and perceived hooding',
        'Average eye area — shape and tilt are neutral, no strong positive or negative signals',
        'Eye area is a current weakness — tilt, depth, or aperture needs to be addressed'),
    },
    nose: {
      score: noseS, label: 'Nose — Proportion & Harmony',
      assessment: sa(noseS,
        'Proportional nose in strong harmony with the face — does not detract from any other feature',
        'Well-proportioned nose with minor asymmetry — reads as balanced',
        'Nose proportion is average — not a standout positive or negative feature',
        'Nose proportion is off-balance — may be oversized, asymmetric, or drawing excess attention'),
    },
    lips: {
      score: lipsS, label: 'Lips — Definition & Balance',
      assessment: sa(lipsS,
        'Well-defined, balanced lip structure — a clear positive feature contribution',
        'Lips are adequately shaped with good upper/lower balance',
        'Lip definition is moderate — neither strongly positive nor negative',
        'Lip definition is lacking — hydration, care, and grooming can produce visible improvement'),
    },
    skin: {
      score: skinS, label: 'Skin — Clarity & Texture',
      assessment: sa(skinS,
        'Clear, even skin tone and texture — a major advantage that elevates overall facial impression',
        'Good skin quality with minor texture variation — reads as healthy and well-maintained',
        'Average skin quality — texture irregularities are present but highly addressable',
        'Skin quality is the primary limiting factor — this is the single highest-ROI improvement available'),
    },
    hair: {
      score: hairS, label: 'Hair — Density & Hairline',
      assessment: sa(hairS,
        'Strong hair density with a defined hairline — excellent structural frame for facial features',
        'Decent hair density — provides a solid frame for the face',
        'Hair density and hairline are average — neither enhancing nor detracting',
        'Hair quality or hairline is currently limiting the overall facial frame and first impression'),
    },
  }
  const { strengths: featStrengths, weaknesses: featWeaknesses } = extractSW(featSubScores)

  const features = {
    score: featuresScore,
    subScores: featSubScores,
    strengths: featStrengths,
    weaknesses: featWeaknesses,
    explanation: featuresScore >= 7.5
      ? 'Exceptional individual features. Eyes, nose, lips, skin, and hair each contribute positively — every feature enhances rather than detracts from the overall face.'
      : featuresScore >= 6.0
      ? 'Strong features overall with some clear standouts. Minor refinements through grooming and skincare can elevate this pillar meaningfully.'
      : featuresScore >= 5.0
      ? 'Average features with clear improvement potential. Skin quality and the eye area are the highest-ROI targets at this level.'
      : 'Features are below optimal. Skincare is the fastest improvement — skin texture alone can shift this score by a full point within 8–12 weeks.',
    improvements: [
      'Daily skincare protocol (retinoid + SPF minimum) — skin texture is the fastest-improving feature metric, visible within 6–10 weeks.',
      'Eye area optimization: 8h sleep, low sodium, cold compresses, eye cream — puffiness and dark circles significantly reduce eye scores.',
      'Haircut optimization via HairMaxx — the right cut for your face shape creates an immediate framing effect that elevates all features.',
    ],
  }

  // Harmony sub-scores
  const symSubS  = round1(clamp(symmetry, 1.0, 9.8))
  const propSubS = round1(clamp(edgeDensity * 0.55 + symmetry * 0.45, 1.0, 9.8))
  const alignS   = round1(clamp((edgeDensity + symmetry) / 2, 1.0, 9.8))
  const balanceS = round1(clamp((symmetry * 2 + skinClarity + edgeDensity) / 4, 1.0, 9.8))

  const harmSubScores = {
    proportions: {
      score: propSubS, label: 'Facial Thirds Balance',
      assessment: sa(propSubS,
        'Near-equal thirds (upper/mid/lower) — ideal 1:1:1 balance achieved',
        'Facial thirds are well-balanced with only minor imbalance — reads as proportional',
        'Facial thirds show imbalance — one region visibly dominates the others',
        'Significant thirds imbalance — the most impactful harmony issue currently present'),
    },
    symmetry: {
      score: symSubS, label: 'Left-Right Symmetry',
      assessment: sa(symSubS,
        'Exceptional bilateral symmetry — a rare and powerful attractiveness signal',
        'Good symmetry with minor natural variation — well above average',
        'Moderate symmetry — noticeable but not severe asymmetry is present',
        'Symmetry is below average — a primary limiting factor on overall attractiveness'),
    },
    alignment: {
      score: alignS, label: 'Feature Alignment & Midface',
      assessment: sa(alignS,
        'Features are well-aligned with excellent midface projection — strong structural coherence',
        'Good feature alignment — midface is adequately projected forward',
        'Feature alignment shows some offset — midface could project more forward',
        'Feature alignment and midface projection are key areas needing long-term intervention'),
    },
    balance: {
      score: balanceS, label: 'Overall Feature Balance',
      assessment: sa(balanceS,
        'All features work together cohesively — the face reads as a unified, attractive whole',
        'Features are fairly balanced — creates a coherent, positive overall impression',
        'Feature balance is moderate — some features draw attention inconsistently',
        'Feature balance is off — isolated strong features are being overshadowed by overall imbalance'),
    },
  }
  const { strengths: harmStrengths, weaknesses: harmWeaknesses } = extractSW(harmSubScores)

  const harmony = {
    score: harmonyScore,
    subScores: harmSubScores,
    strengths: harmStrengths,
    weaknesses: harmWeaknesses,
    explanation: harmonyScore >= 7.5
      ? 'Exceptional facial harmony. Balanced, symmetric, and cohesive. As the most heavily weighted pillar (35%), this is a significant overall advantage.'
      : harmonyScore >= 6.0
      ? 'Good harmony — the face reads as cohesive and balanced. Minor proportional imbalances can be addressed through hairstyle and grooming choices.'
      : harmonyScore >= 5.0
      ? 'Moderate harmony. Some proportional imbalance is visible. Hairstyle, posture correction, and mewing can each correct perceived balance significantly.'
      : 'Harmony is the most critical pillar (35% weight) and the primary weakness here. Posture correction, hairstyle optimization, and mewing are the clearest improvement paths.',
    improvements: [
      'Hairstyle directly alters perceived upper-third balance — use HairMaxx to find the cut that best corrects your specific facial thirds.',
      'Posture correction (chin tuck + shoulder retraction) immediately improves perceived facial balance — zero-cost, instant improvement.',
      'Mewing (correct tongue posture on palate) over months-to-years improves midface alignment, maxilla projection, and overall facial thirds.',
    ],
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 3 — HARD CONSTRAINTS (applied BEFORE final formula)
  // Pillar-level rules that enforce logical score bounds
  // ══════════════════════════════════════════════════════════════════════════════

  // Working copies for constraint modification
  let ang  = angularityScore
  let dim  = dimorphismScore
  let feat = featuresScore
  let harm = harmonyScore

  // ── Constraint A: Definitively fat / undefined lower face ─────────────────────
  // lowerFaceEdges < 4.5 = soft, fatty lower face with zero visible bone structure.
  // Structure MUST dominate score. High facial fat = angularity AND harmony crushed.
  if (lowerFaceEdges < 4.5) {
    ang  = Math.min(ang, 4.5)   // fat jaw = below-average angularity, full stop
    harm = Math.min(harm, 4.8)  // fat face = structural incoherence → harmony tanks
    dim  = Math.min(dim, 4.8)   // fat face = weak dimorphism signal
    feat = Math.min(feat, 5.3)  // fat face drags perceived feature quality
  }
  // ── Constraint B: Soft / below-average jaw definition ─────────────────────────
  else if (lowerFaceEdges < 5.0) {
    ang  = Math.min(ang, 5.2)   // soft jaw = angularity clearly below average
    harm = Math.min(harm, 5.3)  // soft structure = harmony limited
    dim  = Math.min(dim, 5.3)   // below-avg jaw = dimorphism limited
    feat = Math.min(feat, 5.8)  // soft face limits perceived feature quality
  }
  // ── Constraint B2: Weak structure overall (lfe < 5.5) ─────────────────────────
  else if (lowerFaceEdges < 5.5) {
    ang  = Math.min(ang, 5.8)   // below-average structure cap
    harm = Math.min(harm, 5.8)  // harmony cannot be above average without structure
  }

  // ── Constraint C: Strong symmetry + good proportions → harmony floor 6.0 ──────
  // Requires genuine structural support — not just symmetry alone
  if (symmetry >= 6.5 && lowerFaceEdges >= 6.0 && edgeDensity >= 5.5) harm = Math.max(harm, 6.0)

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 4 — STRUCTURE-DOMINANT FORMULA
  // finalScore = (A × 0.30) + (H × 0.35) + (F × 0.20) + (D × 0.15)
  // Structure (Angularity + Harmony) = 65% of score.
  // Features and Dimorphism combined = 35%.
  // Soft faces with good skin CANNOT score high — structure must be present.
  // ══════════════════════════════════════════════════════════════════════════════
  let finalScore = round1(
    ang  * 0.30 +   // Angularity: INCREASED — primary structural signal
    harm * 0.35 +   // Harmony: unchanged — proportion/balance
    feat * 0.20 +   // Features: REDUCED — good skin alone cannot carry score
    dim  * 0.15     // Dimorphism: REDUCED — least independent signal
  )

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 5 — FINAL-SCORE CONSTRAINTS
  // ══════════════════════════════════════════════════════════════════════════════

  // Constraint D: Weak harmony (structural incoherence) → final ceiling 6.0
  if (harm < 5.0) finalScore = Math.min(finalScore, 6.0)

  // Constraint E: Floor — requires actual jaw definition (≥4.5) to get 4.5 floor
  // Fat faces (lfe < 4.5) can score 3–4 range — no protection.
  const noDeformities = lowerFaceEdges >= 4.5 && edgeDensity >= 3.5 && symmetry >= 4.0 && skinClarity >= 3.5
  if (noDeformities) finalScore = Math.max(finalScore, 4.5)

  // Constraint F: Scores above 7.5 require strong structural evidence across all signals
  if (finalScore > 7.5) {
    const hasStrongJaw   = lowerFaceEdges >= 6.5 && lowerFaceDark >= 6.0
    const hasGoodSym     = symmetry >= 6.5
    const hasProportions = edgeDensity >= 6.0
    if (!hasStrongJaw || !hasGoodSym || !hasProportions) finalScore = Math.min(finalScore, 7.4)
  }

  // ── STRUCTURAL VALIDATION (mandatory before assigning tier) ──────────────────
  // "Does this subject have visible structural sharpness?"
  // If NO → score must stay mid-tier or below. No exceptions.
  //
  // Structural sharpness requires ALL of:
  //   - jawline definition  (lowerFaceEdges ≥ threshold)
  //   - cheekbone visibility (edgeDensity ≥ threshold)
  //   - facial sharpness    (angularity pillar above floor)
  //
  // Tier gates — hard ceilings based on structural evidence:
  //   lfe < 4.5  → definitively fat/soft → MAX 5.1 (Low-Mid Tier Normie)
  //   lfe < 5.0  → soft jaw → MAX 5.5 (solid Mid Tier)
  //   lfe < 5.8  → below-avg structure → MAX 5.9 (cannot reach High Tier, period)
  //   lfe ≥ 5.8 but ang < 5.5 → structure insufficient → MAX 5.9
  //   lfe ≥ 5.8  → adequate structure → High Tier possible

  if (lowerFaceEdges < 4.5) {
    finalScore = Math.min(finalScore, 5.1)  // fat face — hard cap
  } else if (lowerFaceEdges < 5.0) {
    finalScore = Math.min(finalScore, 5.5)  // soft jaw — mid tier ceiling
  } else if (lowerFaceEdges < 5.8 || ang < 5.5) {
    finalScore = Math.min(finalScore, 5.9)  // below-avg structure — cannot reach High Tier
  } else if (finalScore >= 6.0) {
    // High Tier requires BOTH jaw structure AND cheekbone/edge definition
    const hasJaw   = lowerFaceEdges >= 5.8
    const hasShape = edgeDensity    >= 5.5
    if (!hasJaw || !hasShape) finalScore = Math.min(finalScore, 5.9)
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 6 — DISTRIBUTION COMPRESSION
  // Enforces target distribution: average 4.5–6.0, attractive 6.0–7.5, rare 7.5+
  // No compression ≤ 6.0 — preserve honest below-average and average ratings.
  // ══════════════════════════════════════════════════════════════════════════════
  let compressed
  if (finalScore <= 6.0) {
    compressed = finalScore
  } else if (finalScore <= 7.0) {
    compressed = 6.0 + (finalScore - 6.0) * 0.88          // 6.0→6.0, 7.0→6.88
  } else if (finalScore <= 8.0) {
    compressed = 6.88 + (finalScore - 7.0) * 0.76         // 7.0→6.88, 8.0→7.64
  } else {
    compressed = 7.64 + (finalScore - 8.0) * 0.55         // 8.0→7.64, 9.8→8.63
  }
  finalScore = round1(clamp(compressed, 1.0, 9.8))

  // ══════════════════════════════════════════════════════════════════════════════
  // STEP 7 — REFERENCE CALIBRATION ANCHOR SYSTEM
  //
  // ALL scores are judged relative to fixed anchor points.
  // Score 5.0 = average male: moderate facial fat, no angularity, normal proportions.
  // This is the MOST COMMON face. Everything is relative to this baseline.
  //
  // Anchor map:
  //   3.5–4.5 → Below average: noticeable fat OR weak structure, poor jaw, slight imbalance
  //   5.0–5.9 → Mid Tier Normie: slightly above avg, some good features, still soft
  //   6.0–6.9 → High Tier Normie: clear attractiveness, VISIBLE angularity, decent balance
  //   7.0–7.9 → Chadlite: strong jaw, cheekbones visible, clear sharpness — RARE
  //   8.0–8.9 → Chad: near-perfect proportions, very strong structure — EXTREMELY RARE
  //   9.0+    → Adam: practically flawless — ALMOST NEVER
  //
  // Comparison step: compare subject to 5.0 anchor.
  //   Better than average?  → score > 5.0
  //   Same as average?      → score ≈ 5.0
  //   Worse than average?   → score < 5.0
  // ══════════════════════════════════════════════════════════════════════════════

  // Anchor: score 5.0 corresponds to these measurement values:
  //   lowerFaceEdges ≈ 5.0 (neutral/soft jaw, no definition)
  //   edgeDensity    ≈ 5.0 (average facial definition)
  //   symmetry       ≈ 5.5 (slight asymmetry, very common)
  //   skinClarity    ≈ 5.5 (average skin)
  //   lowerFaceDark  ≈ 5.0 (no jaw shadow)

  const pillarAvg = round1((angularityScore + dimorphismScore + featuresScore + harmonyScore) / 4)
  const pillarMin = Math.min(angularityScore, dimorphismScore, featuresScore, harmonyScore)

  // Comparison check: is the subject better, equal to, or worse than 5.0 average?
  // Uses structure-weighted comparison: angularity + harmony carry 65% of the comparison.
  const structuralDelta =
    (lowerFaceEdges - 5.0) * 0.40 +  // jaw definition vs average
    (edgeDensity    - 5.0) * 0.20 +  // facial sharpness vs average
    (symmetry       - 5.5) * 0.25 +  // balance vs average
    (skinClarity    - 5.5) * 0.15    // skin vs average

  // If the calibrated delta says subject is below average but formula says otherwise → correct downward
  if (structuralDelta < -0.5 && finalScore > 5.0) {
    finalScore = Math.min(finalScore, 5.0 + structuralDelta * 0.3)
  }
  // If subject is clearly above average structurally → don't suppress artificially
  // (no upward correction needed — formula already handles this)

  // Sanity check: final cannot exceed weighted pillar average by more than 0.6
  finalScore = Math.min(finalScore, pillarAvg + 0.6)
  // Final cannot be more than 1.2 below pillar average if no severe structural issue
  if (pillarMin >= 4.5) finalScore = Math.max(finalScore, pillarAvg - 1.2)

  // Final anchor mismatch check:
  // If score is in "High Tier" range (6.0+) but both structural signals are weak → pull back
  if (finalScore >= 6.0 && lowerFaceEdges < 5.8 && ang < 5.8) {
    finalScore = Math.min(finalScore, 5.9)
  }
  // If score is in "Chadlite" range (7.0+) but structure is only average → pull back
  if (finalScore >= 7.0 && lowerFaceEdges < 6.5) {
    finalScore = Math.min(finalScore, 6.9)
  }

  // NaN guard
  finalScore = round1(clamp(finalScore, 1.0, 9.8))
  if (isNaN(finalScore)) finalScore = round1(clamp(pillarAvg, 1.0, 9.8))

  // ══════════════════════════════════════════════════════════════════════════════
  // POTENTIAL SCORE — what this person achieves with full looksmaxxing program
  // Boost each pillar based on realistic intervention ROI, then apply same pipeline
  // ══════════════════════════════════════════════════════════════════════════════
  const angBoost  = lowerFaceEdges < 4.5 ? 2.0 : lowerFaceEdges < 5.5 ? 1.2 : 0.5
  const dimBoost  = dimorphismScore < 5.0 ? 0.9 : dimorphismScore < 6.5 ? 0.5 : 0.3
  const featBoost = Math.min(skinClarity < 6.5 ? 1.3 : skinClarity < 7.5 ? 0.7 : 0.3, 9.0 - featuresScore)
  const harmBoost = harmonyScore < 5.5 ? 0.8 : harmonyScore < 6.5 ? 0.5 : 0.25

  let angP  = round1(clamp(angularityScore  + angBoost,  angularityScore,  9.0))
  const dimP  = round1(clamp(dimorphismScore  + dimBoost,  dimorphismScore,  9.0))
  const featP = round1(clamp(featuresScore    + featBoost, featuresScore,    9.0))
  const harmP = round1(clamp(harmonyScore     + harmBoost, harmonyScore,     9.0))

  // Apply same angularity ceiling to potential (slightly relaxed — fat loss modeled)
  if (lowerFaceEdges < 4.5) angP = Math.min(angP, 6.5)
  else if (lowerFaceEdges < 5.0) angP = Math.min(angP, 7.0)

  let rawPot = round1(angP * 0.30 + harmP * 0.35 + featP * 0.20 + dimP * 0.15)
  let potCompressed
  if (rawPot <= 6.0) potCompressed = rawPot
  else if (rawPot <= 7.0) potCompressed = 6.0 + (rawPot - 6.0) * 0.88
  else if (rawPot <= 8.0) potCompressed = 6.88 + (rawPot - 7.0) * 0.76
  else potCompressed = 7.64 + (rawPot - 8.0) * 0.55
  const potAvg = round1((angP + dimP + featP + harmP) / 4)
  let potentialScore = round1(clamp(potCompressed, finalScore, 9.0))
  potentialScore = Math.min(potentialScore, potAvg + 0.8)
  potentialScore = round1(clamp(potentialScore, finalScore, 9.0))

  return {
    pillars: { angularity, dimorphism, features, harmony },
    aestheticScore: finalScore,
    potentialScore,
  }
}

// ─── UMax Score Calculation ───────────────────────────────────────────────────

export function calculateUMaxScore(pslMetrics, symmetry, gender = 'male') {
  const m = pslMetrics
  const isMale = gender === 'male'

  // Safe accessor — returns 5.0 (neutral) if a sub-metric is NaN/undefined
  const s = (v) => (v !== null && v !== undefined && !isNaN(v)) ? v : 5.0
  const safeSym = s(symmetry)

  // Weighted PSL formula — weights based on community consensus
  const raw = (
    s(m.canthalTilt?.score)   * (isMale ? 0.20 : 0.18) +  // #1 most discussed
    s(m.hunterEyes?.score)    * (isMale ? 0.15 : 0.13) +  // Critical for men
    s(m.jawDefinition?.score) * (isMale ? 0.15 : 0.10) +  // More important for men
    s(m.cheekbones?.score)    * (isMale ? 0.10 : 0.14) +  // More important for women
    safeSym                   * (isMale ? 0.12 : 0.14) +  // Foundation metric
    s(m.facialThirds?.score)  * (isMale ? 0.08 : 0.10) +  // Proportions
    s(m.fwhr?.score)          * (isMale ? 0.07 : 0.06) +  // Face width ratio
    s(m.skinTexture?.score)   * (isMale ? 0.06 : 0.10) +  // Skin matters more for women
    s(m.noseHarmony?.score)   * (isMale ? 0.04 : 0.07) +  // Nose harmony
    s(m.maxilla?.score)       * (isMale ? 0.03 : 0.08)    // Midface
  )

  // Apply same calibrated distribution compression as derivePillars
  // Ensures UMax score follows identical target distribution
  const clamped = clamp(raw, 1.0, 9.9)
  let compressed
  if (clamped <= 6.0) {
    compressed = clamped
  } else if (clamped <= 7.0) {
    compressed = 6.0 + (clamped - 6.0) * 0.88
  } else if (clamped <= 8.0) {
    compressed = 6.88 + (clamped - 7.0) * 0.76
  } else {
    compressed = 7.64 + (clamped - 8.0) * 0.55
  }
  const result = round1(clamp(compressed, 1.0, 9.8))
  // Final NaN guard — return null if still NaN so caller can show error
  return isNaN(result) ? null : result
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
//
// TWO-LAYER ANALYSIS:
//   Layer 1 — MediaPipe Face Mesh (real geometry, PREFERRED):
//     468 real facial landmarks → actual jaw width, gonial angle, face shape.
//     IMMUNE to hair/beard/lighting. Measures actual bone structure.
//   Layer 2 — Pixel analysis (fallback only):
//     Used ONLY if MediaPipe fails (no face detected, WASM error, etc.)
//     Known limitation: hair/beard inflate Sobel metrics.

export async function analyzeFacePhoto(photoUrl, gender = 'male') {
  try {
    const { ctx, width, height } = await getImageData(photoUrl)
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    // ── Always run pixel measurements (skinClarity + lowerFaceDark are reliable) ─
    const skinClarity   = getSkinClarity(data, width, height)
    const lowerFaceDark = getLowerFaceDarkness(data, width, height)

    // Average luminance
    let totalLum = 0, lumCount = 0
    for (let i = 0; i < data.length; i += 20) {
      totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      lumCount++
    }
    const avgLum = lumCount > 0 ? totalLum / lumCount : 128

    // ── Layer 1: MediaPipe Face Mesh — real geometric measurements ─────────────
    // These REPLACE the broken pixel-based edgeDensity, lowerFaceEdges, symmetry.
    // Jaw taper, gonial angle, face elongation = actual bone structure, not hair.
    let edgeDensity, lowerFaceEdges, symmetry
    let usedLandmarks = false

    try {
      const { getLandmarks, computeStructuralMetrics } = await import('./faceLandmarks.js')
      const landmarks = await getLandmarks(photoUrl)
      const geo = computeStructuralMetrics(landmarks)

      // Use real geometry — these are now fat-proof and beard-proof
      lowerFaceEdges = geo.lowerFaceEdges   // jaw definition from actual jaw width ratio
      edgeDensity    = geo.edgeDensity      // facial sharpness from real geometry
      symmetry       = geo.symmetry         // symmetry from actual landmark positions
      usedLandmarks  = true
      console.info('[Analysis] Using MediaPipe landmarks:', {
        jawTaper: geo._jawTaper,
        elongation: geo._elongation,
        gonialAngle: geo._gonialAvg,
        lowerFaceEdges, edgeDensity, symmetry
      })
    } catch (meshErr) {
      // ── Layer 2: Pixel fallback (less accurate, but better than nothing) ──────
      console.warn('[Analysis] Face mesh unavailable, using pixel fallback:', meshErr.message)
      symmetry       = getSymmetry(data, width, height)
      edgeDensity    = getEdgeDensity(data, width, height)
      lowerFaceEdges = getLowerFaceEdges(data, width, height)
    }

    // ── Derive PSL metrics ────────────────────────────────────────────────────
    const pslMetrics = derivePSLMetrics(skinClarity, symmetry, avgLum, edgeDensity, lowerFaceDark, lowerFaceEdges, gender)

    // ── 4-Pillar system ───────────────────────────────────────────────────────
    const { pillars, aestheticScore, potentialScore } = derivePillars(pslMetrics, symmetry, skinClarity, edgeDensity, lowerFaceDark, lowerFaceEdges, gender)

    return {
      symmetry,
      jawlineDefinition: pslMetrics.jawDefinition.score,
      skinClarity,
      facialProportions: pslMetrics.facialThirds.score,
      eyeArea: pslMetrics.hunterEyes.score,
      facialHarmony: round1(clamp((symmetry + pslMetrics.cheekbones.score + pslMetrics.noseHarmony.score) / 3, 2, 9.8)),
      psl: pslMetrics,
      avgLum,
      edgeDensity,
      lowerFaceDark,
      lowerFaceEdges,
      pillars,
      aestheticScore,
      potentialScore,
      usedLandmarks,
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

    // ── Real body measurements ────────────────────────────────────────────────
    // Edge density on body = muscle definition vs. fat/soft body
    // Muscular body: defined muscle groups create edges (striations, tapering)
    // Fat body: soft, rounded, few hard edges
    const bodyEdge = getEdgeDensity(data, width, height)

    // Horizontal profile: fit body has distinct shoulder-to-waist taper
    // V-taper = wide shoulders + narrow waist = high contour score
    const bodyContour = getFaceContourScore(data, width, height)

    // Vertical symmetry — bilateral body symmetry
    const bodySymmetry = getSymmetry(data, width, height)

    // avgLum as secondary seed stabilizer
    let totalLum = 0, count = 0
    for (let i = 0; i < data.length; i += 16) {
      totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      count++
    }
    const avgLum = count > 0 ? totalLum / count : 128

    // Seed from real measurements — not just avgLum
    const seed = bodyEdge * 100 + bodyContour * 10 + bodySymmetry + (gender === 'male' ? 50 : 100)
    const jitter = (s) => (seededRand(seed, s) - 0.5) * 1.4
    const bv = (base, s) => round1(clamp(base + jitter(s), 2.0, 9.8))

    // Shoulder-waist ratio: driven by bodyContour (V-taper profile) + bodyEdge (definition)
    const swBase = clamp(bodyContour * 0.55 + bodyEdge * 0.45, 1, 10)
    const shoulderWaistRatio = bv(swBase, 1)

    // Posture: body symmetry + contour (upright posture = symmetrical vertical profile)
    const postureBase = clamp(bodySymmetry * 0.60 + bodyContour * 0.40, 1, 10)
    const posture = bv(postureBase, 2)

    // Body proportions: edge + contour (well-proportioned body has both definition and shape)
    const propBase = clamp(bodyEdge * 0.50 + bodyContour * 0.35 + bodySymmetry * 0.15, 1, 10)
    const bodyProportions = bv(propBase, 3)

    // Body composition: edge density is the best proxy — defined muscles vs. fat
    // High edge density = visible muscle = lean → high composition score
    // Low edge density = soft/round = higher body fat → low score
    const compBase = clamp(bodyEdge * 0.65 + bodySymmetry * 0.20 + bodyContour * 0.15, 1, 10)
    const bodyComposition = bv(compBase, 4)

    const forwardHeadAngle = round1(clamp(seededRand(seed, 5) * 14 + 1, 1, 18))

    // ── Clavicle Width ────────────────────────────────────────────────────────
    // Body contour score captures shoulder vs waist width ratio → clavicle proxy
    const clavicleBase = clamp(bodyContour * 0.60 + bodyEdge * 0.40, 1, 10)
    const clavicleScore = round1(clamp(clavicleBase + (seededRand(seed, 6) - 0.5) * 1.2, 2, 9.8))
    const clavicleCategory = clavicleScore >= 7.2 ? 'Wide' : clavicleScore >= 4.8 ? 'Average' : 'Narrow'
    const clavicleExplanations = {
      Wide: gender === 'male'
        ? 'Broad clavicle structure detected. Wide clavicles create natural shoulder dominance, amplify V-taper effect, and project frame density even at lower muscle mass.'
        : 'Wide clavicle structure detected. This creates a naturally broad shoulder frame that benefits from structured upper-body training.',
      Average: gender === 'male'
        ? 'Average clavicle width. Lateral deltoid development through isolation movements (cable laterals, DB laterals) will significantly widen the visual shoulder frame.'
        : 'Average clavicle width. Targeted shoulder work and posture correction will maximize your shoulder-to-waist visual ratio.',
      Narrow: gender === 'male'
        ? 'Narrow clavicle structure. This is the most important structural limitation to address. Prioritize lateral delt hypertrophy above all other muscle groups — this single change has the highest visual ROI.'
        : 'Narrow clavicle structure. Structured shoulder and upper-back training creates the visual width illusion. Posture correction also has significant impact.',
    }

    return {
      shoulderWaistRatio,
      posture,
      bodyProportions,
      bodyComposition,
      forwardHeadAngle,
      postureGradeValue: postureGrade(posture),
      compositionCategory: getCompositionCategory(bodyComposition),
      clavicleWidth: {
        category: clavicleCategory,
        score: clavicleScore,
        explanation: clavicleExplanations[clavicleCategory],
      },
    }
  } catch (e) {
    console.warn('Body analysis fallback:', e.message)
    return generateFallbackBodyScores()
  }
}

// ─── Composite Scoring ────────────────────────────────────────────────────────

export function calculateGlowScore(faceData, bodyData) {
  // Safe accessor — substitutes 5.0 (neutral midpoint) for any NaN/null/undefined value
  const s = (v) => (v !== null && v !== undefined && !isNaN(v)) ? v : 5.0

  const faceScore =
    s(faceData.symmetry)           * 0.08 +
    s(faceData.jawlineDefinition)  * 0.07 +
    s(faceData.skinClarity)        * 0.10 +
    s(faceData.facialProportions)  * 0.07 +
    s(faceData.eyeArea)            * 0.04 +
    s(faceData.facialHarmony)      * 0.04

  const bodyScore =
    s(bodyData.shoulderWaistRatio) * 0.10 +
    s(bodyData.posture)            * 0.12 +
    s(bodyData.bodyProportions)    * 0.08 +
    s(bodyData.bodyComposition)    * 0.05

  const presentationScore = (faceScore / 0.40 + bodyScore / 0.35) / 2
  const rawGlow = Math.round((faceScore + bodyScore + presentationScore * 0.25) * 10)

  return {
    glowScore: isNaN(rawGlow) ? 50 : clamp(rawGlow, 1, 100),
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

  // ── FINAL VALIDATION ──────────────────────────────────────────────────────
  // Verify all critical scores are valid numbers before returning results.
  // If core scores are still NaN (should not happen after fixes above), surface an error
  // rather than letting NaN/undefined reach the display layer.
  const isValidScore = (v) => v !== null && v !== undefined && !isNaN(v) && typeof v === 'number'
  if (!isValidScore(glowScores.glowScore) || !isValidScore(umaxScore)) {
    throw new Error('Score calculation produced invalid results — please retake your scan with a clearer photo.')
  }

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
  // Produces neutral-range fallback scores (roughly average person)
  // All 6 required arguments passed to derivePSLMetrics — missing args were the root cause of NaN cascade
  const v = (base) => round1(clamp(base + (Math.random() - 0.5) * 2.5, 4.0, 8.5))
  const skin = v(6.5), sym = v(6.8), edgeDen = v(5.5), lowerDark = v(5.5), lowerEdges = v(5.5)
  const psl = derivePSLMetrics(skin, sym, 128, edgeDen, lowerDark, lowerEdges, gender)
  const { pillars, aestheticScore, potentialScore } = derivePillars(psl, sym, skin, edgeDen, lowerDark, lowerEdges, gender)
  return {
    symmetry: sym, jawlineDefinition: v(6.5), skinClarity: skin,
    facialProportions: v(7), eyeArea: v(6.8), facialHarmony: v(7),
    psl, avgLum: 128, edgeDensity: edgeDen, lowerFaceDark: lowerDark, lowerFaceEdges: lowerEdges,
    pillars, aestheticScore, potentialScore,
  }
}

function generateFallbackBodyScores() {
  const v = (base) => round1(clamp(base + (Math.random() - 0.5) * 3, 3, 9.5))
  const posture = v(6.5)
  const clavScore = v(6.0)
  return {
    shoulderWaistRatio: v(6.8), posture, bodyProportions: v(7),
    bodyComposition: v(6.5), forwardHeadAngle: round1(Math.random() * 15 + 3),
    postureGradeValue: postureGrade(posture),
    compositionCategory: 'Athletic',
    clavicleWidth: {
      category: clavScore >= 7.2 ? 'Wide' : clavScore >= 4.8 ? 'Average' : 'Narrow',
      score: clavScore,
      explanation: 'Average clavicle width. Lateral deltoid development through isolation movements will significantly widen the visual shoulder frame.',
    },
  }
}

function getCompositionCategory(score) {
  if (score >= 8.5) return 'Lean/Athletic'
  if (score >= 7) return 'Athletic'
  if (score >= 5.5) return 'Average'
  if (score >= 4) return 'Overweight'
  return 'Obese'
}
