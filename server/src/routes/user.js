const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getUserById } = require('../supabase')

const router = express.Router()

router.get('/profile', authMiddleware, async (req, res) => {
  // Supabase is source of truth for subscription/pro status
  const sbUser = await getUserById(req.userId).catch(() => null)

  // SQLite fallback for everything else (streak, local dev)
  const localUser = db.prepare('SELECT id, email, name, avatar_url, subscription_tier, created_at FROM users WHERE id = ?').get(req.userId)
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)

  if (!sbUser && !localUser) return res.status(404).json({ error: 'User not found' })

  const base = sbUser || localUser
  const user = {
    id: base.id,
    name: base.name,
    email: base.email,
    avatarUrl: localUser?.avatar_url || null,
    subscriptionTier: base.subscription_tier || 'free',
    is_pro: sbUser?.is_pro === true || sbUser?.is_pro === 1 || false,
    stripe_subscription_id: sbUser?.stripe_subscription_id || null,
    createdAt: base.created_at,
  }

  res.json({ user, streak })
})

router.put('/profile', authMiddleware, (req, res) => {
  const { name, avatarUrl } = req.body
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId)
  if (avatarUrl) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.userId)
  res.json({ success: true })
})

module.exports = router
