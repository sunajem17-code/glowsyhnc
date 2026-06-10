// ─── Promo code redemption ────────────────────────────────────────────────────
// SOHAIL → grants lifetime Pro access (no expiry).
// Each user may redeem a promo code exactly once.

const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById } = require('../supabase')
const db = require('../db')

const router = express.Router()

const VALID_CODE = process.env.PROMO_CODE || 'SOHAIL'

router.post('/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body

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

  if (!sbUser) {
    try {
      const row = db.prepare('SELECT promo_redeemed FROM users WHERE id = ?').get(req.userId)
      if (row?.promo_redeemed) {
        return res.status(400).json({ error: 'Promo code already redeemed' })
      }
    } catch {}
  }

  // ── Grant lifetime Pro — no expiry date ───────────────────────────────────
  const updates = {
    subscription_tier: 'premium',
    is_pro: true,
    promo_redeemed: true,
    promo_expires_at: null, // null = never expires
  }

  try {
    await updateUserById(req.userId, updates)
  } catch (err) {
    console.warn('[Promo] Supabase update failed:', err.message)
  }

  try {
    db.prepare(`
      UPDATE users
      SET subscription_tier = 'premium', is_pro = 1, promo_redeemed = 1, promo_expires_at = NULL
      WHERE id = ?
    `).run(req.userId)
  } catch (err) {
    console.warn('[Promo] SQLite update failed (non-fatal):', err.message)
  }

  console.log(`[Promo] SOHAIL redeemed by user ${req.userId} — lifetime Pro granted`)

  return res.json({
    success: true,
    message: 'Lifetime Pro access activated',
    lifetime: true,
  })
})

module.exports = router
