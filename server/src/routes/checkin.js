const express = require('express')
const { v4: uuid } = require('uuid')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.post('/', authMiddleware, (req, res) => {
  const { waterGlasses, skincareAm, skincarePm, exercisesDone, moodScore } = req.body
  const today = new Date().toISOString().split('T')[0]

  try {
    const id = uuid()
    db.prepare(`INSERT OR REPLACE INTO daily_checkins
      (id, user_id, checkin_date, water_glasses, skincare_am, skincare_pm, exercises_done, mood_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, req.userId, today, waterGlasses ?? 0, skincareAm ? 1 : 0, skincarePm ? 1 : 0, exercisesDone ? 1 : 0, moodScore ?? 0)

    // Update streak
    const streakRow = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(req.userId)
    if (streakRow) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().split('T')[0]
      const isConsecutive = streakRow.last_checkin_date === yStr
      const newCurrent = isConsecutive ? streakRow.current_streak + 1 : 1
      const newLongest = Math.max(streakRow.longest_streak, newCurrent)
      db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_checkin_date = ? WHERE user_id = ?')
        .run(newCurrent, newLongest, today, req.userId)
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/history', authMiddleware, (req, res) => {
  const checkins = db.prepare('SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 30').all(req.userId)
  res.json({ checkins })
})

module.exports = router
