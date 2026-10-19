import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocalScanOrigin, validateWithLocalFaceMesh } from './localScanValidation.js'

test('local scan validation is restricted to loopback origins', () => {
  assert.equal(isLocalScanOrigin('localhost'), true)
  assert.equal(isLocalScanOrigin('127.0.0.1'), true)
  assert.equal(isLocalScanOrigin('::1'), true)
  assert.equal(isLocalScanOrigin('ascendus.store'), false)
})

test('exactly one locally detected face passes without using a remote checker', async () => {
  const result = await validateWithLocalFaceMesh('blob:scan-photo', async () => 1)
  assert.equal(result.passed, true)
  assert.equal(result.state, 'SUCCESS')
})

test('no detected face is reported as a photo issue, not a connection failure', async () => {
  const result = await validateWithLocalFaceMesh('blob:scan-photo', async () => 0)
  assert.equal(result.passed, false)
  assert.equal(result.state, 'RESULT')
  assert.equal(result.issues[0].code, 'no_face')
})

test('multiple detected faces are rejected locally', async () => {
  const result = await validateWithLocalFaceMesh('blob:scan-photo', async () => 2)
  assert.equal(result.passed, false)
  assert.equal(result.state, 'RESULT')
  assert.equal(result.issues[0].code, 'multiple_faces')
})

test('local detector failures stay technical errors instead of rejecting the photo', async () => {
  const result = await validateWithLocalFaceMesh('blob:scan-photo', async () => { throw new Error('WASM model failed to load') })
  assert.equal(result.passed, false)
  assert.equal(result.state, 'ERROR')
  assert.notEqual(result.issues[0].code, 'no_face')
})
