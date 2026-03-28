const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/timeline', authMiddleware, (req, res) => {
  const scans = db.prepare(`SELECT id, scan_date, glow_score, face_total_score, body_total_score,
    presentation_score, face_data, body_data FROM scans WHERE user_id = ? ORDER BY scan_date ASC`).all(req.userId)

  const timeline = scans.map(s => ({
    id: s.id,
    date: s.scan_date,
    glowScore: s.glow_score,
    faceTotalScore: s.face_total_score,
    bodyTotalScore: s.body_total_score,
    presentationScore: s.presentation_score,
    posture: s.body_data ? JSON.parse(s.body_data).posture : null,
    skinClarity: s.face_data ? JSON.parse(s.face_data).skinClarity : null,
  }))

  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)

  res.json({ timeline, streak })
})

router.get('/compare', authMiddleware, (req, res) => {
  const { id1, id2 } = req.query
  const scans = db.prepare(`SELECT * FROM scans WHERE id IN (?, ?) AND user_id = ?`).all(id1, id2, req.userId)
  if (scans.length !== 2) return res.status(404).json({ error: 'Scans not found' })

  const [s1, s2] = scans.sort((a, b) => new Date(a.scan_date) - new Date(b.scan_date))
  res.json({
    before: { ...s1, faceData: JSON.parse(s1.face_data || '{}'), bodyData: JSON.parse(s1.body_data || '{}') },
    after: { ...s2, faceData: JSON.parse(s2.face_data || '{}'), bodyData: JSON.parse(s2.body_data || '{}') },
    delta: {
      glowScore: s2.glow_score - s1.glow_score,
      face: s2.face_total_score - s1.face_total_score,
      body: s2.body_total_score - s1.body_total_score,
    },
  })
})

module.exports = router
