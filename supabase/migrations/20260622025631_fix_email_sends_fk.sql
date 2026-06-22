-- ─────────────────────────────────────────────────────────────────────────────
-- Fix email_sends foreign key — re-point from auth.users to public.users
--
-- Root cause: email_sends.user_id had a FK to auth.users (Supabase's built-in
-- auth table). The app uses custom JWT auth with users stored in public.users;
-- auth.users is empty and will always be empty. As a result every call to
-- log_email_send has been silently failing with 23503 FK violation since the
-- table was created, leaving email_sends permanently empty.
--
-- Consequence: the day3 nudge dedup guard (sendUpgradeNudge checks email_sends
-- for an existing row before sending) was permanently bypassed — eligible users
-- were receiving the nudge email on every daily scheduler run.
--
-- Fix: drop the old FK and add a new one pointing to public.users(id) with
-- ON DELETE CASCADE so log rows are cleaned up when a user is deleted.
--
-- Pre-apply state confirmed:
--   - email_sends had 0 rows (no data to migrate, no integrity risk)
--   - auth.users had 0 rows (confirmed via SELECT COUNT(*) FROM auth.users)
--   - public.users has a PRIMARY KEY on id (constraint: users_pkey)
--
-- Applied directly via Supabase MCP apply_migration on 2026-06-22.
-- Supabase migration ledger version: 20260622025631
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.email_sends
  DROP CONSTRAINT email_sends_user_id_fkey;

ALTER TABLE public.email_sends
  ADD CONSTRAINT email_sends_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users(id)
  ON DELETE CASCADE;

-- ── Rollback ──────────────────────────────────────────────────────────────────
-- To revert: drop the new constraint and restore the original (broken) one.
-- Note: reverting restores the broken state — the dedup guard will stop working
-- again. Only roll back if public.users(id) turns out to be the wrong target.
--
-- ALTER TABLE public.email_sends DROP CONSTRAINT email_sends_user_id_fkey;
-- ALTER TABLE public.email_sends
--   ADD CONSTRAINT email_sends_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
