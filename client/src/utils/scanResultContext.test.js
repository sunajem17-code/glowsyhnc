import test from 'node:test'
import assert from 'node:assert/strict'
import { getProgressCardReturnTo } from './scanResultContext.js'

test('opening a saved Progress card remembers where its back button should return', () => {
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/timeline' }), '/timeline')
  assert.equal(getProgressCardReturnTo({ source: 'progress-card', returnTo: '/history' }), '/history')
  assert.equal(getProgressCardReturnTo(null), null)
})
