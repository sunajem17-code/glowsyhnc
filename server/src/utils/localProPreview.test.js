const test = require('node:test')
const assert = require('node:assert/strict')
const { hasLocalProPreview } = require('./localProPreview')
const req = { userId: 'allowed-owner', socket: { remoteAddress: '127.0.0.1' } }
const env = { NODE_ENV: 'development', LOCAL_PRO_PREVIEW_USER_IDS: 'allowed-owner' }

test('local Pro preview requires explicit server configuration and an authenticated owner', () => {
  assert.equal(hasLocalProPreview(req, env), true)
  assert.equal(hasLocalProPreview(req, { NODE_ENV: 'development' }), false)
  assert.equal(hasLocalProPreview({ ...req, userId: undefined }, env), false)
  assert.equal(hasLocalProPreview({ ...req, isDemo: true }, env), false)
})
test('local preview cannot grant production or remote access', () => {
  assert.equal(hasLocalProPreview(req, { ...env, NODE_ENV: 'production' }), false)
  assert.equal(hasLocalProPreview(req, { ...env, NODE_ENV: 'test' }), false)
  assert.equal(hasLocalProPreview({ ...req, socket: { remoteAddress: '192.168.1.2' } }, env), false)
})
test('another user and client-supplied premium claims cannot grant preview access', () => {
  assert.equal(hasLocalProPreview({ ...req, userId: 'someone-else', body: { isPro: true, isPremium: true } }, env), false)
  assert.equal(hasLocalProPreview({ ...req, body: { LOCAL_PRO_PREVIEW_USER_IDS: 'allowed-owner' } }, { NODE_ENV: 'development' }), false)
})
