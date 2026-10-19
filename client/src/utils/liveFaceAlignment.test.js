import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldBlockPhotoCapture } from './liveFaceAlignment.js'

test('side-profile capture remains available at every detected angle', () => {
  assert.equal(shouldBlockPhotoCapture(2, true, false), false)
  assert.equal(shouldBlockPhotoCapture(2, true, true), false)
  assert.equal(shouldBlockPhotoCapture(2, false, false), false)
})

test('front-photo alignment guidance continues to gate capture', () => {
  assert.equal(shouldBlockPhotoCapture(1, true, false), true)
  assert.equal(shouldBlockPhotoCapture(1, true, true), false)
  assert.equal(shouldBlockPhotoCapture(1, false, false), false)
})
