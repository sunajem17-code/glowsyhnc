import test from 'node:test'
import assert from 'node:assert/strict'
import { cacheLandmarkResult, frontLandmarkError } from '../client/src/utils/scanLandmarkCache.js'

test('failed detection permits a fresh attempt for the same photo', async () => {
  const ref = { current: null }
  await cacheLandmarkResult(ref, 'front', Promise.resolve({ points: null }))
  assert.equal(ref.current, null)
  const result = { points: { nose: { x: .5, y: .5 } } }
  await cacheLandmarkResult(ref, 'front', Promise.resolve(result))
  assert.equal(await ref.current.promise, result)
})
test('a late failure cannot clear a newer photo mapping', async () => {
  const ref = { current: null }
  let finish
  const first = cacheLandmarkResult(ref, 'old', new Promise(resolve => { finish = resolve }))
  await cacheLandmarkResult(ref, 'new', Promise.resolve({ points: {} }))
  finish(null)
  await first
  assert.equal(ref.current.url, 'new')
})
test('rejected detector attempts are evicted', async () => {
  const ref = { current: null }
  await assert.rejects(cacheLandmarkResult(ref, 'front', Promise.reject(new Error('load failed'))))
  assert.equal(ref.current, null)
})
test('photo and engine failures have different recovery messages', () => {
  assert.match(frontLandmarkError({ error: new Error('No face detected') }).message, /Retake/)
  assert.match(frontLandmarkError({ error: new Error('WASM failed') }).message, /detector could not process/)
})
