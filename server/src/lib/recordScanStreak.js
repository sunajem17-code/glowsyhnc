const { v4: uuid } = require('uuid')
const db = require('../db')

const recordScanStreak = db.transaction((userId, scanType = 'face') => {
  if (!userId || userId === 'demo') return null
  const type = scanType === 'physique' ? 'physique' : 'face'

  const { today, yesterday } = db.prepare("SELECT date('now') AS today, date('now', '-1 day') AS yesterday").get()
  db.prepare('INSERT OR IGNORE INTO streaks (user_id) VALUES (?)').run(userId)

  // Keep the existing activity calendar populated, but only after the server
  // has successfully scored a scan. The request body never supplies streak data.
  db.prepare(`INSERT OR IGNORE INTO daily_checkins
    (id, user_id, checkin_date, water_glasses, skincare_am, skincare_pm, exercises_done, mood_score)
    VALUES (?, ?, ?, 0, 0, 0, 0, 0)`).run(uuid(), userId, today)

  const streak = db.prepare('SELECT * FROM streaks WHERE user_id = ?').get(userId)
  if (streak.last_checkin_date !== today) {
    const current = streak.last_checkin_date === yesterday ? streak.current_streak + 1 : 1
    const longest = Math.max(streak.longest_streak, current)
    db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_checkin_date = ? WHERE user_id = ?')
      .run(current, longest, today, userId)
    streak.current_streak = current
    streak.longest_streak = longest
    streak.last_checkin_date = today
  }

  const typeCurrentKey = `${type}_current_streak`
  const typeLongestKey = `${type}_longest_streak`
  const typeDateKey = `${type}_last_scan_date`
  if (streak[typeDateKey] !== today) {
    const typeCurrent = streak[typeDateKey] === yesterday ? streak[typeCurrentKey] + 1 : 1
    const typeLongest = Math.max(streak[typeLongestKey], typeCurrent)
    db.prepare(`UPDATE streaks SET ${typeCurrentKey} = ?, ${typeLongestKey} = ?, ${typeDateKey} = ? WHERE user_id = ?`)
      .run(typeCurrent, typeLongest, today, userId)
    streak[typeCurrentKey] = typeCurrent
    streak[typeLongestKey] = typeLongest
    streak[typeDateKey] = today
  }

  return {
    current: streak.current_streak,
    longest: streak.longest_streak,
    lastDate: today,
    face: {
      current: streak.face_current_streak,
      longest: streak.face_longest_streak,
      lastDate: streak.face_last_scan_date,
    },
    physique: {
      current: streak.physique_current_streak,
      longest: streak.physique_longest_streak,
      lastDate: streak.physique_last_scan_date,
    },
  }
})

module.exports = function recordSuccessfulScanStreak(userId, scanType = 'face') {
  try {
    return recordScanStreak(userId, scanType)
  } catch (error) {
    console.warn('[streak] Could not record successful scan:', error.message)
    return null
  }
}
