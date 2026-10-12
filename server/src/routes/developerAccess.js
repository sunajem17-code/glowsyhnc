// Temporary internal testing route. Remove before App Store release.
const express = require('express')
const { authMiddleware } = require('../middleware/auth')
const { updateUserById, getUserById, isConfigured } = require('../supabase')
const db = require('../db')
const { canUnlock } = require('../utils/developerAccessPolicy')
const { createLimiter } = require('../middleware/rateLimit')

const router = express.Router()
const limit = createLimiter('developer-unlock', 10, '1 m', 60000)
async function rateLimit(req, res, next) {
  try {
    if (!await limit(req.userId)) return res.status(429).json({ error: 'Please wait a minute before trying again' })
    next()
  } catch (err) { next(err) }
}

router.get('/status', authMiddleware, rateLimit, (req, res) => res.json({ enabled: canUnlock(req.userId) }))
router.post('/unlock', authMiddleware, rateLimit, async (req, res) => {
  if (!canUnlock(req.userId)) return res.status(403).json({ error: 'Developer unlock is disabled for this account' })
  try {
    const user = isConfigured() ? await getUserById(req.userId) : db.prepare('SELECT id FROM users WHERE id = ?').get(req.userId)
    if (!user) return res.status(401).json({ error: 'Please sign in again before unlocking' })
    const updates = { subscription_tier: 'premium', is_pro: true, promo_redeemed: false, promo_expires_at: null }
    if (isConfigured()) await updateUserById(req.userId, updates)
    else db.prepare("UPDATE users SET subscription_tier = 'premium', is_pro = 1, promo_expires_at = NULL WHERE id = ?").run(req.userId)
    res.json({ ok: true, isPremium: true })
  } catch (error) {
    console.error('[developer-access] unlock failed:', error.message)
    res.status(500).json({ error: 'Unable to unlock developer access' })
  }
})
module.exports = router
