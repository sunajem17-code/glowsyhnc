const test = require('node:test')
const assert = require('node:assert/strict')
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`CREATE TABLE leaderboard (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  initial_score REAL NOT NULL,
  current_score REAL NOT NULL,
  improvement REAL GENERATED ALWAYS AS (current_score - initial_score) STORED,
  week_start TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`)

const dbModule = require.resolve('../db')
require.cache[dbModule] = {
  id: dbModule,
  filename: dbModule,
  loaded: true,
  exports: db,
}

const { updateLeaderboard } = require('./leaderboard')

test('leaderboard refresh updates the score and timestamp', () => {
  updateLeaderboard('test-user', 6.4)
  const first = db.prepare('SELECT current_score, updated_at FROM leaderboard WHERE username = ?').get('test-user')
  assert.equal(first.current_score, 6.4)
  assert.ok(first.updated_at)

  updateLeaderboard('test-user', 7.2)
  const second = db.prepare('SELECT current_score, updated_at FROM leaderboard WHERE username = ?').get('test-user')
  assert.equal(second.current_score, 7.2)
  assert.ok(second.updated_at)
})
