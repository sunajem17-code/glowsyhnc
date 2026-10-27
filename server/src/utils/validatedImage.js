'use strict'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function validateImageBuffer(buffer, mediaType) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!Buffer.isBuffer(buffer) || !allowedTypes.has(mediaType) || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null

  const valid = mediaType === 'image/jpeg'
    ? buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : mediaType === 'image/png'
      ? buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'

  return valid ? buffer : null
}

function decodeImageBase64(value, mediaType) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4) return null
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null
  return validateImageBuffer(Buffer.from(value, 'base64'), mediaType)
}

module.exports = { MAX_IMAGE_BYTES, decodeImageBase64, validateImageBuffer }
