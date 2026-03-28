const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const db = require('../db')

const router = express.Router()

// Curated product recommendations database
const PRODUCTS = [
  { id: 'p1', name: 'CeraVe Foaming Facial Cleanser', brand: 'CeraVe', category: 'cleanser', price: 14.99, description: 'Gentle foaming cleanser with 3 essential ceramides. Removes excess oil without disrupting the skin barrier.', affiliateUrl: '#', tags: ['acne', 'oily', 'combination'] },
  { id: 'p2', name: 'The Ordinary Niacinamide 10% + Zinc 1%', brand: 'The Ordinary', category: 'serum', price: 6.80, description: 'Controls sebum, reduces pore appearance, brightens skin tone. Best bang for buck in skincare.', affiliateUrl: '#', tags: ['acne', 'oily', 'hyperpigmentation'] },
  { id: 'p3', name: 'Paula\'s Choice BHA 2% Liquid Exfoliant', brand: 'Paula\'s Choice', category: 'exfoliant', price: 34.00, description: 'The gold standard BHA for clearing pores from the inside. Reduces blackheads and smooths texture.', affiliateUrl: '#', tags: ['acne', 'oily', 'pores'] },
  { id: 'p4', name: 'EltaMD UV Clear SPF 46', brand: 'EltaMD', category: 'sunscreen', price: 41.00, description: 'Dermatologist-recommended SPF for acne-prone skin. Niacinamide-infused, non-comedogenic.', affiliateUrl: '#', tags: ['acne', 'sensitive', 'daily'] },
  { id: 'p5', name: 'The Ordinary Retinol 0.5%', brand: 'The Ordinary', category: 'retinol', price: 10.80, description: 'Entry-level retinoid to start building tolerance. Use 2-3x/week initially, gradually increase.', affiliateUrl: '#', tags: ['antiaging', 'acne', 'texture'] },
  { id: 'p6', name: 'La Roche-Posay Toleriane Double Repair', brand: 'La Roche-Posay', category: 'moisturizer', price: 22.99, description: 'Dual-action barrier repair with ceramides and niacinamide. Works for virtually every skin type.', affiliateUrl: '#', tags: ['sensitive', 'dry', 'barrier'] },
  { id: 'p7', name: 'LANEIGE Water Sleeping Mask', brand: 'LANEIGE', category: 'mask', price: 25.00, description: 'Overnight hydration treatment with hyaluronic acid. Wake up with visibly plumper skin.', affiliateUrl: '#', tags: ['dry', 'antiaging', 'hydration'] },
  { id: 'p8', name: 'Differin Adapalene Gel 0.1%', brand: 'Differin', category: 'retinoid', price: 14.88, description: 'OTC retinoid — clinically proven to clear acne and prevent breakouts at the source.', affiliateUrl: '#', tags: ['acne', 'texture', 'antiaging'] },
  { id: 'p9', name: 'Timeless Vitamin C 20% Serum', brand: 'Timeless', category: 'vitamin_c', price: 24.95, description: 'High-potency vitamin C + E + Ferulic. Brightens, firms, and neutralizes free radical damage.', affiliateUrl: '#', tags: ['antiaging', 'hyperpigmentation', 'brightening'] },
  { id: 'p10', name: 'CeraVe Eye Repair Cream', brand: 'CeraVe', category: 'eye_cream', price: 14.99, description: 'Ceramide + hyaluronic acid for the under-eye area. Reduces puffiness and dark circles.', affiliateUrl: '#', tags: ['dark_circles', 'antiaging', 'eyes'] },
]

router.get('/recommended', authMiddleware, (req, res) => {
  // In production: personalize based on user's skin issues from scan data
  const scan = db.prepare('SELECT face_data FROM scans WHERE user_id = ? ORDER BY scan_date DESC LIMIT 1').get(req.userId)

  let tags = ['daily'] // default
  if (scan?.face_data) {
    const faceData = JSON.parse(scan.face_data)
    if (faceData.skinClarity < 6) tags.push('acne', 'oily')
    if (faceData.eyeArea < 6) tags.push('dark_circles', 'eyes')
    if (faceData.facialHarmony < 7) tags.push('antiaging')
  }

  const recommended = PRODUCTS.filter(p => p.tags.some(t => tags.includes(t)))
    .slice(0, 6)
    .map(({ affiliateUrl, ...p }) => ({ ...p, affiliateUrl })) // include affiliate links

  res.json({ products: recommended.length > 0 ? recommended : PRODUCTS.slice(0, 4) })
})

module.exports = router
