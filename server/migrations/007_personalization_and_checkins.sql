-- Review and apply before releasing the server. Custom public.users + JWT auth.
BEGIN;
CREATE TABLE IF NOT EXISTS public.personalized_recommendations (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  context_key text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, context_key)
);
ALTER TABLE public.personalized_recommendations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personalized_recommendations FROM anon, authenticated;
GRANT ALL ON public.personalized_recommendations TO service_role;

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  water_glasses integer DEFAULT 0,
  skincare_am integer DEFAULT 0,
  skincare_pm integer DEFAULT 0,
  exercises_done integer DEFAULT 0,
  mood_score integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_checkin_date date
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_checkins_user_day ON public.daily_checkins(user_id, checkin_date);
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_checkins, public.streaks FROM anon, authenticated;
GRANT ALL ON public.daily_checkins, public.streaks TO service_role;

CREATE OR REPLACE FUNCTION public.record_daily_checkin(
  p_user_id uuid, p_water integer, p_mood integer,
  p_am boolean, p_pm boolean, p_exercises boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'UTC')::date;
  previous public.streaks%ROWTYPE;
  current_count integer;
BEGIN
  IF p_water NOT BETWEEN 0 AND 100 OR p_mood NOT BETWEEN 0 AND 10 THEN
    RAISE EXCEPTION 'invalid_checkin';
  END IF;
  -- Serialize each account, including its first-ever check-in.
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_user'; END IF;
  INSERT INTO public.daily_checkins(id,user_id,checkin_date,water_glasses,skincare_am,skincare_pm,exercises_done,mood_score)
    VALUES(gen_random_uuid(),p_user_id,today,p_water,p_am::integer,p_pm::integer,p_exercises::integer,p_mood)
    ON CONFLICT(user_id,checkin_date) DO UPDATE SET
      water_glasses=excluded.water_glasses,skincare_am=excluded.skincare_am,
      skincare_pm=excluded.skincare_pm,exercises_done=excluded.exercises_done,mood_score=excluded.mood_score;
  SELECT * INTO previous FROM public.streaks WHERE user_id=p_user_id FOR UPDATE;
  IF previous.last_checkin_date IS NULL OR previous.last_checkin_date < today THEN
    current_count := CASE WHEN previous.last_checkin_date = today - 1 THEN previous.current_streak + 1 ELSE 1 END;
    INSERT INTO public.streaks(user_id,current_streak,longest_streak,last_checkin_date)
      VALUES(p_user_id,current_count,greatest(coalesce(previous.longest_streak,0),current_count),today)
      ON CONFLICT(user_id) DO UPDATE SET current_streak=excluded.current_streak,
        longest_streak=excluded.longest_streak,last_checkin_date=excluded.last_checkin_date;
  END IF;
  RETURN (SELECT to_jsonb(s) FROM public.streaks s WHERE user_id=p_user_id);
END $$;
REVOKE ALL ON FUNCTION public.record_daily_checkin(uuid,integer,integer,boolean,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_checkin(uuid,integer,integer,boolean,boolean,boolean) TO service_role;
COMMIT;
