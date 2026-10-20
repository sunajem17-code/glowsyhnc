const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')
const { getSupabase } = require('../supabase')
const { createLimiter } = require('../middleware/ratelimit')
const { checkinValues, saveLocalCheckin } = require('../services/checkin')
const router = express.Router()
const limit = createLimiter('checkin', 120, '1 h', 3600000)
async function checkinLimit(req, res, next) {
  if (!await limit(req.userId)) return res.status(429).json({ error: 'rate_limited' })
  next()
}
router.post('/', authMiddleware, checkinLimit, async (req, res) => {
  let values
  try { values = checkinValues(req.body) }
  catch { return res.status(400).json({ error: 'invalid_checkin' }) }
  try {
    const sb = getSupabase()
    let streak
    if (sb) {
      const { data, error } = await sb.rpc('record_daily_checkin', {
        p_user_id: req.userId, p_water: values.water, p_mood: values.mood,
        p_am: values.am, p_pm: values.pm, p_exercises: values.exercises,
      })
      if (error) throw error
      streak = data
    } else streak = saveLocalCheckin(db, req.userId, values)
    res.json({ success: true, streak })
  } catch { res.status(503).json({ error: 'checkin_unavailable' }) }
})
router.get('/history', authMiddleware, checkinLimit, async (req, res) => {
  try {
    const sb = getSupabase()
    if (sb) {
      const { data, error } = await sb.from('daily_checkins').select('*').eq('user_id', req.userId).order('checkin_date', { ascending: false }).limit(30)
      if (error) throw error
      return res.json({ checkins: data })
    }
    const checkins = db.prepare('SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 30').all(req.userId)
    res.json({ checkins })
  } catch { res.status(503).json({ error: 'checkin_unavailable' }) }
})
module.exports = router
