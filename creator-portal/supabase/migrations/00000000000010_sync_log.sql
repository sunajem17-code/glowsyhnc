-- Audit log for hourly Apify sync runs
create table public.sync_log (
  id            uuid primary key default gen_random_uuid(),
  synced_at     timestamptz not null default now(),
  videos_synced integer not null default 0,
  errors        jsonb
  -- errors shape: [{"submission_id": "uuid", "video_url": "...", "message": "..."}]
);

alter table public.sync_log enable row level security;

create policy "admins view sync log" on public.sync_log
  for select using (public.is_admin());
