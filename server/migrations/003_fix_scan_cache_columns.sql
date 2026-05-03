-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Fix scan_cache table — add missing columns & indexes
--
-- The table was created without the columns defined in 001_create_scan_cache.sql.
-- These are ADD COLUMN IF NOT EXISTS statements so they are safe to re-run.
-- Run against Supabase project wzjhbigkzbieptjxrmxp via:
--   Supabase Dashboard → SQL Editor → paste & Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Add missing columns (no-ops if they already exist)
ALTER TABLE scan_cache ADD COLUMN IF NOT EXISTS image_hash  text;
ALTER TABLE scan_cache ADD COLUMN IF NOT EXISTS result      jsonb;
ALTER TABLE scan_cache ADD COLUMN IF NOT EXISTS created_at  timestamptz NOT NULL DEFAULT now();

-- Unique constraint on image_hash (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scan_cache_image_hash_key'
  ) THEN
    ALTER TABLE scan_cache ADD CONSTRAINT scan_cache_image_hash_key UNIQUE (image_hash);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS scan_cache_hash_idx       ON scan_cache (image_hash);
CREATE INDEX IF NOT EXISTS scan_cache_created_at_idx ON scan_cache (created_at);
