-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening migration
-- Addresses Supabase Security Advisor findings.
--
-- All five objects below are accessed exclusively by the server-side Express
-- process using the SUPABASE_SERVICE_ROLE_KEY.  service_role bypasses RLS and
-- does not need explicit GRANT/EXECUTE permissions, so revoking from anon and
-- authenticated closes each finding without breaking anything.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Views: pro_users_weekly_recap and free_users_day3 ──────────────────────
-- Used only by the email scheduler in server/src/index.js (service role).
-- Revoke direct SELECT from anon/authenticated so they cannot be queried
-- via the public Supabase JS client.
REVOKE SELECT ON public.pro_users_weekly_recap FROM anon, authenticated;
REVOKE SELECT ON public.free_users_day3        FROM anon, authenticated;

-- ── 2. processed_webhook_events: enable RLS + deny-all policy ─────────────────
-- Used only by the Stripe webhook handler in server/src/supabase.js (service
-- role, which bypasses RLS entirely — these policies only protect anon/authed).
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Explicit deny-all for anon (belt-and-suspenders on top of RLS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_webhook_events'
      AND policyname = 'deny anon'
  ) THEN
    CREATE POLICY "deny anon"
      ON public.processed_webhook_events
      FOR ALL
      TO anon
      USING (false);
  END IF;
END $$;

-- Explicit deny-all for authenticated users — no end-user should see this table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'processed_webhook_events'
      AND policyname = 'deny authenticated'
  ) THEN
    CREATE POLICY "deny authenticated"
      ON public.processed_webhook_events
      FOR ALL
      TO authenticated
      USING (false);
  END IF;
END $$;

-- ── 3 & 4. log_email_send function: revoke EXECUTE + fix search_path ──────────
-- This function is called server-side only (via supabase.rpc() with the service
-- role key in ascendus-mailer.js). Revoking from PUBLIC prevents it from being
-- invoked via the anon/authenticated Supabase JS client.
--
-- SET search_path = '' is the Supabase-recommended fix for the mutable
-- search_path advisory. With an empty search_path, every table/schema reference
-- inside the function body MUST be fully-qualified or Postgres will error.
--
-- Verified live function signature and body before writing this replace:
--   pg_get_functiondef confirmed: p_user_id uuid, p_type text, p_resend_id text DEFAULT NULL
--   body: INSERT INTO email_sends (user_id, email_type, resend_id) VALUES (...)
--   email_sends is in public schema — qualified below as public.email_sends.
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_email_send(
  p_user_id   UUID,
  p_type      TEXT,
  p_resend_id TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- closes mutable search_path advisory
AS $$
BEGIN
  -- public.email_sends is fully qualified so this INSERT is safe with
  -- search_path = ''. Confirmed table exists in public schema.
  INSERT INTO public.email_sends (user_id, email_type, resend_id)
  VALUES (p_user_id, p_type, p_resend_id);
END;
$$;

-- Re-revoke after CREATE OR REPLACE — REPLACE resets privileges to the default
-- (EXECUTE granted to PUBLIC), so we must revoke again immediately after.
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_email_send(uuid, text, text) FROM authenticated;

-- ── 5. affiliate_clicks and scan_cache ────────────────────────────────────────
-- Both tables are accessed server-side only (via service role in
-- server/src/supabase.js).  Verified via pg_class before writing this
-- migration: both already have relrowsecurity = true with zero policies,
-- which means deny-by-default is already in effect for anon/authenticated.
-- These ALTER TABLE statements are kept idempotent for completeness and
-- to make the intent explicit in the migration history.
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_cache       ENABLE ROW LEVEL SECURITY;

-- No permissive policies are added — deny-by-default is the correct posture.
-- service_role bypasses RLS so the server-side path is unaffected.
