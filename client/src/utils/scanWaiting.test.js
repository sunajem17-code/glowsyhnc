import test from 'node:test'
import assert from 'node:assert/strict'
import { waitingFrame } from './scanWaiting.js'

test('waiting repeats without pretending results are ready', () => {
  assert.equal(waitingFrame(0, null).index, 0)
  assert.equal(waitingFrame(2600, null).index, 1)
  assert.equal(waitingFrame(7800, null).index, 0)
  assert.equal(waitingFrame(120000, null).done, false)
})
test('only ready results trigger the final message, held before revealing', () => {
  assert.deepEqual(waitingFrame(10000, 10000), { index: 3, done: false })
  assert.deepEqual(waitingFrame(12199, 10000), { index: 3, done: false })
  assert.deepEqual(waitingFrame(12200, 10000), { index: 3, done: true })
})
