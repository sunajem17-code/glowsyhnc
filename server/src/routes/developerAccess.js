const express = require('express')

// Temporary test access. No client flag, code, email or user ID can authorize it.
function createDeveloperAccessRouter({ authMiddleware, checkLimit, getUser, grant, env = () => process.env }) {
  const router = express.Router()
  const allowed = id => {
    const config = env()
    return Boolean(id) && config.DEV_UNLOCK_ENABLED === 'true' &&
      (config.DEV_UNLOCK_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(id)
  }
  async function rateLimit(req, res, next) {
    try {
      if (!await checkLimit(req.userId)) return res.status(429).json({ error: 'Please wait before trying again.' })
      next()
    } catch {
      res.status(503).json({ error: 'Developer access is temporarily unavailable.' })
    }
  }
  router.get('/access', authMiddleware, rateLimit, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ allowed: allowed(req.userId) })
  })
  router.post('/unlock', authMiddleware, rateLimit, async (req, res) => {
    if (!allowed(req.userId)) return res.status(403).json({ error: 'Developer access is not enabled for this account.' })
    try {
      if (!await getUser(req.userId)) return res.status(404).json({ error: 'Account not found.' })
      await grant(req.userId)
      const user = await getUser(req.userId)
      if (!user?.is_pro || user.subscription_tier !== 'premium') throw new Error('Grant did not persist')
      res.set('Cache-Control', 'no-store').json({ isPremium: true })
    } catch {
      res.status(503).json({ error: 'Could not save developer access. Please try again.' })
    }
  })
  return router
}

function productionRouter() {
  const { authMiddleware } = require('../middleware/auth')
  const { createLimiter } = require('../middleware/rateLimit')
  const { isConfigured, getUserById, updateUserById } = require('../supabase')
  const db = require('../db')
  return createDeveloperAccessRouter({
    authMiddleware,
    checkLimit: createLimiter('developer-unlock', 10, '15 m', 15 * 60 * 1000),
    getUser: id => isConfigured() ? getUserById(id) : db.prepare('SELECT * FROM users WHERE id = ?').get(id),
    grant: async id => {
      if (isConfigured()) await updateUserById(id, { is_pro: true, subscription_tier: 'premium' })
      else db.prepare("UPDATE users SET is_pro = 1, subscription_tier = 'premium' WHERE id = ?").run(id)
    },
  })
}
module.exports = { createDeveloperAccessRouter, productionRouter }
