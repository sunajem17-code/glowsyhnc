-- GET /api/user/unsubscribe writes to users.email_unsubscribed, but this
-- column never existed — the write silently failed (error discarded, never
-- checked) and every unsubscribe click showed a false "you're unsubscribed"
-- success page regardless of whether anything actually happened.
-- Applied directly to production via Supabase MCP on 2026-08-25.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN NOT NULL DEFAULT false;
