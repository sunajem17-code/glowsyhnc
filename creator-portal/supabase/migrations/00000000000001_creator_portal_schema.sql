-- Creator Portal schema: creators, briefs, submissions + RLS
-- Applied to Supabase project: ascendus-creator-portal (htfxrfuwoatmogaooraa)

-- ============================================================
-- creators
-- ============================================================
create table public.creators (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null,
  discord_handle text not null,
  tiktok_handle text,
  tiktok_connected boolean not null default false,
  instagram_handle text,
  instagram_connected boolean not null default false,
  role text not null default 'creator' check (role in ('creator', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index creators_discord_id_key on public.creators (discord_id);

alter table public.creators enable row level security;

-- ============================================================
-- briefs
-- ============================================================
create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  min_view_threshold integer not null default 0 check (min_view_threshold >= 0),
  payout_structure jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.creators (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index briefs_active_idx on public.briefs (active);

alter table public.briefs enable row level security;

-- ============================================================
-- submissions
-- ============================================================
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators (id) on delete cascade,
  brief_id uuid not null references public.briefs (id) on delete restrict,
  video_url text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  posted_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  view_count_claimed integer not null default 0 check (view_count_claimed >= 0),
  proof_screenshot_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  payout_amount numeric(10, 2) not null default 0 check (payout_amount >= 0),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_creator_id_idx on public.submissions (creator_id);
create index submissions_brief_id_idx on public.submissions (brief_id);
create index submissions_status_idx on public.submissions (status);

alter table public.submissions enable row level security;

-- ============================================================
-- updated_at bookkeeping
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger creators_set_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

create trigger briefs_set_updated_at
  before update on public.briefs
  for each row execute function public.set_updated_at();

create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- ============================================================
-- is_admin() helper (SECURITY DEFINER avoids RLS recursion)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.creators where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- auto-provision a creators row on Discord OAuth signup
-- Discord via Supabase populates raw_user_meta_data with
-- provider_id (Discord user id) and full_name/name (username).
-- ============================================================
create or replace function public.handle_new_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.creators (id, discord_id, discord_handle)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub', new.id::text),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'unknown')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_creator
  after insert on auth.users
  for each row execute function public.handle_new_creator();

-- ============================================================
-- creators: protect discord_id / discord_handle / role from
-- self-edits regardless of what the client sends in an UPDATE
-- ============================================================
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
  end if;
  return new;
end;
$$;

create trigger creators_protect_admin_columns
  before update on public.creators
  for each row execute function public.protect_creator_admin_columns();

-- ============================================================
-- submissions: server-set submitted_at, and reject posted_at
-- more than 30 days in the past (or in the future). Scoped to
-- INSERT / UPDATE OF posted_at only, so it never re-fires (and
-- never breaks) when an admin later updates status/payout on an
-- older submission -- a plain CHECK constraint referencing now()
-- would incorrectly re-validate on every future update.
-- ============================================================
create or replace function public.validate_submission_posted_at()
returns trigger
language plpgsql
as $$
begin
  new.submitted_at := now();

  if new.posted_at > now() then
    raise exception 'posted_at cannot be in the future';
  end if;

  if new.posted_at < now() - interval '30 days' then
    raise exception 'posted_at cannot be more than 30 days ago';
  end if;

  return new;
end;
$$;

create trigger submissions_validate_posted_at
  before insert or update of posted_at on public.submissions
  for each row execute function public.validate_submission_posted_at();

-- keep submitted_at and status immutable for everyone except admins
create or replace function public.protect_submission_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.submitted_at := old.submitted_at;
    new.status := old.status;
    new.payout_amount := old.payout_amount;
  end if;
  return new;
end;
$$;

create trigger submissions_protect_admin_columns
  before update on public.submissions
  for each row execute function public.protect_submission_admin_columns();

-- ============================================================
-- RLS policies
-- ============================================================

-- creators
create policy "creators can view own row" on public.creators
  for select using (id = auth.uid() or public.is_admin());

create policy "creators can update own row" on public.creators
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- briefs
create policy "everyone can view active briefs, admins view all" on public.briefs
  for select using (active = true or public.is_admin());

create policy "admins manage briefs" on public.briefs
  for insert with check (public.is_admin());

create policy "admins update briefs" on public.briefs
  for update using (public.is_admin()) with check (public.is_admin());

create policy "admins delete briefs" on public.briefs
  for delete using (public.is_admin());

-- submissions
create policy "creators view own submissions, admins view all" on public.submissions
  for select using (creator_id = auth.uid() or public.is_admin());

create policy "creators submit for themselves to active briefs" on public.submissions
  for insert with check (
    creator_id = auth.uid()
    and exists (select 1 from public.briefs b where b.id = brief_id and b.active = true)
  );

create policy "admins update submissions" on public.submissions
  for update using (public.is_admin()) with check (public.is_admin());
