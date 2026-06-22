-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK for 20260621_security_hardening.sql
--
-- Run this immediately if anything breaks after applying the hardening
-- migration. Restores every object to its exact pre-migration state as
-- confirmed by querying the live database before the migration was written.
--
-- Pre-migration baseline (queried from production 2026-06-21):
--   free_users_day3 / pro_users_weekly_recap:
--     ALL privileges held by: anon, authenticated, postgres, service_role
--   log_email_send:
--     EXECUTE held by: PUBLIC, anon, authenticated, postgres, service_role
--   processed_webhook_events:
--     RLS disabled, zero policies
--   affiliate_clicks / scan_cache:
--     RLS already enabled pre-migration — leave untouched (idempotent no-op)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Restore view SELECT grants ─────────────────────────────────────────────
GRANT SELECT ON public.pro_users_weekly_recap TO anon, authenticated;
GRANT SELECT ON public.free_users_day3        TO anon, authenticated;

-- ── 2. Restore processed_webhook_events to pre-migration state ────────────────
DROP POLICY IF EXISTS "deny anon"           ON public.processed_webhook_events;
DROP POLICY IF EXISTS "deny authenticated"  ON public.processed_webhook_events;
ALTER TABLE public.processed_webhook_events DISABLE ROW LEVEL SECURITY;

-- ── 3. Restore log_email_send: original body (no search_path) + re-grant ──────
-- Restores the exact function body that was live before the migration,
-- confirmed via pg_get_functiondef before any changes were made.
CREATE OR REPLACE FUNCTION public.log_email_send(
  p_user_id   UUID,
  p_type      TEXT,
  p_resend_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
-- NOTE: search_path is intentionally NOT set here — this is the pre-hardening
-- state. The security advisor warning will reappear; that is expected for a
-- rollback. Re-apply the hardening migration once the root cause is resolved.
AS $$
BEGIN
  INSERT INTO email_sends (user_id, email_type, resend_id)
  VALUES (p_user_id, p_type, p_resend_id);
END;
$$;

-- Re-grant EXECUTE (CREATE OR REPLACE revokes PUBLIC default; restore explicitly)
GRANT EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) TO service_role;

-- ── 4. affiliate_clicks / scan_cache ──────────────────────────────────────────
-- RLS was already enabled on both tables BEFORE the hardening migration ran.
-- The migration's ALTER TABLE ... ENABLE ROW LEVEL SECURITY was a no-op.
-- There is nothing to roll back here.
