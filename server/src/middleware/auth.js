const jwt = require('jsonwebtoken')

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')
const JWT_SECRET = process.env.JWT_SECRET

function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.userId
    req.userEmail = payload.email || null
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

function signToken(userId, email) {
  const payload = { userId }
  if (email) payload.email = email
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

module.exports = { authMiddleware, signToken }
