import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeveloperUnlockAvailable } from './developerUnlockPreview.js'

test('developer unlock is available only in a development build', () => {
  assert.equal(isDeveloperUnlockAvailable(true), true)
  assert.equal(isDeveloperUnlockAvailable(false), false)
  assert.equal(isDeveloperUnlockAvailable(undefined), false)
})
