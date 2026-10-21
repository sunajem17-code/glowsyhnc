import test from 'node:test'
import assert from 'node:assert/strict'
import { getRequestTimeoutMs } from './requestTimeout.js'

test('coach requests get the long timeout needed for generated replies', () => {
  assert.equal(getRequestTimeoutMs('/coach/message'), 130_000)
})

test('other AI requests keep the long timeout', () => {
  assert.equal(getRequestTimeoutMs('/ai/score'), 130_000)
})

test('ordinary API requests keep the standard timeout', () => {
  assert.equal(getRequestTimeoutMs('/user/profile'), 15_000)
})
