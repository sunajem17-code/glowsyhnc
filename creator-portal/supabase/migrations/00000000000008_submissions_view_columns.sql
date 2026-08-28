-- Add Apify-sourced view tracking and agency link verification columns
alter table public.submissions
  add column initial_views   integer not null default 0 check (initial_views >= 0),
  add column current_views   integer not null default 0 check (current_views >= 0),
  add column has_agency_link boolean not null default false,
  -- per-video tier set by admin after reviewing analytics screenshot
  -- null = not yet reviewed; overrides creators.tier for payout calc
  add column submission_tier text check (submission_tier in ('standard', 'vip', 'custom', 'disqualified'));

comment on column public.submissions.initial_views   is 'View count captured via Apify at submission time';
comment on column public.submissions.current_views   is 'Latest view count from hourly Apify sync';
comment on column public.submissions.has_agency_link is 'True if beacons.ai/ascendus found in author bio at submission time';
comment on column public.submissions.submission_tier is 'Tier determined from analytics screenshot US%; null = pending review';
