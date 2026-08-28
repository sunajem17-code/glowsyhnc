-- Fixed calendar payout schedule (7th/14th/21st/28th of each month),
-- replacing the earlier "weekly" framing -- which was only ever a UI
-- label. Verified before this migration: neither creator_meets_tier_threshold()
-- nor mark_payout_batch_paid() had any rolling-interval math to remove.
create table public.payout_dates (
  id uuid primary key default gen_random_uuid(),
  payout_date date not null unique,
  is_override boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

alter table public.payout_dates enable row level security;

create policy "everyone signed in can view the payout schedule" on public.payout_dates
  for select using (true);

create policy "admins manage payout schedule" on public.payout_dates
  for insert with check (public.is_admin());

create policy "admins update payout schedule" on public.payout_dates
  for update using (public.is_admin()) with check (public.is_admin());

create policy "admins delete payout schedule" on public.payout_dates
  for delete using (public.is_admin());

-- Seed the 7th/14th/21st/28th of every month from Jan 2026 through Dec
-- 2028, except September 2026's 7th (replaced by the one-time override).
insert into public.payout_dates (payout_date, is_override, note)
select (month_start + offset_days * interval '1 day')::date, false, null
from generate_series('2026-01-01'::date, '2028-12-01'::date, interval '1 month') as month_start,
     unnest(array[6, 13, 20, 27]) as offset_days
where (month_start + offset_days * interval '1 day')::date <> '2026-09-07';

insert into public.payout_dates (payout_date, is_override, note)
values (
  '2026-09-01',
  true,
  'September 2026 one-time exception: first payout run moved from the 7th to the 1st'
);
