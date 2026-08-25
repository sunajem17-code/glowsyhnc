const express = require('express')
const { v4: uuidv4 } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// Get this week's leaderboard (top 20 by improvement) — requires auth
router.get('/', authMiddleware, (req, res) => {
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
// SECURITY: client-submit endpoint removed.
// Scores are written server-side only via updateLeaderboard() called from
// aiScore.js after Claude returns a verified result. Never accept a score from the client.

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}

// Called by aiScore.js after a verified Claude result — never from a client request
function updateLeaderboard(userId, glowScore) {
  try {
    if (typeof glowScore !== 'number' || glowScore < 0 || glowScore > 10) return
    const clamped = Math.min(10, Math.max(0, Math.round(glowScore * 10) / 10))
    const weekStart = getWeekStart()
    const existing = db.prepare('SELECT * FROM leaderboard WHERE username = ? AND week_start = ?').get(userId, weekStart)
    if (existing) {
      db.prepare('UPDATE leaderboard SET current_score = ?, updated_at = datetime("now") WHERE username = ? AND week_start = ?')
        .run(clamped, userId, weekStart)
    } else {
      db.prepare('INSERT INTO leaderboard (id, username, initial_score, current_score, week_start) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), userId, clamped, clamped, weekStart)
    }
  } catch (err) {
    console.error('[Leaderboard] updateLeaderboard error:', err.message)
  }
}

module.exports = { router, updateLeaderboard }
