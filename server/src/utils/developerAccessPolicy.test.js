const test = require('node:test')
const assert = require('node:assert/strict')
const { canUnlock } = require('./developerAccessPolicy')
test('disabled by default and kill switch overrides allow all', () => {
  assert.equal(canUnlock('test', {}), false)
  assert.equal(canUnlock('test', { DEV_UNLOCK_ALLOW_ALL: 'true' }), false)
})
test('explicit all-test-users switch still requires an authenticated identity', () => {
  const env = { DEV_UNLOCK_ENABLED: 'true', DEV_UNLOCK_ALLOW_ALL: 'true', NODE_ENV: 'production' }
  assert.equal(canUnlock('test', env), true)
  assert.equal(canUnlock(null, env), false)
})
test('without allow all only listed users can unlock', () => {
  const env = { DEV_UNLOCK_ENABLED: 'true', DEV_UNLOCK_USER_IDS: 'allowed' }
  assert.equal(canUnlock('allowed', env), true)
  assert.equal(canUnlock('other', env), false)
})
