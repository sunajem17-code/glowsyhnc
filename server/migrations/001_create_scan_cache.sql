-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001: scan_cache
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists scan_cache (
  id          uuid        primary key default gen_random_uuid(),
  image_hash  text        unique not null,   -- SHA256 hex of face+body base64 content
  result      jsonb       not null,          -- full AI scoring result object
  created_at  timestamptz not null default now()
);

-- Fast lookup by hash (primary query path)
create index if not exists scan_cache_hash_idx       on scan_cache (image_hash);

-- Fast TTL sweep (used by the optional cleanup cron below)
create index if not exists scan_cache_created_at_idx on scan_cache (created_at);

-- ── Optional: auto-purge rows older than 7 days via pg_cron ──────────────────
-- Requires the pg_cron extension (enabled in Supabase under Database → Extensions).
-- Uncomment and run separately after enabling the extension.
--
-- select cron.schedule(
--   'purge-stale-scan-cache',
--   '0 3 * * *',   -- 03:00 UTC daily
--   $$delete from scan_cache where created_at < now() - interval '7 days'$$
-- );
