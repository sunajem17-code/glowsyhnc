-- Removes celebrity-matching columns left over from a feature that was
-- deliberately removed from the app. Confirmed unused: no client code sends
-- these fields anymore. Neither dependent view ever exposed celebrity_match
-- in its own output columns (free_users_day3 selected it directly but only
-- ever consumed for user_id by callers; pro_users_weekly_recap only carried
-- it through an inner LATERAL subquery, never in its final SELECT list), so
-- recreating both without it changes no observable behavior.
--
-- Applied live to the production project on 2026-07-29 as part of the
-- pre-App-Store-submission audit; this file documents that change in the
-- migration history to match.

DROP VIEW IF EXISTS public.free_users_day3;
DROP VIEW IF EXISTS public.pro_users_weekly_recap;

CREATE VIEW public.pro_users_weekly_recap AS
 SELECT p.id AS user_id,
    p.email,
    p.full_name,
    curr.overall_score AS current_score,
    curr.jawline_score,
    curr.skin_score,
    curr.eye_score,
    curr.grooming_score,
    curr.week_number,
    prev.overall_score AS prev_overall_score,
    prev.jawline_score AS prev_jawline_score,
    prev.skin_score AS prev_skin_score,
    prev.eye_score AS prev_eye_score,
    prev.grooming_score AS prev_grooming_score,
    ( SELECT count(*) AS count
           FROM user_scores s2
          WHERE s2.user_id = p.id AND s2.week_number > (curr.week_number - 8)) AS streak_weeks
   FROM profiles p
     JOIN LATERAL ( SELECT user_scores.id,
            user_scores.user_id,
            user_scores.week_number,
            user_scores.scan_date,
            user_scores.overall_score,
            user_scores.jawline_score,
            user_scores.skin_score,
            user_scores.eye_score,
            user_scores.grooming_score,
            user_scores.psl_tier
           FROM user_scores
          WHERE user_scores.user_id = p.id
          ORDER BY user_scores.week_number DESC
         LIMIT 1) curr ON true
     LEFT JOIN LATERAL ( SELECT user_scores.id,
            user_scores.user_id,
            user_scores.week_number,
            user_scores.scan_date,
            user_scores.overall_score,
            user_scores.jawline_score,
            user_scores.skin_score,
            user_scores.eye_score,
            user_scores.grooming_score,
            user_scores.psl_tier
           FROM user_scores
          WHERE user_scores.user_id = p.id AND user_scores.week_number = (curr.week_number - 1)) prev ON true
  WHERE p.plan = 'pro'::text;

CREATE VIEW public.free_users_day3 AS
 SELECT p.id AS user_id,
    p.email,
    p.full_name,
    p.created_at,
    p.plan,
    COALESCE(s.overall_score, 0::numeric) AS overall_score,
    COALESCE(s.psl_tier, 'Pending'::text) AS psl_tier,
    COALESCE(s.jawline_score, 0::numeric) AS jawline_score
   FROM profiles p
     LEFT JOIN LATERAL ( SELECT user_scores.overall_score,
            user_scores.psl_tier,
            user_scores.jawline_score
           FROM user_scores
          WHERE user_scores.user_id = p.id
          ORDER BY user_scores.scan_date DESC
         LIMIT 1) s ON true
     LEFT JOIN email_sends es ON es.user_id = p.id AND es.email_type = 'day3_nudge'::text
  WHERE p.plan = 'free'::text AND p.created_at <= (now() - '3 days'::interval) AND es.id IS NULL;

-- Re-apply the same anon/authenticated revokes the security_hardening
-- migration originally set on these views (CREATE VIEW resets grants).
REVOKE SELECT ON public.free_users_day3        FROM anon, authenticated;
REVOKE SELECT ON public.pro_users_weekly_recap FROM anon, authenticated;

-- Now safe to drop the orphaned columns.
ALTER TABLE public.user_scores DROP COLUMN IF EXISTS celebrity_match;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_1;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_1_similarity;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_2;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_2_similarity;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_3;
ALTER TABLE public.scans DROP COLUMN IF EXISTS celebrity_match_3_similarity;
