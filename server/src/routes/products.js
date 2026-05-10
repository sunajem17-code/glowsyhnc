const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const { authMiddleware } = require('../middleware/auth')
const { verifyToken, resolvePro } = require('../middleware/claudeGate')
const db = require('../db')

const router = express.Router()

// ── Static fallback product database ────────────────────────────────────────
// Used when Anthropic API is unavailable or as a fast fallback.
const PRODUCTS = [
  { id: 'p1',  name: 'CeraVe Foaming Facial Cleanser',          category: 'cleanser',   description: 'Gentle foaming cleanser with ceramides. Removes excess oil without disrupting the skin barrier.',                               searchQuery: 'CeraVe Foaming Facial Cleanser',           tags: ['acne', 'oily', 'combination'] },
  { id: 'p2',  name: 'The Ordinary Niacinamide 10% + Zinc 1%',  category: 'serum',      description: 'Controls sebum, reduces pore appearance, brightens skin tone. Best value serum for oily or acne-prone skin.',                   searchQuery: 'The Ordinary Niacinamide 10% Zinc 1%',     tags: ['acne', 'oily', 'hyperpigmentation'] },
  { id: 'p3',  name: "Paula's Choice BHA 2% Liquid Exfoliant",  category: 'exfoliant',  description: 'Gold-standard BHA that clears pores from the inside. Dissolves blackheads and smooths rough texture in 4–8 weeks.',            searchQuery: "Paula's Choice BHA 2% Liquid Exfoliant",   tags: ['acne', 'oily', 'pores', 'texture'] },
  { id: 'p4',  name: 'EltaMD UV Clear SPF 46',                  category: 'sunscreen',  description: 'Dermatologist-recommended SPF for problem skin. Niacinamide-infused, non-comedogenic, fragrance-free.',                        searchQuery: 'EltaMD UV Clear SPF 46',                   tags: ['acne', 'sensitive', 'daily', 'spf'] },
  { id: 'p5',  name: 'Differin Adapalene Gel 0.1%',             category: 'retinoid',   description: 'OTC retinoid clinically proven to clear acne and prevent new breakouts. Starts working at the follicle level.',                  searchQuery: 'Differin Adapalene Gel 0.1%',              tags: ['acne', 'texture', 'scarring'] },
  { id: 'p6',  name: 'La Roche-Posay Toleriane Double Repair',  category: 'moisturizer',description: 'Dual-action barrier repair with ceramides + niacinamide. Suitable for virtually every skin type including sensitive.',          searchQuery: 'La Roche-Posay Toleriane Double Repair',   tags: ['sensitive', 'dry', 'barrier', 'combination'] },
  { id: 'p7',  name: 'Timeless Vitamin C 20% Serum',            category: 'vitamin_c',  description: 'High-potency Vit C + E + Ferulic acid. Brightens tone, fades dark marks, and firms skin over 8–12 weeks.',                     searchQuery: 'Timeless Vitamin C 20% Serum',             tags: ['scarring', 'dullness', 'brightening', 'antiaging'] },
  { id: 'p8',  name: 'CeraVe Eye Repair Cream',                 category: 'eye_cream',  description: 'Ceramide and hyaluronic acid formula for the under-eye area. Reduces puffiness and fades dark circles.',                       searchQuery: 'CeraVe Eye Repair Cream',                  tags: ['dark_circles', 'eyes'] },
  { id: 'p9',  name: 'The Ordinary Retinol 0.5%',               category: 'retinol',    description: 'Entry-level retinoid for smoother texture and long-term collagen support. Build up from 2×/week.',                             searchQuery: 'The Ordinary Retinol 0.5%',                tags: ['antiaging', 'texture', 'scarring'] },
  { id: 'p10', name: 'Neutrogena Hydro Boost Water Gel',        category: 'moisturizer',description: 'Lightweight hyaluronic acid gel moisturizer. Delivers 8-hour hydration without clogging pores.',                              searchQuery: 'Neutrogena Hydro Boost Water Gel',         tags: ['dry', 'combination', 'hydration'] },
  { id: 'p11', name: 'American Crew Pomade',                    category: 'styling',    description: 'Medium hold, high shine pomade for defined, professional-looking styles. Water-soluble for easy wash-out.',                     searchQuery: 'American Crew Pomade',                     tags: ['grooming', 'hair_styling'] },
  { id: 'p12', name: 'Hims Hair Gummies for Men',               category: 'supplements',description: 'Biotin + folic acid + zinc supplement supporting thicker hair density from within.',                                           searchQuery: 'hair growth vitamins biotin men',           tags: ['hair_loss', 'hair_growth'] },
  { id: 'p13', name: 'Art of Sport Body Wash',                  category: 'body_care',  description: 'Performance body wash with activated charcoal and white pine. Eliminates odor and cleanses without stripping skin.',            searchQuery: 'Art of Sport Activated Charcoal Body Wash', tags: ['grooming', 'body'] },
  { id: 'p14', name: 'Gillette ProGlide Razor',                 category: 'shaving',    description: 'FlexBall technology follows facial contours for a consistently close, smooth shave that enhances jaw definition.',              searchQuery: 'Gillette ProGlide Flexball Razor',          tags: ['grooming', 'shaving', 'jawline'] },
  { id: 'p15', name: 'Jack Black Intense Therapy Lip Balm SPF 25', category: 'lip_care', description: 'SPF 25 lip balm in natural shades. Keeps lips moisturised, smooth, and photo-ready.',                                        searchQuery: 'Jack Black Intense Therapy Lip Balm SPF 25', tags: ['grooming', 'lips'] },
]

// ── Existing static GET endpoint (unchanged) ─────────────────────────────────
router.get('/recommended', authMiddleware, (req, res) => {
  const scan = db.prepare('SELECT face_data FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 1').get(req.userId)

  let tags = ['daily']
  if (scan?.face_data) {
    try {
      const faceData = JSON.parse(scan.face_data)
      if (faceData.skinClarity < 6) tags.push('acne', 'oily')
      if (faceData.eyeArea < 6)     tags.push('dark_circles', 'eyes')
      if (faceData.facialHarmony < 7) tags.push('antiaging')
    } catch {}
  }

  const recommended = PRODUCTS
    .filter(p => p.tags.some(t => tags.includes(t)))
    .slice(0, 6)

  res.json({ products: recommended.length > 0 ? recommended : PRODUCTS.slice(0, 4) })
})

// ── AI-personalised recommendations ──────────────────────────────────────────
// POST /api/products/recommendations
// Body: { weaknesses, skinIssues, groomingScore, pillars, gender }
// Returns: { products: [{ name, description, searchQuery }] }
//
// Calls Claude Haiku to generate 3–6 products tailored to the user's specific
// weak areas. Falls back to the static database if the API is unavailable.
// Uses verifyToken (accepts demo users) + resolvePro (sets req.isPro).
router.post('/recommendations', verifyToken, resolvePro, async (req, res) => {
  const {
    weaknesses   = [],
    skinIssues   = [],
    groomingScore,
    pillars      = {},
    gender       = 'male',
  } = req.body

  // ── Build context string for the prompt ───────────────────────────────────
  const weaknessList   = weaknesses.length  > 0 ? weaknesses.join(', ')  : 'none listed'
  const skinIssueList  = skinIssues.length  > 0 ? skinIssues.join(', ')  : 'none'
  const lowPillars     = pillars
    ? Object.entries(pillars)
        .filter(([, v]) => v != null && Number(v) < 6.5)
        .map(([k]) => k)
        .join(', ') || 'none'
    : 'unknown'
  const groomingTag    = groomingScore != null
    ? (Number(groomingScore) < 6 ? 'poor grooming detected' : Number(groomingScore) < 7.5 ? 'average grooming' : 'good grooming')
    : 'grooming unknown'

  // ── Try Haiku call ────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey })

      const prompt = `You are a product recommendation engine for a ${gender === 'female' ? "women's" : "men's"} appearance optimization app. Based on this user's AI scan results, recommend exactly 5 specific real products.

User's weak areas: ${weaknessList}
Skin issues detected: ${skinIssueList}
Grooming quality: ${groomingTag}
Low face pillars (under 6.5/10): ${lowPillars}
Gender: ${gender}

Return ONLY a valid JSON array with exactly 5 objects, no markdown, no explanation:
[
  {
    "name": "Exact product name (brand + product)",
    "description": "One sentence: what it does and why it helps this specific person's detected issues",
    "searchQuery": "optimized Amazon search query for this exact product"
  }
]

Rules:
- Use ONLY real, purchasable products from known brands (CeraVe, The Ordinary, Paula's Choice, Neutrogena, Differin, EltaMD, La Roche-Posay, Cetaphil, Jack Black, American Crew, etc.)
- Each product must directly address one of the user's detected weak areas
- Cover a mix of: skincare first (if skin issues), then grooming/haircare
- description must reference the detected issue it solves
- searchQuery must be specific enough to find the right product on Amazon`

      const message = await client.messages.create({
        model:      'claude-haiku-4-5',
        max_tokens: 900,
        messages:   [{ role: 'user', content: prompt }],
      })

      const raw = message.content[0]?.text?.trim() ?? ''

      // Extract JSON array from response (handle potential markdown wrapping)
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const products = JSON.parse(jsonMatch[0])
        if (Array.isArray(products) && products.length > 0) {
          console.log('[products] Haiku generated', products.length, 'recommendations')
          return res.json({ products, source: 'ai' })
        }
      }
      console.warn('[products] Haiku response could not be parsed as JSON array — falling back')
    } catch (err) {
      console.warn('[products] Haiku call failed (non-fatal):', err.message)
    }
  }

  // ── Static fallback ───────────────────────────────────────────────────────
  const allTags = [
    ...skinIssues,
    groomingScore != null && Number(groomingScore) < 6.5 ? 'grooming' : null,
    pillars?.harmony   != null && Number(pillars.harmony)   < 6.5 ? 'antiaging'  : null,
    pillars?.features  != null && Number(pillars.features)  < 6.5 ? 'texture'    : null,
    'daily',
  ].filter(Boolean)

  const fallback = PRODUCTS
    .filter(p => p.tags.some(t => allTags.includes(t)))
    .slice(0, 5)
    .map(({ id, tags: _t, ...p }) => p)

  res.json({
    products: fallback.length >= 2 ? fallback : PRODUCTS.slice(0, 5).map(({ id, tags: _t, ...p }) => p),
    source: 'fallback',
  })
})

module.exports = router
