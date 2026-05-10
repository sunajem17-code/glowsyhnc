// ─── Promo code redemption ────────────────────────────────────────────────────
// One valid code: SOHAIL → grants 3 months of Pro access.
// Each user may redeem a promo code exactly once.

const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById } = require('../supabase')
const db = require('../db')

const router = express.Router()

const VALID_CODE = process.env.PROMO_CODE || 'SOHAIL'
const PRO_MONTHS = 3

router.post('/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body

  // ── Validate code ──────────────────────────────────────────────────────────
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid promo code' })
  }
  if (code.trim().toUpperCase() !== VALID_CODE) {
    return res.status(400).json({ error: 'Invalid promo code' })
  }

  // ── Check if already redeemed ──────────────────────────────────────────────
  let sbUser = null
  try {
    sbUser = await getUserById(req.userId)
  } catch {}

  if (sbUser?.promo_redeemed) {
    return res.status(400).json({ error: 'Promo code already redeemed' })
  }

  // SQLite fallback check
  if (!sbUser) {
    try {
      const row = db.prepare('SELECT promo_redeemed FROM users WHERE id = ?').get(req.userId)
      if (row?.promo_redeemed) {
        return res.status(400).json({ error: 'Promo code already redeemed' })
      }
    } catch {}
  }

  // ── Grant 3 months of Pro ──────────────────────────────────────────────────
  const promoExpiresAt = new Date()
  promoExpiresAt.setMonth(promoExpiresAt.getMonth() + PRO_MONTHS)
  const expiresIso = promoExpiresAt.toISOString()

  const updates = {
    subscription_tier: 'premium',
    is_pro: true,
    promo_redeemed: true,
    promo_expires_at: expiresIso,
  }

  // Supabase (primary)
  try {
    await updateUserById(req.userId, updates)
  } catch (err) {
    console.warn('[Promo] Supabase update failed:', err.message)
  }

  // SQLite (fallback / belt-and-suspenders)
  try {
    db.prepare(`
      UPDATE users
      SET subscription_tier = 'premium', promo_redeemed = 1, promo_expires_at = ?
      WHERE id = ?
    `).run(expiresIso, req.userId)
  } catch (err) {
    console.warn('[Promo] SQLite update failed (non-fatal):', err.message)
  }

  console.log(`[Promo] SOHAIL redeemed by user ${req.userId} — Pro until ${expiresIso}`)

  return res.json({
    success: true,
    message: '3 months of Pro access activated',
    expiresAt: expiresIso,
  })
})

module.exports = router
