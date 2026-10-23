import test from 'node:test'
import assert from 'node:assert/strict'
import { apiErrorMessage } from './apiError.js'

test('assessment diagnostic reasons are displayed instead of the generic gateway message', () => {
  assert.equal(apiErrorMessage({ error: 'Assessment failed', diagnosticReason: 'Missing score range' }), 'Scan assessment failed: Missing score range')
})

test('ordinary gateway errors remain generic', () => {
  assert.equal(apiErrorMessage({}), null)
})
