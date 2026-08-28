-- Editable payout milestone config; creator_id null = global tier
create table public.payout_tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  creator_id  uuid references public.creators(id) on delete cascade,
  milestones  jsonb not null,
  -- milestones shape: [{"min_views": 30000, "cumulative_payout": 15.00}, ...]
  -- for freeform custom: {"freeform": true, "amount": 50.00}
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index payout_tiers_creator_id_idx on public.payout_tiers (creator_id);

create trigger payout_tiers_set_updated_at
  before update on public.payout_tiers
  for each row execute function public.set_updated_at();

alter table public.payout_tiers enable row level security;

create policy "admins manage payout tiers" on public.payout_tiers
  for all using (public.is_admin());

-- Seed Standard tier
insert into public.payout_tiers (name, creator_id, milestones) values (
  'standard',
  null,
  '[
    {"min_views": 30000,   "cumulative_payout": 15.00},
    {"min_views": 250000,  "cumulative_payout": 40.00},
    {"min_views": 1000000, "cumulative_payout": 100.00},
    {"min_views": 2500000, "cumulative_payout": 180.00},
    {"min_views": 5000000, "cumulative_payout": 300.00}
  ]'::jsonb
);

-- Seed VIP tier
insert into public.payout_tiers (name, creator_id, milestones) values (
  'vip',
  null,
  '[
    {"min_views": 30000,   "cumulative_payout": 20.00},
    {"min_views": 250000,  "cumulative_payout": 50.00},
    {"min_views": 1000000, "cumulative_payout": 130.00},
    {"min_views": 2500000, "cumulative_payout": 200.00},
    {"min_views": 5000000, "cumulative_payout": 300.00}
  ]'::jsonb
);
