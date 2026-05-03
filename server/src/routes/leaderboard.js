const express = require('express')
const { v4: uuidv4 } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// Get this week's leaderboard (top 20 by improvement) — public
router.get('/', (req, res) => {
  try {
    const weekStart = getWeekStart()
    const rows = db.prepare(`
      SELECT username, initial_score, current_score, improvement
      FROM leaderboard
      WHERE week_start = ?
      ORDER BY improvement DESC
      LIMIT 20
    `).all(weekStart)
    res.json({ leaderboard: rows, weekStart })
  } catch (err) {
    console.error('[Leaderboard] GET error:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

// Submit/update score — requires auth; identity comes from JWT, not request body
router.post('/submit', authMiddleware, (req, res) => {
  try {
    const { score } = req.body
    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'score required' })
    }
    // Use the authenticated userId as the username — users cannot spoof other users
    const username = req.userId
    const weekStart = getWeekStart()
    const existing = db.prepare('SELECT * FROM leaderboard WHERE username = ? AND week_start = ?').get(username, weekStart)
    if (existing) {
      db.prepare('UPDATE leaderboard SET current_score = ?, updated_at = datetime("now") WHERE username = ? AND week_start = ?').run(score, username, weekStart)
    } else {
      db.prepare('INSERT INTO leaderboard (id, username, initial_score, current_score, week_start) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), username, score, score, weekStart)
    }
    res.json({ success: true })
  } catch (err) {
    console.error('[Leaderboard] POST error:', err.message)
    res.status(500).json({ error: 'internal_error' })
  }
})

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

module.exports = router
