const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')
const { getLocalProgressHistory } = require('./localProgressHistory')

test('local history returns only completed scans owned by the authenticated user', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`CREATE TABLE scans (
      id TEXT, user_id TEXT, scan_date TEXT, analyzed_at TEXT, glow_score REAL,
      face_total_score REAL, face_photo_url TEXT, body_photo_url TEXT
    )`)
    const insert = db.prepare('INSERT INTO scans VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    insert.run('mine', 'user-a', '2026-10-18', '2026-10-18T12:00:00Z', 8.3, 8.4, '/uploads/mine.jpg', null)
    insert.run('private', 'user-b', '2026-10-18', '2026-10-18T13:00:00Z', 7, 7, '/uploads/other.jpg', null)
    insert.run('unfinished', 'user-a', '2026-10-18', null, null, null, null, null)
    const rows = getLocalProgressHistory(db, 'user-a')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 'mine')
    assert.equal(rows[0].overall_score, 8.3)
    assert.equal(rows[0].face_image_url, '/uploads/mine.jpg')
    assert.deepEqual(getLocalProgressHistory(db, 'no-scans'), [])
  } finally { db.close() }
})
