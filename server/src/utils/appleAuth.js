// ─────────────────────────────────────────────────────────────────────────────
// Apple Sign-In identity-token verification.
//
// The client sends an `identityToken` (a JWT issued by Apple). NEVER trust its
// claims by decoding alone — anyone can craft a JWT with an arbitrary `sub`/
// `email`. We MUST verify the RS256 signature against Apple's published public
// keys (JWKS) and validate the issuer + audience + expiry.
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

const APPLE_ISS = 'https://appleid.apple.com'

const ALLOWED_AUDIENCES = (process.env.APPLE_BUNDLE_IDS || 'com.ascendus.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const client = jwksClient({
  jwksUri: `${APPLE_ISS}/auth/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 min
  rateLimit: true,
  jwksRequestsPerMinute: 10,
})

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key.getPublicKey())
  })
}

/**
 * Verify an Apple identity token. Resolves with the verified payload
 * (containing a trustworthy `sub` and, if present, `email`) or rejects.
 */
function verifyAppleToken(identityToken) {
  return new Promise((resolve, reject) => {
    if (!identityToken || typeof identityToken !== 'string') {
      return reject(new Error('identityToken required'))
    }
    jwt.verify(
      identityToken,
      getSigningKey,
      {
        algorithms: ['RS256'],
        issuer: APPLE_ISS,
        audience: ALLOWED_AUDIENCES,
      },
      (err, payload) => {
        if (err) return reject(err)
        if (!payload?.sub) return reject(new Error('Apple token missing sub'))
        resolve(payload)
      }
    )
  })
}

module.exports = { verifyAppleToken }
