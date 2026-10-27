'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { decodeImageBase64, validateImageBuffer } = require('./validatedImage')

test('base64 image validation accepts matching JPEG, PNG, and WebP signatures', () => {
  const cases = [
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])],
    ['image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ['image/webp', Buffer.from('RIFF0000WEBP')],
  ]
  for (const [type, bytes] of cases) assert.deepEqual(decodeImageBase64(bytes.toString('base64'), type), bytes)
})

test('base64 image validation rejects spoofed types, malformed input, and empty files', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff]).toString('base64')
  assert.equal(decodeImageBase64(jpeg, 'image/png'), null)
  assert.equal(decodeImageBase64('<svg/>', 'image/jpeg'), null)
  assert.equal(decodeImageBase64('', 'image/jpeg'), null)
})

test('disk-upload validation checks actual bytes against the declared MIME type', () => {
  assert.ok(validateImageBuffer(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'))
  assert.equal(validateImageBuffer(Buffer.from('not an image'), 'image/jpeg'), null)
  assert.equal(validateImageBuffer(Buffer.alloc(0), 'image/png'), null)
})
