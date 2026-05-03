-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: scan_history
-- Run this once in the Supabase SQL editor (Database → SQL Editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists scan_history (
  id              uuid         primary key default gen_random_uuid(),
  user_id         text         not null,
  overall_score   numeric(4,1) not null,
  face_score      numeric(4,1),
  body_score      numeric(4,1),
  grooming_score  numeric(4,1),
  tier            text,
  celebrity_match text,
  created_at      timestamptz  not null default now()
);

-- Fast lookup by user (primary query path)
create index if not exists scan_history_user_id_idx      on scan_history (user_id);

-- Fast latest-first ordering per user
create index if not exists scan_history_user_created_idx on scan_history (user_id, created_at desc);
