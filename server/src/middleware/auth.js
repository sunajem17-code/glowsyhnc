const jwt = require('jsonwebtoken')

// JWT_SECRET signs every auth token. The old hardcoded fallback
// ('glowsync-dev-secret') is committed to git — if it were ever used in
// production, anyone could forge a token for any user. Refuse to run with it
// outside local dev, and never allow a missing secret in production.
const IS_PROD = process.env.NODE_ENV === 'production'
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? null : 'glowsync-dev-secret')

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required in production — set it in Railway')
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    console.warn(`[auth] rejected ${req.method} ${req.originalUrl} — no Authorization header`)
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    req.userEmail = payload.email || null
    next()
  } catch (err) {
    // err.name distinguishes an actually-expired token (TokenExpiredError) from
    // a malformed/forged one (JsonWebTokenError) — logging it is the only way
    // to confirm which one a real rejection was instead of assuming.
    console.warn(`[auth] rejected ${req.method} ${req.originalUrl} — ${err.name}: ${err.message}`)
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function signToken(userId, email) {
  const payload = { userId }
  if (email) payload.email = email
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '90d' })
}

module.exports = { authMiddleware, signToken, JWT_SECRET }
