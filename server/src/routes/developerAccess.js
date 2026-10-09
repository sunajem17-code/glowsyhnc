// Temporary internal testing route. Remove before App Store release.
const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { updateUserById, isConfigured } = require('../supabase')
const db = require('../db')

const router = express.Router()
const enabled = () => process.env.DEV_UNLOCK_ENABLED === 'true'
const allowedIds = () => (process.env.DEV_UNLOCK_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean)

router.get('/status', authMiddleware, (req, res) => {
  res.json({ enabled: enabled() && allowedIds().includes(req.userId) })
})

router.post('/unlock', authMiddleware, async (req, res) => {
  if (!enabled()) return res.status(404).json({ error: 'Developer unlock is disabled' })
  if (!allowedIds().includes(req.userId)) return res.status(403).json({ error: 'Developer unlock is not enabled for this account' })
  const updates = { subscription_tier: 'premium', is_pro: true, promo_redeemed: false, promo_expires_at: null }
  try {
    if (isConfigured()) await updateUserById(req.userId, updates)
    else db.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1, promo_expires_at = NULL WHERE id = ?").run(req.userId)
    res.json({ ok: true, isPremium: true })
  } catch (error) {
    console.error('[developer-access] unlock failed:', error.message)
    res.status(500).json({ error: 'Unable to unlock developer access' })
  }
})

module.exports = router
