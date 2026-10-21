import test from 'node:test'
import assert from 'node:assert/strict'
import { getAlignment, shouldBlockPhotoCapture } from './liveFaceAlignment.js'

test('photo capture stays available at every angle and alignment state', () => {
  assert.equal(shouldBlockPhotoCapture(2, true, false), false)
  assert.equal(shouldBlockPhotoCapture(2, true, true), false)
  assert.equal(shouldBlockPhotoCapture(2, false, false), false)
  assert.equal(shouldBlockPhotoCapture(1, true, false), false)
  assert.equal(shouldBlockPhotoCapture(1, true, true), false)
  assert.equal(shouldBlockPhotoCapture(1, false, false), false)
})

test('multiple detected faces give non-blocking capture guidance', () => {
  assert.deepEqual(getAlignment({ status: 'multiple' }, false), {
    label: 'Multiple faces visible — you can still capture',
    aligned: false,
  })
})
