const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '../../data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'glowsync.db'))

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scan_date TEXT DEFAULT (datetime('now')),
    face_photo_url TEXT,
    body_photo_url TEXT,
    glow_score INTEGER,
    face_total_score REAL,
    body_total_score REAL,
    presentation_score REAL,
    face_data TEXT,
    body_data TEXT,
    insights TEXT,
    analyzed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS action_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scan_id TEXT,
    week_number INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    duration_min INTEGER DEFAULT 5,
    difficulty INTEGER DEFAULT 1,
    sets INTEGER,
    reps TEXT,
    rest TEXT,
    frequency TEXT DEFAULT 'daily',
    week_number INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (plan_id) REFERENCES action_plans(id)
  );

  CREATE TABLE IF NOT EXISTS task_completions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    completion_date TEXT DEFAULT (date('now')),
    completed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(task_id, user_id, completion_date)
  );

  CREATE TABLE IF NOT EXISTS daily_checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    checkin_date TEXT DEFAULT (date('now')),
    posture_angle REAL,
    skincare_am INTEGER DEFAULT 0,
    skincare_pm INTEGER DEFAULT 0,
    water_glasses INTEGER DEFAULT 0,
    exercises_done INTEGER DEFAULT 0,
    mood_score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, checkin_date)
  );

  CREATE TABLE IF NOT EXISTS streaks (
    user_id TEXT PRIMARY KEY,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_checkin_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    initial_score REAL NOT NULL,
    current_score REAL NOT NULL,
    improvement REAL GENERATED ALWAYS AS (current_score - initial_score) STORED,
    week_start TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

// Idempotent migrations — ignore if columns already exist
const migrations = [
  "ALTER TABLE users ADD COLUMN referral_code TEXT",
  "ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN pro_trial_expires_at TEXT",
  "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
]
for (const sql of migrations) {
  try { db.exec(sql) } catch { /* column already exists */ }
}

module.exports = db
