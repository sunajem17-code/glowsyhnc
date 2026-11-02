const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
function stub(name, exports) {
  const id = require.resolve(name)
  require.cache[id] = { id, filename: id, loaded: true, exports }
}
let queries = 0
stub('../db', { prepare() { queries++; return { all: () => [] } } })
stub('../middleware/claudeGate', {
  verifyToken(req, res, next) {
    if (!req.headers.authorization) return res.status(401).json({ error: 'unauthorized' })
    req.userId = 'test-user'
    next()
  },
  requirePro(req, res, next) {
    if (req.headers.authorization !== 'paid') return res.status(403).json({ plan: 'premium' })
    req.isPro = true
    next()
  },
})
stub('../middleware/ratelimit', { createLimiter: () => async () => true })
stub('../lib/coachScanContext', { ownedCoachScan() { throw new Error('unexpected scan read') } })
const router = require('../routes/community')
const app = express()
app.use(express.json(), router)
test('Community stays readable while every social write rejects unpaid requests before touching data', async () => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    for (const path of ['/post', '/post/example/like', '/post/example/comment', '/post/example/rate']) {
      queries = 0
      const unauthorized = await fetch(base + path, { method: 'POST' })
      assert.equal(unauthorized.status, 401)
      const unpaid = await fetch(base + path, { method: 'POST', headers: { authorization: 'free', 'content-type': 'application/json' }, body: JSON.stringify({ content: 'test', score: 7 }) })
      assert.equal(unpaid.status, 403, path)
      assert.equal((await unpaid.json()).plan, 'premium')
      assert.equal(queries, 0, `unpaid mutation reached database: ${path}`)
    }
    const feed = await fetch(base + '/feed', { headers: { authorization: 'free' } })
    assert.equal(feed.status, 200)
    assert.deepEqual(await feed.json(), { posts: [] })
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
