/**
 * claudeGate.js
 * Security middleware for all Claude API endpoints.
 *
 * Exports:
 *   verifyToken   — JWT required; demo-token accepted as rate-limited guest
 *   claudeLimit   — 10 Claude calls / user / hour (all endpoints)
 *   scanLimit     — 3 scans / free user / day
 *   requirePro    — 403 unless user has active Pro or trial
 */

const jwt = require('jsonwebtoken')
const db  = require('../db')
const { getSupabase, getUserById } = require('../supabase')

const JWT_SECRET = process.env.JWT_SECRET

// ── In-memory rate limit store ─────────────────────────────────────────────────
// Map<key, { count, windowStart }>
const _limits = new Map()

function checkLimit(userId, bucket, max, windowMs) {
  const key = `${userId}:${bucket}`
  const now = Date.now()
  let entry = _limits.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { count: 0, windowStart: now }
  }

  if (entry.count >= max) {
    _limits.set(key, entry)
    return false   // rejected
  }

  entry.count += 1
  _limits.set(key, entry)
  return true      // allowed
}

// Prune stale entries every 30 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000  // 2 hours
  for (const [key, entry] of _limits) {
    if (entry.windowStart < cutoff) _limits.delete(key)
  }
}, 30 * 60 * 1000)

// ── 1. Token verification ──────────────────────────────────────────────────────
function verifyToken(req, res, next) {
  const header = req.headers.authorization
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — token required' })
  }

  // Demo token: limited guest access, no real user in DB
  if (token === 'demo-token') {
    req.userId   = 'demo'
    req.isDemo   = true
    req.isPro    = false
    return next()
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    req.isDemo = false
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── 2. Claude call rate limit (all endpoints) ──────────────────────────────────
// Max 10 Claude calls per user per hour
function claudeLimit(req, res, next) {
  const allowed = checkLimit(req.userId, 'claude', 10, 60 * 60 * 1000)
  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limit reached — max 10 AI requests per hour',
    })
  }
  next()
}

// ── 3. Scan-specific rate limit (free users only) ──────────────────────────────
// Max 3 scans per day for free users; Pro users are unrestricted
async function scanLimit(req, res, next) {
  // Pro users skip the scan cap entirely
  if (req.isPro) return next()

  // Demo users: 1 scan per session (per hour window)
  if (req.isDemo) {
    const allowed = checkLimit(req.userId, 'scan', 1, 60 * 60 * 1000)
    if (!allowed) {
      return res.status(429).json({
        error: 'Scan limit reached — create an account and upgrade to Pro for unlimited scans',
      })
    }
    return next()
  }

  // Real free users: 3 scans per 24 hours
  const allowed = checkLimit(req.userId, 'scan', 3, 24 * 60 * 60 * 1000)
  if (!allowed) {
    return res.status(429).json({
      error: 'Free tier limit — max 3 scans per day. Upgrade to Pro for unlimited.',
    })
  }
  next()
}

// ── helper: resolve subscription tier from Supabase (primary) or SQLite (fallback) ──
async function getSubscriptionTier(userId) {
  // Try Supabase first (production primary store)
  const sbUser = await getUserById(userId)
  if (sbUser) {
    return {
      tier: sbUser.subscription_tier || 'free',
      trialExpires: sbUser.pro_trial_expires_at || null,
      isPro: sbUser.subscription_tier === 'premium' ||
        (sbUser.subscription_tier === 'trial' && sbUser.pro_trial_expires_at && new Date() < new Date(sbUser.pro_trial_expires_at)) ||
        sbUser.is_pro === true,
    }
  }
  // Fall back to SQLite (local dev)
  const row = db.prepare('SELECT subscription_tier, pro_trial_expires_at FROM users WHERE id = ?').get(userId)
  const trialActive = row?.subscription_tier === 'trial' && row.pro_trial_expires_at && new Date() < new Date(row.pro_trial_expires_at)
  return {
    tier: row?.subscription_tier || 'free',
    trialExpires: row?.pro_trial_expires_at || null,
    isPro: row?.subscription_tier === 'premium' || trialActive,
  }
}

// ── 4. Pro gate ────────────────────────────────────────────────────────────────
async function requirePro(req, res, next) {
  if (req.isDemo) {
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  }
  try {
    const { isPro } = await getSubscriptionTier(req.userId)
    if (isPro) {
      req.isPro = true
      return next()
    }
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature' })
  } catch (err) {
    console.error('[claudeGate] requirePro error:', err.message)
    return res.status(500).json({ error: 'Could not verify subscription' })
  }
}

// ── 5. Resolve isPro for non-gated routes (sets req.isPro without blocking) ───
async function resolvePro(req, res, next) {
  if (req.isDemo) { req.isPro = false; return next() }
  try {
    const { isPro } = await getSubscriptionTier(req.userId)
    req.isPro = isPro
  } catch {
    req.isPro = false
  }
  next()
}

module.exports = { verifyToken, claudeLimit, scanLimit, requirePro, resolvePro }
