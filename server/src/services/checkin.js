const { randomUUID } = require('node:crypto')
function checkinValues(body = {}) {
  const water = body.waterGlasses ?? 0
  const mood = body.moodScore ?? 0
  if (!Number.isInteger(water) || water < 0 || water > 100 || !Number.isInteger(mood) || mood < 0 || mood > 10 ||
      ['skincareAm', 'skincarePm', 'exercisesDone'].some(k => body[k] != null && typeof body[k] !== 'boolean')) throw new Error('invalid_checkin')
  return { water, mood, am: !!body.skincareAm, pm: !!body.skincarePm, exercises: !!body.exercisesDone }
}
function saveLocalCheckin(db, userId, values, now = new Date()) {
  // Match the existing UTC date policy, including month/year and DST boundaries.
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  return db.transaction(() => {
    db.prepare(`INSERT INTO daily_checkins (id, user_id, checkin_date, water_glasses, skincare_am, skincare_pm, exercises_done, mood_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, checkin_date) DO UPDATE SET water_glasses=excluded.water_glasses,
      skincare_am=excluded.skincare_am, skincare_pm=excluded.skincare_pm, exercises_done=excluded.exercises_done, mood_score=excluded.mood_score`)
      .run(randomUUID(), userId, today, values.water, +values.am, +values.pm, +values.exercises, values.mood)
    const previous = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId)
    if (!previous || !previous.last_checkin_date || previous.last_checkin_date < today) {
      const current = previous?.last_checkin_date === yesterday ? previous.current_streak + 1 : 1
      db.prepare(`INSERT INTO streaks (user_id, current_streak, longest_streak, last_checkin_date) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET current_streak=excluded.current_streak, longest_streak=excluded.longest_streak, last_checkin_date=excluded.last_checkin_date`)
        .run(userId, current, Math.max(previous?.longest_streak ?? 0, current), today)
    }
    return db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId)
  }).immediate()
}
module.exports = { checkinValues, saveLocalCheckin }
