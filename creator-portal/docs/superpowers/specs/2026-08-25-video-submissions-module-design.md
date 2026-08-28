# Video Submissions Module — Design Spec
**Date:** 2026-08-25  
**Status:** Approved

---

## Overview

Build the first core module for the Ascendus Creator Portal: video submission verification, live view-count syncing, analytics-based payout tier assignment, and an admin dashboard. The project is migrated from Vite + React SPA to Next.js App Router as a prerequisite.

---

## 1. Migration: Vite → Next.js

### What changes
- `vite.config.js` → `next.config.js`; remove `index.html`
- `package.json`: remove `vite`, `@vitejs/plugin-react`; add `next`
- `src/pages/*.jsx` → `app/` directory with file-based routing
- `src/lib/` stays unchanged (Supabase client, payout helpers, auth context)
- `vercel.json`: remove SPA rewrite; add cron config
- React Router (`<Link>`, `useNavigate`, `<Routes>`) → Next.js `<Link>` and `useRouter`
- Auth context and Zustand store logic are unchanged

### What stays
- Supabase JS client (`src/lib/supabase.js`)
- Tailwind CSS v4 config
- All existing component JSX
- All Supabase migrations and RLS policies

---

## 2. Database: New Columns

New migration adds three columns to `public.submissions`:

```sql
alter table public.submissions
  add column initial_views   integer not null default 0,
  add column current_views   integer not null default 0,
  add column has_agency_link boolean not null default false;
```

- `initial_views`: view count captured at submission time via Apify
- `current_views`: updated hourly by the sync cron job
- `has_agency_link`: whether `beacons.ai/ascendus` appears as a URL in the creator's bio at submission time

Existing columns used:
- `posted_at` → maps to Apify `create_time`
- `proof_screenshot_url` → analytics screenshot upload on payout day
- `view_count_claimed` → kept for creator self-report; not used by this module
- `status`: `'pending'` (link verified, awaiting admin), `'rejected'` (no agency link or disqualified), `'approved'`, `'paid'`

New `payout_tiers` config table (seeded, editable without deploys):

```sql
create table public.payout_tiers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,           -- 'standard' | 'vip' | 'custom'
  creator_id  uuid references public.creators(id),  -- null = global tier
  milestones  jsonb not null,          -- [{views: 30000, cumulative_payout: 15}, ...]
  created_at  timestamptz not null default now()
);
```

Seeded milestone data:

| Tier | 30K | 250K | 1M | 2.5M | 5M |
|---|---|---|---|---|---|
| Standard (cumulative) | $15 | $40 | $100 | $180 | $300 |
| VIP (cumulative) | $20 | $50 | $130 | $200 | $300 |

Custom tiers link to a `creator_id` and can use any milestone shape (milestone-based or freeform stored as `{freeform: true, amount: X}`).

Sync audit table:

```sql
create table public.sync_log (
  id           uuid primary key default gen_random_uuid(),
  synced_at    timestamptz not null default now(),
  videos_synced integer not null,
  errors       jsonb
);
```

---

## 3. Submission & Verification API

**Route:** `POST /api/submissions/create`  
**Auth:** Supabase session cookie (authenticated users only)

### Input
```json
{ "videoUrl": "string", "userId": "uuid", "platform": "tiktok | instagram" }
```

### Flow
1. Validate input; reject malformed URLs or unsupported platforms
2. Check for duplicate `video_url` per `user_id` (unique constraint)
3. Call Apify actor (30s timeout):
   - TikTok: `clockworks/tiktok-video-scraper`
   - Instagram: `apify/instagram-reel-scraper`
4. Extract from actor output: `view_count`, `create_time`, `author_bio`
5. Bio link check: `has_agency_link = author_bio` contains `beacons.ai/ascendus` as a URL (regex on href patterns, not plain text match)
6. Set status:
   - `has_agency_link = false` → `status = 'rejected'`
   - `has_agency_link = true` → `status = 'pending'`
7. Insert into `submissions`:
   - `initial_views = current_views = view_count`
   - `posted_at = create_time`
   - `has_agency_link`, `status` as above

### Error responses
| Scenario | HTTP | Message |
|---|---|---|
| Apify timeout | 504 | "Could not reach video — try again" |
| Actor returns no results | 422 | "Video not found or private" |
| Duplicate video URL | 409 | "Video already submitted" |
| Missing agency link | 200 | Saved as rejected; `has_agency_link: false` returned |

---

## 4. Hourly Sync Cron

**Route:** `GET /api/cron/sync-metrics`  
**Auth:** Vercel-injected `CRON_SECRET` header (verified server-side)  
**Schedule:** `"0 * * * *"` in `vercel.json`

### Flow
1. Query Supabase: `status IN ('pending', 'approved') AND posted_at >= now() - interval '7 days'`
2. Group video URLs by platform
3. Call Apify actors in parallel batches (max 10 concurrent per platform)
4. For each result: `UPDATE submissions SET current_views = $1, updated_at = now() WHERE id = $2`
5. Insert row into `sync_log` with count of videos synced and any per-video errors
6. **Does not calculate payout** — earnings are determined on payout day from the analytics screenshot

### Vercel cron config (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-metrics",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 5. Analytics Screenshot Review & Tier Assignment

### Creator flow (payout day)
1. Creator opens their submission in the portal
2. Uploads an analytics screenshot showing audience geography (TikTok/Instagram native analytics)
3. Screenshot saves to Supabase Storage (`proof-screenshots` bucket, existing), URL stored in `proof_screenshot_url`

### Tier qualification rules
| US Audience % | Result |
|---|---|
| < 10% | Disqualified — no payout |
| 10–19% | Standard tier |
| ≥ 20% | VIP tier |
| Custom plan | Overrides geo rules; set per creator in `payout_tiers` |

### Admin review paths

**Manual:** Admin views screenshot, reads US % label, selects tier from dropdown. System looks up milestone table for that tier, computes `payout_amount` based on `current_views` at review time, saves to `submissions.payout_amount`.

**AI-assisted:** "Run AI Check" button POSTs screenshot URL to `/api/admin/analyze-screenshot`. Server calls Claude Vision (`claude-sonnet-5`) with the image, prompts it to extract the US audience percentage. Returns `{ us_pct, tier, payout_amount }`. Admin sees pre-filled values and confirms or overrides.

Payout calculation: find the highest milestone threshold ≤ `current_views`, return that row's `cumulative_payout`.

---

## 6. Admin Dashboard

**Route:** `GET /app/admin/dashboard` (Next.js App Router, React Server Component)  
**Auth:** Server-side check via `is_admin()` — redirects to `/login` if false

### Data table columns
| Clipper | Platform | Post Date | Initial Views | Live Views | Net Views | Screenshot | Tier | Payout | Status |
|---|---|---|---|---|---|---|---|---|---|

### Filters
- Platform (TikTok / Instagram / All)
- Status (pending / approved / rejected / paid)
- Link Status (verified / missing)
- Date range (post date)

### Row actions
- **View screenshot** — lightbox overlay
- **Run AI Check** — calls `/api/admin/analyze-screenshot`, pre-fills tier + payout
- **Override tier** — dropdown (Standard / VIP / Custom / Disqualified)
- **Approve payout** — sets `status = 'approved'`, locks `payout_amount`
- **Flag / Reject** — sets `status = 'rejected'` with optional `admin_notes`

### Performance
Page is server-rendered with `async` RSC data fetch — no client-side waterfall. Filtering uses URL search params, no client state.

---

## 7. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # for server-side API routes
APIFY_API_TOKEN=
ANTHROPIC_API_KEY=              # for AI screenshot analysis
CRON_SECRET=                    # Vercel auto-injects for cron routes
```

---

## 8. File Map

```
app/
  admin/
    dashboard/
      page.jsx          # RSC admin dashboard
      ScreenshotModal.jsx
      TierSelect.jsx
  api/
    submissions/
      create/
        route.js        # POST /api/submissions/create
    cron/
      sync-metrics/
        route.js        # GET /api/cron/sync-metrics
    admin/
      analyze-screenshot/
        route.js        # POST /api/admin/analyze-screenshot
  layout.jsx            # root layout (replaces index.html shell)
  login/
    page.jsx
  dashboard/
    page.jsx            # creator dashboard (migrated from src/pages/)
lib/
  supabase.js           # existing, unchanged
  apify.js              # new: Apify actor helpers
  payout.js             # existing + new tier calculation
  claude.js             # new: screenshot analysis
supabase/
  migrations/
    00000000000008_submissions_view_columns.sql
    00000000000009_payout_tiers.sql
    00000000000010_sync_log.sql
```
