const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { authMiddleware, signToken } = require('../middleware/auth')
const { createDeveloperAccessRouter } = require('./developerAccess')

test('developer unlock uses verified JWT identity and fails closed', async t => {
  let enabled = true, allowed = 'tester', limit = true, failWrite = false
  const records = new Map([['tester', { id: 'tester', subscription_tier: 'free' }], ['other', { id: 'other', subscription_tier: 'free' }]])
  const app = express()
  app.use(express.json())
  app.use(createDeveloperAccessRouter({ authMiddleware,
    env: () => ({ DEV_UNLOCK_ENABLED: String(enabled), DEV_UNLOCK_USER_IDS: allowed }),
    checkLimit: async () => limit,
    getUser: async id => records.get(id),
    grant: async id => { if (failWrite) throw new Error('storage unavailable'); records.set(id, { ...records.get(id), subscription_tier: 'premium', is_pro: true }) },
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  async function call(path, user, body) {
    return fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${signToken(user)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  }
  assert.equal((await call('/unlock', null, {})).status, 401)
  assert.equal((await call('/unlock', 'other', { userId: 'tester', isPremium: true })).status, 403)
  assert.equal(records.get('other').subscription_tier, 'free')
  enabled = false
  assert.equal((await call('/unlock', 'tester', {})).status, 403)
  enabled = true; allowed = ''
  assert.equal((await call('/unlock', 'tester', {})).status, 403)
  allowed = 'tester'; limit = false
  assert.equal((await call('/unlock', 'tester', {})).status, 429)
  limit = true; failWrite = true
  assert.equal((await call('/unlock', 'tester', {})).status, 503)
  assert.equal(records.get('tester').subscription_tier, 'free')
  failWrite = false
  assert.deepEqual(await (await call('/access', 'tester')).json(), { allowed: true })
  assert.deepEqual(await (await call('/unlock', 'tester', { userId: 'other' })).json(), { isPremium: true })
  assert.equal(records.get('tester').subscription_tier, 'premium')
  assert.equal(records.get('other').subscription_tier, 'free')
  assert.equal((await call('/unlock', 'tester', {})).status, 200)
})
