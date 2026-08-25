const express = require('express')
const db = require('../db')
const { verifyToken } = require('../middleware/claudeGate')
const { getUserById, updateUserById } = require('../supabase')

const router = express.Router()

// ── helper: get user from Supabase or SQLite ──────────────────────────────────
async function getUser(userId) {
  const sbUser = await getUserById(userId).catch(() => null)
  if (sbUser) return sbUser
  return db.prepare('SELECT referral_count, referral_code, subscription_tier, pro_trial_expires_at FROM users WHERE id = ?').get(userId)
}

// GET /api/referral/count
router.get('/count', verifyToken, async (req, res) => {
  if (req.isDemo) return res.json({ count: 0, code: null })
  const user = await getUser(req.userId)
  res.json({ count: user?.referral_count || 0, code: user?.referral_code || null })
})

// POST /api/referral/unlock-pro
// Grant permanent Pro if user has >= 3 referrals (share-to-unlock flow)
router.post('/unlock-pro', verifyToken, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Account required' })

  const user = await getUser(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  if (user.subscription_tier === 'premium' || user.is_pro) {
    return res.json({ ok: true, isPremium: true, message: 'Already Pro' })
  }

  const count = user.referral_count || 0
  if (count < 3) {
    return res.status(403).json({
      error: `Need 3 referrals to unlock Pro. You have ${count}.`,
      referralCount: count,
      needed: 3 - count,
    })
  }

  // Update Supabase (primary) + SQLite (fallback).
  // If both fail, do not return success — the tier was never actually updated.
  let sbOk = false
  let sqliteOk = false

  try {
    await updateUserById(req.userId, { subscription_tier: 'premium', is_pro: true })
    sbOk = true
  } catch (err) {
    console.error('[referral/unlock-pro] Supabase update failed:', err.message)
  }

  try {
    db.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1 WHERE id = ?").run(req.userId)
    sqliteOk = true
  } catch (err) {
    console.error('[referral/unlock-pro] SQLite update failed:', err.message)
  }

  if (!sbOk && !sqliteOk) {
    return res.status(500).json({ error: 'Failed to unlock Pro — please try again or contact support.' })
  }

  res.json({ ok: true, isPremium: true })
})

module.exports = router
