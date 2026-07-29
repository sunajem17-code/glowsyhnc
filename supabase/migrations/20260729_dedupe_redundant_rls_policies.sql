-- scans, plan_tasks, progress, and users each carried two permissive RLS
-- policies enforcing the exact same restriction (one simple auth.uid() =
-- column comparison, one equivalent subquery via the users table). Both are
-- ORed together as permissive policies, so this was never a security gap,
-- just redundant evaluation on every query. Keeping the simple direct
-- comparison (cheaper, no extra join) and dropping the verbose duplicate.
--
-- Applied live to the production project on 2026-07-29 as part of the
-- pre-App-Store-submission audit; this file documents that change in the
-- migration history to match.
DROP POLICY IF EXISTS "scans: own rows only" ON public.scans;
DROP POLICY IF EXISTS "plan_tasks: own rows only" ON public.plan_tasks;
DROP POLICY IF EXISTS "progress: own rows only" ON public.progress;
DROP POLICY IF EXISTS "users: own row only" ON public.users;
