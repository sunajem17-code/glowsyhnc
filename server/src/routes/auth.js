const express = require('express')
const bcrypt = require('bcryptjs')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { signToken } = require('../middleware/auth')

const router = express.Router()

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return res.status(409).json({ error: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)
    const id = uuid()
    db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)').run(id, email, name, hash)
    db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(id)

    const user = { id, name, email, subscriptionTier: 'free', createdAt: new Date().toISOString() }
    res.json({ user, token: signToken(id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const safe = { id: user.id, name: user.name, email: user.email, subscriptionTier: user.subscription_tier, createdAt: user.created_at }
    res.json({ user: safe, token: signToken(user.id) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
