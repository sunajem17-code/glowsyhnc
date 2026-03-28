const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/profile', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, name, avatar_url, subscription_tier, created_at FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)
  res.json({ user, streak })
})

router.put('/profile', authMiddleware, (req, res) => {
  const { name, avatarUrl } = req.body
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.userId)
  if (avatarUrl) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.userId)
  res.json({ success: true })
})

module.exports = router
