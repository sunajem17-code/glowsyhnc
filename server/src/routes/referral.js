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

// POST /api/referral/claim-trial
router.post('/claim-trial', verifyToken, async (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Account required to claim trial' })

  const user = await getUser(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  if (user.subscription_tier === 'premium') {
    return res.json({ ok: true, message: 'Already Pro' })
  }

  if (user.pro_trial_expires_at && new Date() < new Date(user.pro_trial_expires_at)) {
    return res.json({ ok: true, expiresAt: user.pro_trial_expires_at })
  }

  const count = user.referral_count || 0
  if (count < 5) {
    return res.status(403).json({
      error: `Need 5 referrals to claim trial. You have ${count}.`,
      referralCount: count,
    })
  }

  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  const expiresAt = expires.toISOString()

  // Update Supabase (primary) + SQLite (fallback)
  try { await updateUserById(req.userId, { subscription_tier: 'trial', pro_trial_expires_at: expiresAt }) } catch {}
  try { db.prepare("UPDATE users SET subscription_tier = 'trial', pro_trial_expires_at = ? WHERE id = ?").run(expiresAt, req.userId) } catch {}

  res.json({ ok: true, expiresAt })
})

module.exports = router
