const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { createLimiter } = require('../middleware/ratelimit')

// 20 analysis submissions per user per hour
const checkAnalyzeLimit = createLimiter('scan_analyze', 20, '1 h', 60 * 60 * 1000)

async function analyzeLimiter(req, res, next) {
  const allowed = await checkAnalyzeLimit(req.userId)
  if (!allowed) return res.status(429).json({ error: 'Too many scans — please wait before submitting again.' })
  next()
}

// Clamp a numeric score to the valid 0.0–10.0 range
function clampScore(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return null
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10))
}

const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '../../../data/uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${uuid()}.${file.mimetype.split('/')[1]}`),
})

// Only accept JPEG, PNG, and WebP — reject everything else before it hits disk
const fileFilter = (req, file, cb) => {
  if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

router.post('/upload', authMiddleware, upload.fields([
  { name: 'facePhoto', maxCount: 1 },
  { name: 'bodyPhoto', maxCount: 1 },
]), (req, res) => {
  const scanId    = uuid()
  const facePhoto = req.files?.facePhoto?.[0]
  const bodyPhoto = req.files?.bodyPhoto?.[0]
  if (!facePhoto || !bodyPhoto) return res.status(400).json({ error: 'Both photos required' })

  const faceUrl = `/uploads/${facePhoto.filename}`
  const bodyUrl = `/uploads/${bodyPhoto.filename}`
  const now = new Date().toISOString()

  db.prepare(`INSERT INTO scans (id, user_id, face_photo_url, body_photo_url, scan_date)
    VALUES (?, ?, ?, ?, ?)`).run(scanId, req.userId, faceUrl, bodyUrl, now)

  res.json({ scanId, facePhotoUrl: faceUrl, bodyPhotoUrl: bodyUrl })
})

// SECURITY: /analyze no longer accepts scores from the client.
// Scores are written by persistScanResult() called from aiScore.js after Claude returns.
// This endpoint now only accepts non-score metadata (insights, faceData structure) as a
// fallback for clients on older builds — scores are ignored and must come server-side.
router.post('/analyze/:scanId', authMiddleware, analyzeLimiter, (req, res) => {
  const scan = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(req.params.scanId, req.userId)
  if (!scan) return res.status(404).json({ error: 'Scan not found' })
  // Scores intentionally not accepted from the client body — see persistScanResult()
  res.json({ success: true })
})

// Called by aiScore.js with Claude's verified output — never from a client request
function persistScanResult(scanId, userId, { glowScore, faceTotalScore, bodyTotalScore, presentationScore, faceData, bodyData, insights }) {
  const scan = db.prepare('SELECT id FROM scans WHERE id = ? AND user_id = ?').get(scanId, userId)
  if (!scan) return
  db.prepare(`UPDATE scans SET face_data = ?, body_data = ?, glow_score = ?, face_total_score = ?,
    body_total_score = ?, presentation_score = ?, insights = ?, analyzed_at = ? WHERE id = ?`)
    .run(
      JSON.stringify(faceData ?? null),
      JSON.stringify(bodyData ?? null),
      clampScore(glowScore),
      clampScore(faceTotalScore),
      clampScore(bodyTotalScore),
      clampScore(presentationScore),
      JSON.stringify(insights ?? []),
      new Date().toISOString(),
      scanId
    )
}

router.get('/history', authMiddleware, (req, res) => {
  const scans = db.prepare('SELECT * FROM scans WHERE user_id = ? ORDER BY scan_date DESC').all(req.userId)
  const parsed = scans.map(s => ({
    ...s,
    faceData: s.face_data  ? JSON.parse(s.face_data)  : null,
    bodyData: s.body_data  ? JSON.parse(s.body_data)  : null,
    insights: s.insights   ? JSON.parse(s.insights)   : [],
  }))
  res.json({ scans: parsed })
})

router.get('/:id', authMiddleware, (req, res) => {
  const scan = db.prepare('SELECT * FROM scans WHERE id = ? AND user_id = ?').get(req.params.id, req.userId)
  if (!scan) return res.status(404).json({ error: 'Scan not found' })
  res.json({
    ...scan,
    faceData: scan.face_data ? JSON.parse(scan.face_data) : null,
    bodyData: scan.body_data ? JSON.parse(scan.body_data) : null,
    insights: scan.insights  ? JSON.parse(scan.insights)  : [],
  })
})

// ── GET /api/scan/stats — public, no auth required ───────────────────────────
// Returns the real total scan count from the database. No auth needed — this
// is aggregate data, not user-specific. Cached 5 min to avoid hammering DB.
let _statsCache = null
let _statsCacheAt = 0
router.get('/stats', async (req, res) => {
  try {
    const now = Date.now()
    if (_statsCache && now - _statsCacheAt < 5 * 60 * 1000) {
      return res.json(_statsCache)
    }
    const { getSupabase } = require('../supabase')
    const sb = getSupabase()
    let totalScans = null
    if (sb) {
      const { count, error } = await sb.from('scans').select('*', { count: 'exact', head: true })
      if (!error) totalScans = count
    } else {
      const row = db.prepare('SELECT COUNT(*) as c FROM scans').get()
      totalScans = row?.c ?? null
    }
    _statsCache = { totalScans }
    _statsCacheAt = now
    res.json(_statsCache)
  } catch (err) {
    console.error('[scan/stats]', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

module.exports = { router, persistScanResult }
