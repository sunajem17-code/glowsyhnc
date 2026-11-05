const express = require('express')
const db = require('../db')
const { verifyToken } = require('../middleware/claudeGate')
const { getUserById } = require('../supabase')

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
// Kept as a closed compatibility route for old app builds. Referral counts
// must never grant subscription entitlements; only verified billing does.
router.post('/unlock-pro', verifyToken, async (req, res) => {
  res.status(410).json({ error: 'Pro membership requires a verified subscription.' })
})

module.exports = router
