-- ============================================================
-- creators.tier — standard vs vip, inherited by all of their
-- submissions when computing milestone payouts
-- ============================================================
alter table public.creators
  add column tier text not null default 'standard' check (tier in ('standard', 'vip'));

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
  end if;
  return new;
end;
$$;

-- ============================================================
-- milestones_hit — append-only ledger. A (submission_id, min_views)
-- can only ever be recorded once, so re-approving a submission never
-- pays the same milestone twice. Only written by admin_review_submission()
-- (SECURITY DEFINER) below -- no client-facing insert/update/delete policy.
-- ============================================================
create table public.milestones_hit (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  min_views integer not null,
  amount numeric(10, 2) not null,
  hit_at timestamptz not null default now(),
  unique (submission_id, min_views)
);

alter table public.milestones_hit enable row level security;

create policy "creators view own milestones, admins view all" on public.milestones_hit
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.submissions s
      where s.id = milestones_hit.submission_id and s.creator_id = auth.uid()
    )
  );

-- ============================================================
-- Creators may update ONLY view_count_claimed on their own
-- pending/approved submissions (to report view growth over time).
-- Every other column stays locked down below.
-- ============================================================
create policy "creators can update view count on own submissions" on public.submissions
  for update
  using (creator_id = auth.uid() and status in ('pending', 'approved'))
  with check (creator_id = auth.uid());

-- Replace the narrower version: now locks EVERY column except
-- view_count_claimed for non-admins, rather than just status/payout/submitted_at.
create or replace function public.protect_submission_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.creator_id := old.creator_id;
    new.brief_id := old.brief_id;
    new.video_url := old.video_url;
    new.platform := old.platform;
    new.posted_at := old.posted_at;
    new.submitted_at := old.submitted_at;
    new.proof_screenshot_url := old.proof_screenshot_url;
    new.status := old.status;
    new.payout_amount := old.payout_amount;
    new.admin_notes := old.admin_notes;
  end if;
  return new;
end;
$$;

-- ============================================================
-- admin_review_submission — the ONLY way payout_amount changes.
-- Expected payout_structure shape on briefs:
--   { "milestones": { "standard": [{"min_views":30000,"amount":15}, ...],
--                      "vip":      [{"min_views":30000,"amount":15}, ...] } }
-- Cumulative: payout_amount = sum of amounts for every milestone whose
-- min_views has ever been crossed by this submission, recorded once each
-- in milestones_hit so re-approving never re-pays a milestone.
-- ============================================================
create or replace function public.admin_review_submission(
  p_submission_id uuid,
  p_status text,
  p_admin_notes text default null,
  p_view_count_claimed integer default null
)
returns public.submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_tier text;
  v_milestones jsonb;
  v_milestone jsonb;
  v_min_views integer;
  v_amount numeric;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_status not in ('approved', 'rejected', 'paid') then
    raise exception 'invalid status: %', p_status;
  end if;

  select * into v_submission from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'submission not found';
  end if;

  if p_view_count_claimed is not null then
    if p_view_count_claimed < 0 then
      raise exception 'view_count_claimed cannot be negative';
    end if;
    update public.submissions set view_count_claimed = p_view_count_claimed where id = p_submission_id;
    v_submission.view_count_claimed := p_view_count_claimed;
  end if;

  if p_status in ('approved', 'paid') then
    select tier into v_tier from public.creators where id = v_submission.creator_id;

    select b.payout_structure -> 'milestones' -> coalesce(v_tier, 'standard')
      into v_milestones
      from public.briefs b where b.id = v_submission.brief_id;

    if v_milestones is not null then
      for v_milestone in select * from jsonb_array_elements(v_milestones) loop
        v_min_views := (v_milestone ->> 'min_views')::integer;
        v_amount := (v_milestone ->> 'amount')::numeric;
        if v_min_views is not null and v_amount is not null
           and v_submission.view_count_claimed >= v_min_views then
          insert into public.milestones_hit (submission_id, min_views, amount)
          values (p_submission_id, v_min_views, v_amount)
          on conflict (submission_id, min_views) do nothing;
        end if;
      end loop;
    end if;

    select coalesce(sum(amount), 0) into v_total
      from public.milestones_hit where submission_id = p_submission_id;
  else
    v_total := v_submission.payout_amount;
  end if;

  update public.submissions
    set status = p_status,
        admin_notes = p_admin_notes,
        payout_amount = v_total
    where id = p_submission_id
    returning * into v_submission;

  return v_submission;
end;
$$;

grant execute on function public.admin_review_submission(uuid, text, text, integer) to authenticated;
