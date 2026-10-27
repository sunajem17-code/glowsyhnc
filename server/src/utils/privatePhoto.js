const crypto = require('crypto')
const path = require('path')

const PHOTO_URL_TTL_MS = 15 * 60 * 1000

function photoFilename(photoPath) {
  if (typeof photoPath !== 'string' || !photoPath.startsWith('/uploads/')) return null
  const filename = path.posix.basename(photoPath)
  if (photoPath !== `/uploads/${filename}` || !/^[0-9a-f-]{36}\.(?:jpeg|png|webp)$/i.test(filename)) return null
  return filename
}

function signatureFor(filename, ownerId, expires, secret) {
  return crypto.createHmac('sha256', secret).update(`${filename}.${ownerId}.${expires}`).digest('hex')
}

function createPrivatePhotoUrl(photoPath, secret, ownerId, now = Date.now()) {
  const filename = photoFilename(photoPath)
  if (!filename) return photoPath
  if (!secret || typeof ownerId !== 'string' || ownerId.length < 1 || ownerId.length > 200) return null
  const expires = String(Math.floor((now + PHOTO_URL_TTL_MS) / 1000))
  const signature = signatureFor(filename, ownerId, expires, secret)
  return `/api/scan/photo/${encodeURIComponent(filename)}?owner=${encodeURIComponent(ownerId)}&expires=${expires}&signature=${signature}`
}

function verifyPrivatePhotoSignature(filename, ownerId, expires, signature, secret, now = Date.now()) {
  if (!/^[0-9a-f-]{36}\.(?:jpeg|png|webp)$/i.test(filename || '') || !secret) return false
  if (typeof ownerId !== 'string' || ownerId.length < 1 || ownerId.length > 200) return false
  if (!/^\d{10}$/.test(String(expires || '')) || !/^[a-f0-9]{64}$/i.test(signature || '')) return false
  const expiresMs = Number(expires) * 1000
  if (!Number.isSafeInteger(expiresMs) || expiresMs <= now || expiresMs > now + PHOTO_URL_TTL_MS + 1000) return false
  const expected = Buffer.from(signatureFor(filename, ownerId, String(expires), secret), 'hex')
  const supplied = Buffer.from(signature, 'hex')
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)
}

module.exports = { PHOTO_URL_TTL_MS, createPrivatePhotoUrl, verifyPrivatePhotoSignature }
