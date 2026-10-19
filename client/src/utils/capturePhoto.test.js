import test from 'node:test'
import assert from 'node:assert/strict'
import { preserveCapture } from './capturePhoto.js'

test('capture remains readable after its object URL is revoked', async () => {
  const bytes = new Uint8Array([255, 216, 255, 0, 128, 216, 217])
  const blob = new Blob([bytes], { type: 'image/jpeg' })
  const url = URL.createObjectURL(blob)
  const saved = await preserveCapture(url, blob)
  URL.revokeObjectURL(url)
  assert.deepEqual(new Uint8Array(await (await fetch(saved)).arrayBuffer()), bytes)
  assert.equal(await preserveCapture(saved), saved)
})

test('provided capture bytes recover an already expired object URL', async () => {
  const blob = new Blob(['photo'], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  URL.revokeObjectURL(url)
  assert.equal(await preserveCapture(url, blob), 'data:image/png;base64,cGhvdG8=')
  await assert.rejects(preserveCapture(url))
})

test('large captures retain their bytes and empty captures fail', async () => {
  const bytes = new Uint8Array(100000).fill(201)
  const saved = await preserveCapture(new Blob([bytes], { type: 'image/jpeg' }))
  assert.deepEqual(new Uint8Array(await (await fetch(saved)).arrayBuffer()), bytes)
  await assert.rejects(preserveCapture(new Blob([])), /empty/)
})
