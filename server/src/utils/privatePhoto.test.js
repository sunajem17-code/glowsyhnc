const test = require('node:test')
const assert = require('node:assert/strict')
const { createPrivatePhotoUrl, verifyPrivatePhotoSignature } = require('./privatePhoto')

test('private photo URLs have a valid short-lived signature', () => {
  const now = 1_800_000_000_000
  const url = createPrivatePhotoUrl('/uploads/123e4567-e89b-12d3-a456-426614174000.jpeg', 'test-secret', 'owner-a', now)
  const parsed = new URL(url, 'https://example.test')
  const filename = decodeURIComponent(parsed.pathname.split('/').at(-1))
  assert.equal(verifyPrivatePhotoSignature(filename, parsed.searchParams.get('owner'), parsed.searchParams.get('expires'), parsed.searchParams.get('signature'), 'test-secret', now), true)
  assert.equal(verifyPrivatePhotoSignature(filename, 'owner-b', parsed.searchParams.get('expires'), parsed.searchParams.get('signature'), 'test-secret', now), false)
})

test('private photo URLs reject tampering, expiration, and unsafe names', () => {
  const now = 1_800_000_000_000
  const url = createPrivatePhotoUrl('/uploads/123e4567-e89b-12d3-a456-426614174000.jpeg', 'test-secret', 'owner-a', now)
  const parsed = new URL(url, 'https://example.test')
  const expires = parsed.searchParams.get('expires')
  const signature = parsed.searchParams.get('signature')
  const changedSignature = `${signature[0] === '0' ? '1' : '0'}${signature.slice(1)}`
  assert.equal(verifyPrivatePhotoSignature('123e4567-e89b-12d3-a456-426614174000.jpeg', 'owner-a', expires, changedSignature, 'test-secret', now), false)
  assert.equal(verifyPrivatePhotoSignature('123e4567-e89b-12d3-a456-426614174000.jpeg', 'owner-a', expires, signature, 'test-secret', now + 16 * 60 * 1000), false)
  assert.equal(verifyPrivatePhotoSignature('../secret.jpeg', 'owner-a', expires, signature, 'test-secret', now), false)
  assert.equal(createPrivatePhotoUrl('/uploads/subdir/123e4567-e89b-12d3-a456-426614174000.jpeg', 'test-secret', 'owner-a', now), '/uploads/subdir/123e4567-e89b-12d3-a456-426614174000.jpeg')
  assert.equal(createPrivatePhotoUrl('/uploads/../../secret.jpeg', 'test-secret', 'owner-a', now), '/uploads/../../secret.jpeg')
})
