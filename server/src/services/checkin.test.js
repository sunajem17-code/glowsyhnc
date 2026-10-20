const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const { checkinValues, saveLocalCheckin } = require('./checkin')
function database() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE daily_checkins (id TEXT PRIMARY KEY,user_id TEXT,checkin_date TEXT,water_glasses INTEGER,skincare_am INTEGER,skincare_pm INTEGER,exercises_done INTEGER,mood_score INTEGER,UNIQUE(user_id,checkin_date));
    CREATE TABLE streaks(user_id TEXT PRIMARY KEY,current_streak INTEGER,longest_streak INTEGER,last_checkin_date TEXT);`)
  return db
}
test('same-day edits preserve streak and row identity; consecutive days advance; gaps reset current only', () => {
  const db = database()
  try {
    const save = (day, water = 1, user = 'a') => saveLocalCheckin(db, user, checkinValues({ waterGlasses: water }), new Date(day))
    assert.equal(save('2026-12-30T23:59:00Z').current_streak, 1)
    assert.equal(save('2026-12-31T00:00:00Z').current_streak, 2)
    const id = db.prepare("SELECT id FROM daily_checkins WHERE checkin_date='2026-12-31'").get().id
    assert.equal(save('2026-12-31T23:59:00Z', 8).current_streak, 2)
    assert.deepEqual(db.prepare('SELECT id,water_glasses FROM daily_checkins WHERE id=?').get(id), { id, water_glasses: 8 })
    assert.equal(save('2027-01-01T00:00:00Z').current_streak, 3)
    assert.equal(save('2027-01-03T00:00:00Z').current_streak, 1)
    assert.equal(save('2027-01-03T10:00:00Z').longest_streak, 3)
    assert.equal(save('2027-01-03T10:00:00Z', 2, 'b').current_streak, 1)
    assert.equal(db.prepare('SELECT count(*) n FROM daily_checkins').get().n, 5)
  } finally { db.close() }
})
test('a failed streak write rolls the check-in back', () => {
  const db = database()
  try {
    db.exec("CREATE TRIGGER fail BEFORE INSERT ON streaks BEGIN SELECT RAISE(ABORT,'failed'); END;")
    assert.throws(() => saveLocalCheckin(db, 'a', checkinValues({})))
    assert.equal(db.prepare('SELECT count(*) n FROM daily_checkins').get().n, 0)
  } finally { db.close() }
})
test('rejects invalid inputs and uses UTC over DST transitions', () => {
  for (const body of [{waterGlasses:-1}, {moodScore:11}, {skincareAm:'false'}]) assert.throws(() => checkinValues(body))
  const db = database()
  try {
    saveLocalCheckin(db, 'a', checkinValues({}), new Date('2026-03-08T23:00:00Z'))
    assert.equal(saveLocalCheckin(db, 'a', checkinValues({}), new Date('2026-03-09T00:00:00Z')).current_streak, 2)
  } finally { db.close() }
})
