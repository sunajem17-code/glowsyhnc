-- ============================================================
-- Audience demographic gates for weekly payout eligibility.
-- Admin-only (locked in protect_creator_admin_columns below), since a
-- creator misreporting their own audience mix would let them bypass
-- tier eligibility for real money.
-- ============================================================
alter table public.creators
  add column us_audience_pct numeric(5, 2) check (us_audience_pct is null or (us_audience_pct >= 0 and us_audience_pct <= 100)),
  add column t1_audience_pct numeric(5, 2) check (t1_audience_pct is null or (t1_audience_pct >= 0 and t1_audience_pct <= 100));

create or replace function public.protect_creator_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.discord_id := old.discord_id;
    new.discord_handle := old.discord_handle;
    new.role := old.role;
    new.tier := old.tier;
    new.us_audience_pct := old.us_audience_pct;
    new.t1_audience_pct := old.t1_audience_pct;
  end if;
  return new;
end;
$$;

-- Single source of truth for tier eligibility, shared by the payout-run
-- listing and the pay action so they can never drift out of sync.
-- Standard: 10% US + 10% T1. VIP: 20% US + 20% T1. A null pct fails closed.
create or replace function public.creator_meets_tier_threshold(p_creator_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case c.tier
    when 'vip' then coalesce(c.us_audience_pct, 0) >= 20 and coalesce(c.t1_audience_pct, 0) >= 20
    else coalesce(c.us_audience_pct, 0) >= 10 and coalesce(c.t1_audience_pct, 0) >= 10
  end
  from public.creators c
  where c.id = p_creator_id;
$$;

-- Internal helper only -- called from other SECURITY DEFINER functions
-- owned by the same role, so it needs no direct client grant.
revoke execute on function public.creator_meets_tier_threshold(uuid) from public, anon, authenticated;

-- ============================================================
-- milestones_hit.batch_date -- null until a weekly payout run pays it.
-- ============================================================
alter table public.milestones_hit add column batch_date date;
create index milestones_hit_batch_date_idx on public.milestones_hit (batch_date);

-- ============================================================
-- get_weekly_payout_run -- one row per creator with any unpaid
-- (batch_date IS NULL) milestone, aggregated across ALL their videos.
-- Ineligible creators are still returned (eligible = false) so the admin
-- UI can flag and exclude them rather than silently hiding them.
-- ============================================================
create or replace function public.get_weekly_payout_run()
returns table (
  creator_id uuid,
  discord_handle text,
  tier text,
  us_audience_pct numeric,
  t1_audience_pct numeric,
  total_owed numeric,
  unpaid_milestones integer,
  eligible boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    c.id as creator_id,
    c.discord_handle,
    c.tier,
    c.us_audience_pct,
    c.t1_audience_pct,
    sum(mh.amount) as total_owed,
    count(mh.id)::integer as unpaid_milestones,
    public.creator_meets_tier_threshold(c.id) as eligible
  from public.milestones_hit mh
  join public.submissions s on s.id = mh.submission_id
  join public.creators c on c.id = s.creator_id
  where mh.batch_date is null
  group by c.id, c.discord_handle, c.tier, c.us_audience_pct, c.t1_audience_pct
  order by eligible desc, total_owed desc;
end;
$$;

grant execute on function public.get_weekly_payout_run() to authenticated;

-- ============================================================
-- mark_payout_batch_paid -- pays ONE creator's entire unpaid ledger in
-- one shot. Re-checks eligibility server-side (defense in depth against
-- a stale UI / race), not just trusting the run listing.
-- ============================================================
create or replace function public.mark_payout_batch_paid(
  p_creator_id uuid,
  p_batch_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if not public.creator_meets_tier_threshold(p_creator_id) then
    raise exception 'creator does not meet tier audience thresholds -- cannot pay';
  end if;

  update public.milestones_hit mh
    set batch_date = p_batch_date
    from public.submissions s
    where mh.submission_id = s.id
      and s.creator_id = p_creator_id
      and mh.batch_date is null;

  get diagnostics v_count = row_count;

  -- Only flip a submission to 'paid' if it actually had a milestone paid
  -- in THIS batch -- not every 'approved' submission the creator happens
  -- to have (which could include one that's approved but hasn't earned
  -- its first milestone yet).
  update public.submissions
    set status = 'paid'
    where status = 'approved'
      and id in (
        select distinct s.id
        from public.submissions s
        join public.milestones_hit mh on mh.submission_id = s.id
        where s.creator_id = p_creator_id
          and mh.batch_date = p_batch_date
      );

  return v_count;
end;
$$;

grant execute on function public.mark_payout_batch_paid(uuid, date) to authenticated;
