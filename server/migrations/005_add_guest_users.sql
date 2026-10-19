-- Add is_guest flag to users table.
-- Guest users are created silently at onboarding start so the AI score API
-- has a valid JWT before the user authenticates with Apple at the paywall.
-- They are either upgraded in-place to real accounts (apple auth) or cleaned
-- up by a periodic job after 24h if never converted.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- Index so the Apple upgrade path can efficiently find and clean up guest rows
CREATE INDEX IF NOT EXISTS idx_users_is_guest ON users (is_guest) WHERE is_guest = true;
