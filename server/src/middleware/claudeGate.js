/**
 * claudeGate.js
 * Security middleware for all Claude API endpoints.
 *
 * Exports:
 *   verifyToken   — JWT required; demo-token accepted as rate-limited guest
 *   claudeLimit   — Claude calls per hour (100 pro / 25 free / 5 demo)
 *   scanLimit     — 50 scans/day free users; 5/hour demo; unlimited pro
 *   requirePro    — 403 unless user has active Pro or trial
 *   resolvePro    — sets req.isPro without blocking
 *
 * Rate limits backed by Upstash Redis (persistent across deploys + instances).
 * Falls back to in-memory automatically when Upstash is not configured.
 */

const jwt = require('jsonwebtoken')
const db  = require('../db')
const { getSupabase, getUserById } = require('../supabase')
const { createLimiter } = require('./ratelimit')
const { JWT_SECRET } = require('./auth') // single hardened source of truth

// ── Rate limiters (Upstash-backed, in-memory fallback) ────────────────────────
const checkClaude = {
  pro:  createLimiter('claude:pro',  100, '1 h',  60 * 60 * 1000),
  free: createLimiter('claude:free', 25,  '1 h',  60 * 60 * 1000),
  demo: createLimiter('claude:demo', 5,   '1 h',  60 * 60 * 1000),
}

// DEV_SCAN_LIMIT: raises the free-tier daily cap for local/simulator testing.
// Strictly gated by NODE_ENV !== 'production' — Railway always sets NODE_ENV=production,
// so this bypass is unreachable in production regardless of env var presence.
const _devScanCap = process.env.NODE_ENV !== 'production' && Number(process.env.DEV_SCAN_LIMIT)
if (_devScanCap) {
  console.warn(`[claudeGate] DEV_SCAN_LIMIT active — free scan cap raised to ${_devScanCap}/day (non-production only)`)
}

const checkScan = {
  free: createLimiter('scan:free', _devScanCap || 3, '24 h', 24 * 60 * 60 * 1000),
  demo: createLimiter('scan:demo', 1, '1 h',   1 * 60 * 60 * 1000),
}

// ── 1. Token verification ──────────────────────────────────────────────────────
function verifyToken(req, res, next) {
  const header = req.headers.authorization
  const token  = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — token required' })
  }

  // Demo token: limited guest access, no real user in DB
  if (token === 'demo-token') {
    req.userId = 'demo'
    req.isDemo = true
    req.isPro  = false
    return next()
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    req.isDemo = false
    next()
  } catch (jwtErr) {
    console.error('[claudeGate] verifyToken rejected:', jwtErr.name, jwtErr.message)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ── 2. Claude call rate limit ──────────────────────────────────────────────────
// Pro: 100/hour · Free: 25/hour · Demo: 5/hour
async function claudeLimit(req, res, next) {
  const tier    = req.isPro ? 'pro' : req.isDemo ? 'demo' : 'free'
  const allowed = await checkClaude[tier](req.userId)
  if (!allowed) {
    // retryAfter=3600 signals "hourly limit" to the client so it shows a
    // "limit reached" message instead of a 30-second server-busy countdown.
    return res.status(429).json({ error: 'claude_rate_limited', retryAfter: 3600 })
  }
  next()
}

// ── 3. Scan-specific rate limit ────────────────────────────────────────────────
// Pro: unlimited · Free: 3/day · Demo: 1/hour
async function scanLimit(req, res, next) {
  if (req.isPro) return next()

  if (req.isDemo) {
    const allowed = await checkScan.demo(req.userId)
    if (!allowed) return res.status(429).json({ error: 'hourly_cap_reached', plan: 'demo' })
    return next()
  }

  const allowed = await checkScan.free(req.userId)
  if (!allowed) return res.status(429).json({ error: 'hourly_cap_reached', plan: 'free' })
  next()
}

// ── helper: resolve subscription tier ─────────────────────────────────────────
async function getSubscriptionTier(userId) {
  // Try Supabase first (production primary store)
  const sbUser = await getUserById(userId)
  if (sbUser) {
    return {
      tier:        sbUser.subscription_tier || 'free',
      trialExpires: sbUser.pro_trial_expires_at || null,
      isPro:
        sbUser.subscription_tier === 'premium' ||
        (sbUser.subscription_tier === 'trial' &&
          sbUser.pro_trial_expires_at &&
          new Date() < new Date(sbUser.pro_trial_expires_at)) ||
        sbUser.is_pro === true,
    }
  }
  // Fall back to SQLite (local dev)
  const row = db.prepare('SELECT subscription_tier, pro_trial_expires_at, is_pro FROM users WHERE id = ?').get(userId)
  const trialActive =
    row?.subscription_tier === 'trial' &&
    row.pro_trial_expires_at &&
    new Date() < new Date(row.pro_trial_expires_at)
  return {
    tier:        row?.subscription_tier || 'free',
    trialExpires: row?.pro_trial_expires_at || null,
    isPro:       row?.subscription_tier === 'premium' || trialActive || row?.is_pro === 1,
  }
}

// ── 4. Pro gate ────────────────────────────────────────────────────────────────
async function requirePro(req, res, next) {
  if (req.isDemo) {
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature', plan: 'premium' })
  }
  try {
    const { isPro } = await getSubscriptionTier(req.userId)
    if (isPro) {
      req.isPro = true
      return next()
    }
    return res.status(403).json({ error: 'Pro required — upgrade to access this feature', plan: 'premium' })
  } catch (err) {
    console.error('[claudeGate] requirePro error:', err.message)
    return res.status(500).json({ error: 'internal_error' })
  }
}

// ── 5. Resolve isPro without blocking ─────────────────────────────────────────
async function resolvePro(req, res, next) {
  if (req.isDemo) { req.isPro = false; return next() }
  try {
    const { isPro } = await getSubscriptionTier(req.userId)
    req.isPro = isPro
  } catch (err) {
    console.error('[claudeGate] resolvePro error (non-fatal, defaulting to free):', err.message)
    req.isPro = false
  }
  next()
}

module.exports = { verifyToken, claudeLimit, scanLimit, requirePro, resolvePro }
