-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Add extended_metrics to scans
--
-- Stores the AI scorer's new 30-metric extended breakdown (5 categories ×
-- 6 metrics, each {score, descriptor} — see server/src/routes/aiScore.js's
-- extendedMetrics) as a single jsonb blob, same shape as the API response.
-- Only the 4 pillars (harmony/angularity/features/dimorphism) were persisted
-- before this — sub_scores and face_metrics still aren't, only extended_metrics
-- is being added here per this migration's scope.
-- Run against the Supabase project via:
--   Supabase Dashboard → SQL Editor → paste & Run
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE scans ADD COLUMN IF NOT EXISTS extended_metrics jsonb;
