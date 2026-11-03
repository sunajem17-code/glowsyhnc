import test from 'node:test'
import assert from 'node:assert/strict'
import { isDeveloperUnlockAvailable, isLocalProPreviewAvailable } from './developerUnlockPreview.js'

test('development and production cannot grant Pro or reveal results through a testing override', () => {
  for (const mode of [true, false, undefined]) {
    assert.equal(isDeveloperUnlockAvailable(mode), false)
    assert.equal(isLocalProPreviewAvailable(mode), false)
  }
})
