const express = require('express')
const db = require('../db')
const { verifyToken } = require('../middleware/claudeGate')

const router = express.Router()

// GET /api/referral/count — returns this user's referral count and code
router.get('/count', verifyToken, (req, res) => {
  if (req.isDemo) return res.json({ count: 0, code: null })
  const user = db.prepare('SELECT referral_count, referral_code FROM users WHERE id = ?').get(req.userId)
  res.json({ count: user?.referral_count || 0, code: user?.referral_code || null })
})

// POST /api/referral/claim-trial — verify >= 5 referrals server-side, then grant 7-day trial
router.post('/claim-trial', verifyToken, (req, res) => {
  if (req.isDemo) return res.status(403).json({ error: 'Account required to claim trial' })

  const user = db.prepare('SELECT referral_count, subscription_tier, pro_trial_expires_at FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })

  // Already full Pro — nothing to grant
  if (user.subscription_tier === 'premium') {
    return res.json({ ok: true, message: 'Already Pro' })
  }

  // Trial already active
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

  db.prepare("UPDATE users SET subscription_tier = 'trial', pro_trial_expires_at = ? WHERE id = ?")
    .run(expiresAt, req.userId)

  res.json({ ok: true, expiresAt })
})

module.exports = router
