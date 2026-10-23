import test from 'node:test'
import assert from 'node:assert/strict'
import { scaleCoachHeaderSize } from './coachHeaderSizing.js'

test('Adonis header portrait and name sizes are reduced by exactly eight percent', () => {
  assert.equal(scaleCoachHeaderSize(1.19), 1.0948)
  assert.equal(scaleCoachHeaderSize(17), 15.64)
})
