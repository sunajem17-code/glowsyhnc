/**
 * scanQuality.js — v8 (AI-based validation)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIRST SCAN: Claude vision API validates the face photo server-side.
 * No local face detector. No MediaPipe. No WASM. No init_failed.
 *
 * THREE STATES (never conflated):
 *   VALIDATION_SUCCESS  — AI confirmed exactly 1 face, all issues non-critical.
 *                         → start facial analysis.
 *   VALIDATION_RESULT   — AI ran cleanly but found a problem (no face, multiple
 *                         faces, etc.). → show ScanQualityFail with the reason.
 *   VALIDATION_ERROR    — Network/server/AI system failure. NOT a photo problem.
 *                         → show a retryable technical error, never a photo-
 *                         quality rejection.
 *
 * PASS CRITERION:  valid === true  AND  faceCount === 1
 */

import { api } from './api.js'

// ─── Calibration state ────────────────────────────────────────────────────────
const CALIBRATION_KEY = 'asc_quality_calibrated'
export function markCalibrated() { try { localStorage.setItem(CALIBRATION_KEY, '1') } catch {} }
export function releaseValidationImage(url) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    try { URL.revokeObjectURL(url) } catch {}
  }
}

// ─── Result cache — second call in startAnalysis() is instant ─────────────────
let _cache = { url: null, result: null }

// ─── Resize + convert image to a base64 data URL ─────────────────────────────
// Downscales to MAX_SIDE on the longest edge before encoding.
// A 4288×2848 photo → ~800px wide → ~80KB instead of 2.5MB.
// The AI only needs to see the face clearly, not every pixel.
const MAX_SIDE = 900   // px — enough for AI face detection, small enough for server
const JPEG_Q  = 0.88  // quality

async function toBase64DataUrl(imageSource) {
  // Load into an Image element regardless of source type
  const imgEl = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))

    if (typeof imageSource === 'string') {
      img.src = imageSource
    } else if (imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource)
    } else {
      reject(new Error('Unsupported image source type: ' + typeof imageSource))
    }
  })

  // Scale down if needed
  let { naturalWidth: w, naturalHeight: h } = imgEl
  if (w > MAX_SIDE || h > MAX_SIDE) {
    const scale = MAX_SIDE / Math.max(w, h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d').drawImage(imgEl, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', JPEG_Q)
}

// ─── Map AI issue types → user-facing messages ────────────────────────────────
const ISSUE_MAP = {
  no_face:        { title: 'No face detected',              advice: 'Make sure your face is clearly visible and fills most of the frame.', severity: 'critical' },
  not_a_person:   { title: 'No face detected',              advice: 'Please use a photo of your face.', severity: 'critical' },
  multiple_faces: { title: 'Multiple faces detected',       advice: 'Make sure only you are in the frame.', severity: 'critical' },
  too_far:        { title: 'Move closer to the camera',     advice: 'Your face should fill at least half the frame.', severity: 'critical' },
  too_close:      { title: 'Move farther from the camera',  advice: 'Back up slightly — your face is too close.', severity: 'high' },
  face_cropped:   { title: 'Make sure your full face is visible', advice: 'Back up so your entire face fits in the frame.', severity: 'high' },
  too_dark:       { title: 'Too dark — improve your lighting', advice: 'Move somewhere brighter and face a light source.', severity: 'critical' },
  too_blurry:     { title: 'Photo is blurry',               advice: 'Hold the camera steady and ensure your face is in focus.', severity: 'critical' },
}

function mapIssue(aiIssue) {
  const mapped = ISSUE_MAP[aiIssue.type]
  if (mapped) return { code: aiIssue.type, ...mapped }
  return {
    code:     aiIssue.type || 'unknown',
    title:    aiIssue.message || 'Photo issue detected',
    advice:   'Please retake your photo.',
    severity: 'critical',
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function validateScanQuality(imageSource) {
  // Cache hit — startAnalysis() calls this a second time; return instantly
  if (_cache.url === imageSource && _cache.result !== null) {
    console.log('[ASCENDUS SCAN] Cache hit — returning previous validation result')
    return _cache.result
  }

  console.log('[ASCENDUS SCAN] 4. Starting AI face validation')

  // ── Convert image to base64 ──────────────────────────────────────────────────
  let imageB64
  try {
    imageB64 = await toBase64DataUrl(imageSource)

    // Safe metadata only — never log the actual image data
    const mimeMatch  = imageB64.match(/^data:(image\/\w+);base64,/)
    const mimeType   = mimeMatch ? mimeMatch[1] : 'unknown'
    const b64Size    = imageB64.length
    console.log('[ASCENDUS SCAN] image exists: true')
    console.log('[ASCENDUS SCAN] image MIME type:', mimeType)
    console.log('[ASCENDUS SCAN] image base64 size:', b64Size, 'chars (~', Math.round(b64Size * 0.75 / 1024), 'KB)')

    // Check image dimensions via a temporary Image element
    await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        console.log('[ASCENDUS SCAN] image dimensions:', img.naturalWidth, '×', img.naturalHeight)
        resolve()
      }
      img.onerror = () => {
        console.warn('[ASCENDUS SCAN] image dimensions: could not determine')
        resolve()
      }
      img.src = imageB64
    })
  } catch (convErr) {
    console.error('[ASCENDUS SCAN] image conversion failed:', convErr?.message)
    const result = {
      passed: false,
      issues: [{ code: 'image_load', title: 'Could not read photo — please try again', advice: 'The photo could not be processed. Try taking another photo.', severity: 'critical' }],
      state: 'ERROR',
    }
    _cache = { url: imageSource, result }
    return result
  }

  // ── Call the AI validation endpoint ──────────────────────────────────────────
  let aiResponse
  try {
    console.log('[ASCENDUS SCAN] 5. AI request sent')
    aiResponse = await api.ai.validateScan(imageB64)
    console.log('[ASCENDUS SCAN] 6. AI response received')
  } catch (networkErr) {
    // Network/server failure — VALIDATION_ERROR, not a photo quality problem
    console.error('[ASCENDUS SCAN] AI request failed (network/server):', networkErr?.message)
    const result = {
      passed: false,
      issues: [{ code: 'validation_error', title: 'Could not validate photo — please try again', advice: 'Check your connection and try again.', severity: 'critical' }],
      state: 'ERROR',
    }
    _cache = { url: imageSource, result }
    return result
  }

  // ── Parse the response ────────────────────────────────────────────────────────
  console.log('[ASCENDUS SCAN] 7. AI response parsed')
  console.log('[ASCENDUS SCAN] 8. Validation result — valid:', aiResponse.valid, '| faceCount:', aiResponse.faceCount, '| issues:', aiResponse.issues?.length ?? 0)

  // PASS: exactly 1 face, AI says valid
  if (aiResponse.valid === true && aiResponse.faceCount === 1) {
    console.log('[ASCENDUS SCAN] ✅ VALIDATION_SUCCESS — proceeding to facial analysis')
    const result = { passed: true, issues: [], state: 'SUCCESS' }
    _cache = { url: imageSource, result }
    return result
  }

  // FAIL: AI ran but found a problem (VALIDATION_RESULT — photo-quality rejection)
  const issues = Array.isArray(aiResponse.issues) && aiResponse.issues.length > 0
    ? aiResponse.issues.map(mapIssue)
    : [{
        code:     aiResponse.faceCount > 1 ? 'multiple_faces' : 'no_face',
        title:    aiResponse.faceCount > 1 ? 'Multiple faces detected' : 'No face detected',
        advice:   aiResponse.faceCount > 1 ? 'Make sure only you are in the frame.' : 'Make sure your face is clearly visible and fills most of the frame.',
        severity: 'critical',
      }]

  console.log('[ASCENDUS SCAN] ❌ VALIDATION_RESULT — photo issue:', issues[0]?.code)
  const result = { passed: false, issues, state: 'RESULT' }
  _cache = { url: imageSource, result }
  return result
}
