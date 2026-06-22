// ─── Promo code redemption ────────────────────────────────────────────────────
// Each user may redeem a promo code exactly once.
// Server enforces MAX_REDEMPTIONS globally — client cannot bypass this.

const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { getUserById, updateUserById, isConfigured, getSupabase } = require('../supabase')
const db = require('../db')

const router = express.Router()

const VALID_CODE      = process.env.PROMO_CODE         || 'SOHAIL'
const MAX_REDEMPTIONS = parseInt(process.env.PROMO_MAX_REDEMPTIONS || '10', 10)

router.post('/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Invalid promo code' })
  }
  if (code.trim().toUpperCase() !== VALID_CODE.toUpperCase()) {
    return res.status(400).json({ error: 'Invalid promo code' })
  }

  // ── Server-side global redemption cap ─────────────────────────────────────
  // Count how many users have already redeemed this code. Client cannot
  // bypass this — it runs before any user-level check.
  const sb = getSupabase()
  let totalRedeemed = 0
  if (sb) {
    try {
      const { count } = await sb
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('promo_redeemed', true)
      totalRedeemed = count ?? 0
    } catch {}
  } else {
    try {
      const row = db.prepare('SELECT COUNT(*) as n FROM users WHERE promo_redeemed = 1').get()
      totalRedeemed = row?.n ?? 0
    } catch {}
  }

  if (totalRedeemed >= MAX_REDEMPTIONS) {
    console.warn(`[Promo] Code ${VALID_CODE} hit global cap (${MAX_REDEMPTIONS}) — rejected for user ${req.userId}`)
    return res.status(400).json({ error: 'This promo code has reached its redemption limit' })
  }

  // ── Per-user: already redeemed? ───────────────────────────────────────────
  let sbUser = null
  try { sbUser = await getUserById(req.userId) } catch {}

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

  // ── Grant lifetime Pro — no expiry date ──────────────────────────────────
  const updates = {
    subscription_tier: 'premium',
    is_pro: true,
    promo_redeemed: true,
    promo_expires_at: null, // null = lifetime, never expires
  }

  try {
    await updateUserById(req.userId, updates)
  } catch (err) {
    console.warn('[Promo] Supabase update failed:', err.message)
  }

  if (!isConfigured()) {
    try {
      db.prepare(`
        UPDATE users
        SET subscription_tier = 'premium', is_pro = 1, promo_redeemed = 1, promo_expires_at = NULL
        WHERE id = ?
      `).run(req.userId)
    } catch (err) {
      console.warn('[Promo] SQLite update failed (non-fatal):', err.message)
    }
  }

  console.log(`[Promo] ${VALID_CODE} redeemed by user ${req.userId} (total: ${totalRedeemed + 1}/${MAX_REDEMPTIONS})`)

  return res.json({
    success: true,
    message: 'Lifetime Pro access activated',
    lifetime: true,
  })
})

module.exports = router
