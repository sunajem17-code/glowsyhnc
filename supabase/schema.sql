-- ─────────────────────────────────────────────────────────────────────────────
-- Ascendus — Supabase Schema
-- Run this entire file in the Supabase SQL Editor (one paste, one click Run).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email                  TEXT UNIQUE NOT NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  gender                 TEXT CHECK (gender IN ('male', 'female')),
  height_cm              INTEGER,
  weight_kg              INTEGER,
  hair_type              TEXT,
  assigned_phase         TEXT CHECK (assigned_phase IN ('cut', 'bulk', 'recomp', 'maintenance')),
  is_pro                 BOOLEAN DEFAULT FALSE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT
);

-- ── 2. SCANS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id                           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  overall_score                DECIMAL(4,2),
  tier                         TEXT,
  face_score                   DECIMAL(4,2),
  body_score                   DECIMAL(4,2),
  body_category                TEXT,
  grooming_score               DECIMAL(4,2),
  harmony                      DECIMAL(4,2),
  angularity                   DECIMAL(4,2),
  features                     DECIMAL(4,2),
  dimorphism                   DECIMAL(4,2),
  potential_score              DECIMAL(4,2),
  celebrity_match_1            TEXT,
  celebrity_match_1_similarity INTEGER,
  celebrity_match_2            TEXT,
  celebrity_match_2_similarity INTEGER,
  celebrity_match_3            TEXT,
  celebrity_match_3_similarity INTEGER,
  face_image_url               TEXT,
  body_image_url               TEXT,
  body_fat_estimate            TEXT,
  shoulder_waist_ratio         DECIMAL(4,2),
  posture_grade                TEXT,
  hairstyle_recommendation_1   TEXT,
  hairstyle_recommendation_2   TEXT,
  hairstyle_recommendation_3   TEXT,
  hair_type_detected           TEXT,
  face_shape                   TEXT
);

-- ── 3. PLAN TASKS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_tasks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number  INTEGER,
  task_name    TEXT,
  category     TEXT,
  duration     TEXT,
  frequency    TEXT,
  pillar       TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. PROGRESS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_id       UUID REFERENCES scans(id) ON DELETE SET NULL,
  date          DATE DEFAULT CURRENT_DATE,
  overall_score DECIMAL(4,2),
  body_score    DECIMAL(4,2),
  face_score    DECIMAL(4,2)
);

-- ── 5. INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS scans_user_id_idx      ON scans(user_id);
CREATE INDEX IF NOT EXISTS scans_created_at_idx   ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS plan_tasks_user_id_idx ON plan_tasks(user_id);
CREATE INDEX IF NOT EXISTS progress_user_id_idx   ON progress(user_id);
CREATE INDEX IF NOT EXISTS progress_date_idx      ON progress(date DESC);

-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- Enable RLS on all tables (server-side service key bypasses these;
-- these policies protect any direct client-side connections).
ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress   ENABLE ROW LEVEL SECURITY;

-- Users can only access their own row
CREATE POLICY "users: own row only"
  ON users FOR ALL
  USING (id::text = auth.uid()::text);

-- Scans: user can only read/write their own scans
CREATE POLICY "scans: own rows only"
  ON scans FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE id::text = auth.uid()::text));

-- Plan tasks: user can only access their own tasks
CREATE POLICY "plan_tasks: own rows only"
  ON plan_tasks FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE id::text = auth.uid()::text));

-- Progress: user can only access their own progress
CREATE POLICY "progress: own rows only"
  ON progress FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE id::text = auth.uid()::text));

-- ── 7. STORAGE BUCKET ────────────────────────────────────────────────────────
-- Run this separately in the Supabase dashboard → Storage → New bucket
-- OR uncomment the lines below if your plan supports storage API:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('scan-images', 'scan-images', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "scan-images: authenticated uploads"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'scan-images' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "scan-images: public reads"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'scan-images');
