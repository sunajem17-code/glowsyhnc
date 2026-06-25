const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '../../data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(path.join(DATA_DIR, 'glowsync.db'))

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = OFF')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free',
    coach_messages_used INTEGER DEFAULT 0,
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

// Community tables
db.exec(`
  CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    display_name TEXT DEFAULT 'Anonymous',
    score_before REAL,
    score_after REAL,
    photo_url TEXT,
    before_photo_url TEXT,
    caption TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS community_likes (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS community_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT DEFAULT 'Anonymous',
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

// Community ratings table for "Rate Me" posts
db.exec(`
  CREATE TABLE IF NOT EXISTS community_ratings (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS community_reports (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'inappropriate',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, reporter_id)
  );
`)

// Referral fraud prevention tables
db.exec(`
  -- One row per credited referral; device_id PRIMARY KEY atomically prevents
  -- the same device from being counted as a referral more than once, ever.
  CREATE TABLE IF NOT EXISTS referral_device_log (
    device_id   TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    new_user_id TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Audit trail for every blocked or held referral attempt.
  CREATE TABLE IF NOT EXISTS referral_fraud_log (
    id          TEXT PRIMARY KEY,
    event_type  TEXT NOT NULL,
    ref_code    TEXT,
    device_id   TEXT,
    new_user_id TEXT,
    reason      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`)

// Idempotent migrations — ignore if columns already exist
const migrations = [
  // referral_fraud_log additions for velocity_hold re-check flow
  "ALTER TABLE referral_fraud_log ADD COLUMN referrer_id TEXT",
  "ALTER TABLE referral_fraud_log ADD COLUMN re_check_after TEXT",
  "ALTER TABLE referral_fraud_log ADD COLUMN resolved_at TEXT",
  "ALTER TABLE referral_fraud_log ADD COLUMN resolution TEXT",
  "ALTER TABLE users ADD COLUMN referral_code TEXT",
  "ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN pro_trial_expires_at TEXT",
  "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
  "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
  "ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN coach_messages_used INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN apple_sub TEXT",
  "ALTER TABLE community_posts ADD COLUMN before_photo_url TEXT",
  "ALTER TABLE community_posts ADD COLUMN post_type TEXT DEFAULT 'glow-up'",
  // promo redemption tracking
  "ALTER TABLE users ADD COLUMN promo_redeemed INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN promo_expires_at TEXT",
  // COPPA 13+ age gate
  "ALTER TABLE users ADD COLUMN age_confirmed INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN age_confirmed_at TEXT",
]
for (const sql of migrations) {
  try { db.exec(sql) } catch { /* column already exists */ }
}

// Synthetic "demo" user — lets the demo-token session (used by the "Try Demo"
// login) satisfy community_posts' FOREIGN KEY (user_id) REFERENCES users(id)
// constraint, so demo sessions can actually post/like/comment/rate instead of
// failing with a FK violation. All demo sessions share this single identity,
// matching how Claude-feature rate limiting already buckets demo under one key.
db.prepare(`
  INSERT OR IGNORE INTO users (id, email, name, password_hash, subscription_tier)
  VALUES ('demo', 'demo@ascendus.internal', 'Demo User', '', 'free')
`).run()

module.exports = db
