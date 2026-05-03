/**
 * ratelimit.js
 * Central rate-limiting module backed by Upstash Redis.
 *
 * Falls back to in-memory automatically when UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are not set — so local dev needs no Redis.
 *
 * Usage:
 *   const { createLimiter } = require('./ratelimit')
 *   const checkAuth = createLimiter('auth', 10, '15 m', 15 * 60 * 1000)
 *   const allowed   = await checkAuth(identifier)   // true = pass, false = block
 */

const { Ratelimit } = require('@upstash/ratelimit')
const { Redis }     = require('@upstash/redis')

// ── Redis client (singleton, lazy) ────────────────────────────────────────────
let _redis   = null
let _checked = false

function getRedis() {
  if (_checked) return _redis
  _checked = true

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    try {
      _redis = new Redis({ url, token })
      console.log('✅ Upstash Redis connected — rate limits are persistent')
    } catch (e) {
      console.warn('⚠️  Upstash Redis init failed — falling back to in-memory rate limits:', e.message)
    }
  } else {
    console.log('ℹ️  Upstash not configured — using in-memory rate limits (add UPSTASH_REDIS_REST_URL + TOKEN to Railway)')
  }

  return _redis
}

// ── In-memory fallback ────────────────────────────────────────────────────────
const _mem = new Map()

function memCheck(key, max, windowMs) {
  const now = Date.now()
  let e = _mem.get(key)
  if (!e || now - e.windowStart > windowMs) e = { count: 0, windowStart: now }
  if (e.count >= max) { _mem.set(key, e); return false }
  e.count++
  _mem.set(key, e)
  return true
}

// Prune stale entries every 30 min
setInterval(() => {
  const cut = Date.now() - 2 * 60 * 60 * 1000
  for (const [k, e] of _mem) if (e.windowStart < cut) _mem.delete(k)
}, 30 * 60 * 1000)

// ── Limiter factory ───────────────────────────────────────────────────────────
/**
 * createLimiter(name, max, upstashWindow, fallbackWindowMs)
 *
 * @param {string} name            — unique prefix used as Redis key namespace
 * @param {number} max             — max requests per window
 * @param {string} upstashWindow   — e.g. '1 h', '24 h', '15 m'
 * @param {number} fallbackWindowMs — in-memory window in milliseconds
 * @returns {(identifier: string) => Promise<boolean>}
 */
function createLimiter(name, max, upstashWindow, fallbackWindowMs) {
  let _rl = null

  function getRL() {
    if (_rl) return _rl
    const r = getRedis()
    if (!r) return null
    _rl = new Ratelimit({
      redis:   r,
      limiter: Ratelimit.slidingWindow(max, upstashWindow),
      prefix:  `rl:${name}`,
    })
    return _rl
  }

  return async function check(identifier) {
    const rl = getRL()
    if (rl) {
      try {
        const { success } = await rl.limit(String(identifier))
        return success
      } catch (e) {
        console.warn(`[ratelimit] Redis error for ${name} — falling back to in-memory:`, e.message)
        // On Redis error, fall through to in-memory so we don't break requests
      }
    }
    return memCheck(`${name}:${identifier}`, max, fallbackWindowMs)
  }
}

module.exports = { createLimiter }
