import test from 'node:test'
import assert from 'node:assert/strict'
import { validationFailure } from './validationFailure.js'

test('missing configuration and server failures never reject the photo or blame Wi-Fi', () => {
  for (const error of [{ status: 503, errorCode: 'validation_not_configured' }, { status: 502 }, { status: 500 }]) {
    const result = validationFailure(error)
    assert.equal(result.passed, false)
    assert.equal(result.state, 'ERROR')
    assert.equal(result.issues[0].code, 'validation_unavailable')
    assert.doesNotMatch(JSON.stringify(result), /connection|retake|no_face/i)
  }
})

test('expired sessions and rate limits have distinct recovery paths', () => {
  assert.equal(validationFailure({ status: 401 }).issues[0].code, 'validation_session_expired')
  assert.equal(validationFailure({ status: 429 }).issues[0].code, 'validation_rate_limited')
  assert.equal(validationFailure(new Error('Server unavailable')).issues[0].code, 'validation_unavailable')
  assert.equal(validationFailure(new Error('Request timed out. Please check your connection.')).issues[0].code, 'validation_unavailable')
})
