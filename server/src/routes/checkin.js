const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/history', authMiddleware, (req, res) => {
  const checkins = db.prepare('SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 30').all(req.userId)
  res.json({ checkins })
})

module.exports = router
