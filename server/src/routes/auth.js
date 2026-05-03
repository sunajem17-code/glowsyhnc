const express = require('express')
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { signToken } = require('../middleware/auth')
const { getSupabase, getUserByEmail, createUser } = require('../supabase')
const { createLimiter } = require('../middleware/ratelimit')

const router = express.Router()

// ── Rate limiter: 10 attempts per 15 minutes per IP (Upstash-backed) ─────────
const checkAuthLimit = createLimiter('auth', 10, '15 m', 15 * 60 * 1000)

async function authLimiter(req, res, next) {
  const ip      = req.ip || req.socket?.remoteAddress || 'unknown'
  const allowed = await checkAuthLimit(ip)
  if (!allowed) {
    return res.status(429).json({ error: 'Too many attempts — please try again in 15 minutes' })
  }
  next()
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, refCode } = req.body
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  try {
    const sb = getSupabase()

    if (sb) {
      // ── Supabase path (production) ──────────────────────────────────────────
      const existing = await getUserByEmail(email)
      if (existing) return res.status(409).json({ error: 'Email already registered' })

      const hash = await bcrypt.hash(password, 10)
      const id = uuid()
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`

      const user = await createUser({
        id,
        email,
        name,
        password_hash: hash,
        referral_code: ownCode,
        referral_count: 0,
        subscription_tier: 'free',
        created_at: new Date().toISOString(),
      })

      // Attribute referral
      if (refCode && typeof refCode === 'string') {
        const { data: referrer } = await sb
          .from('users')
          .select('id, referral_count')
          .eq('referral_code', refCode.toUpperCase())
          .maybeSingle()
        if (referrer && referrer.id !== id) {
          await sb.from('users')
            .update({ referral_count: (referrer.referral_count || 0) + 1 })
            .eq('id', referrer.id)
        }
      }

      const safe = { id: user.id, name: user.name, email: user.email, subscriptionTier: 'free', createdAt: user.created_at }
      return res.json({ user: safe, token: signToken(user.id, user.email) })

    } else {
      // ── SQLite fallback (local dev) ─────────────────────────────────────────
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
      if (existing) return res.status(409).json({ error: 'Email already registered' })

      const hash = await bcrypt.hash(password, 10)
      const id = uuid()
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`

      db.prepare('INSERT INTO users (id, email, name, password_hash, referral_code) VALUES (?, ?, ?, ?, ?)').run(id, email, name, hash, ownCode)
      db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(id)

      if (refCode && typeof refCode === 'string') {
        const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(refCode.toUpperCase())
        if (referrer && referrer.id !== id) {
          db.prepare('UPDATE users SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = ?').run(referrer.id)
        }
      }

      const user = { id, name, email, subscriptionTier: 'free', createdAt: new Date().toISOString() }
      return res.json({ user, token: signToken(id, email) })
    }
  } catch (err) {
    console.error('[Auth] Register error:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  try {
    const sb = getSupabase()
    let user

    if (sb) {
      // ── Supabase path (production) ──────────────────────────────────────────
      user = await getUserByEmail(email)
    } else {
      // ── SQLite fallback (local dev) ─────────────────────────────────────────
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (row) user = row
    }

    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    if (!user.password_hash) return res.status(401).json({ error: 'Invalid email or password' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' })

    const safe = {
      id:               user.id,
      name:             user.name,
      email:            user.email,
      subscriptionTier: user.subscription_tier || 'free',
      createdAt:        user.created_at,
    }
    res.json({ user: safe, token: signToken(user.id, user.email) })
  } catch (err) {
    console.error('[Auth] Login error:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

module.exports = router
