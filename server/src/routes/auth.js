const express = require('express')
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { signToken } = require('../middleware/auth')
const { getSupabase, getUserByEmail, createUser } = require('../supabase')
const { createLimiter } = require('../middleware/ratelimit')
const { verifyAppleToken } = require('../utils/appleAuth')

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
  if (!email || !password) return res.status(400).json({ error: 'All fields required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  try {
    const sb = getSupabase()

    if (sb) {
      // ── Supabase path (production) ──────────────────────────────────────────
      const existing = await getUserByEmail(email)
      if (existing) return res.status(409).json({ error: 'Email already registered' })

      const hash = await bcrypt.hash(password, 12)
      const id = uuid()
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`

      const user = await createUser({
        id,
        email,
        name: name || '',
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

      const hash = await bcrypt.hash(password, 12)
      const id = uuid()
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`

      db.prepare('INSERT INTO users (id, email, name, password_hash, referral_code) VALUES (?, ?, ?, ?, ?)').run(id, email, name || '', hash, ownCode)
      db.prepare('INSERT INTO streaks (user_id) VALUES (?)').run(id)

      if (refCode && typeof refCode === 'string') {
        const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(refCode.toUpperCase())
        if (referrer && referrer.id !== id) {
          db.prepare('UPDATE users SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = ?').run(referrer.id)
        }
      }

      const user = { id, name: name || '', email, subscriptionTier: 'free', createdAt: new Date().toISOString() }
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

// ── POST /api/auth/apple ──────────────────────────────────────────────────────
router.post('/apple', authLimiter, async (req, res) => {
  const { identityToken, name, email, guestUserId } = req.body
  if (!identityToken) return res.status(400).json({ error: 'identityToken required' })

  let payload
  try {
    // Verify Apple's RS256 signature + issuer + audience. NEVER trust an
    // unverified decode — the claims would be attacker-controlled.
    payload = await verifyAppleToken(identityToken)
  } catch (err) {
    console.warn('[Auth] Apple token verification failed:', err.message)
    return res.status(401).json({ error: 'Invalid Apple identity token' })
  }

  try {
    const appleSub = payload.sub
    // Trust the email from the verified token over any client-supplied value.
    const appleEmail = payload.email || email || `${appleSub}@privaterelay.appleid.com`

    const sb = getSupabase()

    if (sb) {
      // Look up by verified apple_sub first, then by verified email. Values come
      // from the cryptographically verified token, so the practical risk is low
      // — but double-quote them anyway so a comma or period in either value
      // (e.g. an edge-case private-relay address) can't be parsed as a second
      // filter clause by PostgREST's raw .or() syntax.
      const { data: existing } = await sb
        .from('users')
        .select('*')
        .or(`apple_sub.eq."${appleSub}",email.eq."${appleEmail}"`)
        .maybeSingle()

      if (existing) {
        // Update apple_sub if missing
        if (!existing.apple_sub) {
          await sb.from('users').update({ apple_sub: appleSub }).eq('id', existing.id)
        }
        // Migrate any scan history from the guest session to the real account
        if (guestUserId && guestUserId !== existing.id) {
          try { await sb.from('scan_history').update({ user_id: existing.id }).eq('user_id', guestUserId) } catch {}
          try { await sb.from('users').delete().eq('id', guestUserId).eq('is_guest', true) } catch {}
        }
        const safe = { id: existing.id, name: existing.name, email: existing.email, subscriptionTier: existing.subscription_tier || 'free', createdAt: existing.created_at, isAppleUser: true }
        return res.json({ user: safe, token: signToken(existing.id, existing.email) })
      }

      // Create new user — if a guest session exists, reuse its ID so all scan
      // records written under that ID automatically belong to the real account.
      const id = guestUserId || uuid()
      const userName = name || 'Ascendus User'
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`
      if (guestUserId) {
        // Upgrade the guest row in-place rather than creating a new one
        await sb.from('users').update({
          email: appleEmail, name: userName, apple_sub: appleSub,
          is_guest: false, referral_code: ownCode,
        }).eq('id', guestUserId).eq('is_guest', true)
        const safe = { id: guestUserId, name: userName, email: appleEmail, subscriptionTier: 'free', createdAt: new Date().toISOString(), isAppleUser: true }
        return res.json({ user: safe, token: signToken(guestUserId, appleEmail) })
      }
      const newUser = await createUser({
        id, email: appleEmail, name: userName,
        password_hash: null, apple_sub: appleSub,
        referral_code: ownCode, referral_count: 0,
        subscription_tier: 'free', created_at: new Date().toISOString(),
      })
      const safe = { id: newUser.id, name: newUser.name, email: newUser.email, subscriptionTier: 'free', createdAt: newUser.created_at, isAppleUser: true }
      return res.json({ user: safe, token: signToken(newUser.id, newUser.email) })
    }

    // SQLite fallback
    let user = db.prepare('SELECT * FROM users WHERE apple_sub = ? OR email = ?').get(appleSub, appleEmail)
    if (!user) {
      const id = uuid()
      const userName = name || 'Ascendus User'
      const ownCode = `ASC${id.substring(0, 5).toUpperCase()}`
      db.prepare('INSERT INTO users (id, name, email, apple_sub, password_hash, referral_code, subscription_tier, created_at) VALUES (?,?,?,?,?,?,?,?)').run(id, userName, appleEmail, appleSub, '', ownCode, 'free', new Date().toISOString())
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    }
    const safe = { id: user.id, name: user.name, email: user.email, subscriptionTier: user.subscription_tier || 'free', createdAt: user.created_at }
    return res.json({ user: safe, token: signToken(user.id, user.email) })
  } catch (err) {
    console.error('[Auth] Apple sign in error:', err.message, err.stack)
    // TEMP DEBUG — this route is intermittently 500ing and Railway's log UI
    // has been unreadable while chasing it live. Echo the real error back to
    // the client so it shows up straight in Xcode's console instead of
    // needing the dashboard at all. REVERT to { error: 'internal_error' }
    // once this is diagnosed — never ship error.message/stack to clients.
    res.status(500).json({ error: 'internal_error', debug: err.message, debugStack: String(err.stack).split('\n').slice(0, 5) })
  }
})

// ── POST /api/auth/guest ──────────────────────────────────────────────────────
// Creates an anonymous guest identity so the scan/AI-score step has a valid
// JWT before the user authenticates with Apple at the paywall.
// The guest row is marked is_guest=true and has no email or password.
// Rate-limited to 20/hour per IP to prevent spam account creation.
const checkGuestLimit = createLimiter('guest', 20, '1 h', 60 * 60 * 1000)
router.post('/guest', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const allowed = await checkGuestLimit(ip)
  if (!allowed) return res.status(429).json({ error: 'Too many requests' })

  try {
    const id = uuid()
    const sb = getSupabase()

    if (sb) {
      const { error: insertErr } = await sb.from('users').insert({
        id,
        email:             `guest-${id}@ascendus.internal`,
        name:              'Guest',
        password_hash:     null,
        apple_sub:         null,
        referral_code:     `GST${id.substring(0, 5).toUpperCase()}`,
        referral_count:    0,
        subscription_tier: 'free',
        is_guest:          true,
        created_at:        new Date().toISOString(),
      })
      if (insertErr) {
        console.error('[Auth] Guest insert failed:', insertErr.message)
        return res.status(500).json({ error: 'internal_error' })
      }
    } else {
      // SQLite fallback — is_guest column may not exist in local schema; use name sentinel
      try {
        db.prepare('INSERT INTO users (id, name, email, apple_sub, password_hash, referral_code, subscription_tier, created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(id, '__guest__', null, null, '', `GST${id.substring(0, 5).toUpperCase()}`, 'free', new Date().toISOString())
      } catch {
        // If email column has NOT NULL constraint in local SQLite, use placeholder
        db.prepare('INSERT INTO users (id, name, email, apple_sub, password_hash, referral_code, subscription_tier, created_at) VALUES (?,?,?,?,?,?,?,?)')
          .run(id, '__guest__', `guest-${id}@ascendus.internal`, null, '', `GST${id.substring(0, 5).toUpperCase()}`, 'free', new Date().toISOString())
      }
    }

    const token = signToken(id, null)
    res.json({ userId: id, token, isGuest: true })
  } catch (err) {
    console.error('[Auth] Guest session error:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

module.exports = router
