# Ascendus Creator Portal

Separate app for TikTok/Instagram creators doing paid content collabs with Ascendus.

- **Stack:** React + Vite + Tailwind v4, Supabase (auth + Postgres + storage)
- **Supabase project:** `ascendus-creator-portal` (`htfxrfuwoatmogaooraa`) — a dedicated project, separate from the main Ascendus app's database
- **Dev server:** `npm run dev` → http://localhost:5174 (or via the `creator-portal` launch config)

## One-time manual setup (cannot be done via API/MCP)

### 1. Enable Discord OAuth in Supabase

1. Create a Discord application at https://discord.com/developers/applications
2. Add OAuth2 redirect URL: `https://htfxrfuwoatmogaooraa.supabase.co/auth/v1/callback`
3. Copy the Client ID and Client Secret
4. In the Supabase dashboard → this project → **Authentication → Providers → Discord**, enable it and paste the Client ID/Secret
5. Under **Authentication → URL Configuration**, add `http://localhost:5174` and your production domain to the redirect allow list

Until this is done, "Continue with Discord" will error out — everything else in the app is already wired and tested.

### 2. Env vars

`.env.local` is already populated with this project's URL + publishable key (gitignored). `.env.example` shows the shape for other environments (e.g. Vercel).

### 3. Deploy to Vercel

`vercel.json` (SPA rewrite so client-side routes like `/dashboard/briefs` don't 404 on a
direct load/refresh) is already in place. The Vercel MCP connector isn't authenticated for
this environment (confirmed via a 403 on project creation), so this needs to be run from your
own terminal:

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
vercel link
```

```bash
vercel env add VITE_SUPABASE_URL production preview development
```

```bash
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production preview development
```

```bash
vercel --prod
```

Use the values from `.env.local` when each `vercel env add` prompts for the value. Add your
Discord OAuth redirect URL (see step 1) and the `.vercel.app` domain to Supabase's
**Authentication → URL Configuration** allow list once you have it.

## Database

Schema lives in `supabase/migrations/`. Already applied to the live project:

- `creators`, `briefs`, `submissions` tables with RLS
- Auto-provisioning trigger: a `creators` row is created automatically when someone signs in via Discord for the first time
- `posted_at` is rejected server-side (a `BEFORE INSERT` trigger, not a plain CHECK constraint — see migration comments for why) if it's in the future or more than 30 days in the past
- `submitted_at`, `status`, and `payout_amount` are forced server-side on every insert/update — the client cannot set them directly
- Private `proof-screenshots` storage bucket, scoped by uploader's `auth.uid()` folder prefix

To promote your own account to admin after first login:

```sql
update creators set role = 'admin' where discord_handle = 'your-discord-username';
```

## Payout calculation

Cumulative per-milestone payouts, tiered by creator (`creators.tier`: `standard` | `vip`).
All computation happens server-side in the `admin_review_submission()` Postgres function —
the client never sends a dollar amount. Admins call it via RPC (wired into the Admin page's
Approve / Reject / Recompute buttons). Actual payment is a separate, later step — see
**Weekly payout runs** below.

`briefs.payout_structure` shape:

```json
{
  "milestones": {
    "standard": [
      { "min_views": 30000, "amount": 15 },
      { "min_views": 250000, "amount": 25 },
      { "min_views": 1000000, "amount": 60 },
      { "min_views": 2500000, "amount": 80 },
      { "min_views": 5000000, "amount": 120 }
    ],
    "vip": [ ... ]
  }
}
```

Each time a submission is (re-)approved, the function checks which milestones the current
`view_count_claimed` has crossed that haven't been recorded yet in `milestones_hit`
(a `(submission_id, min_views)` unique ledger), inserts the new ones, and sets
`payout_amount` to the sum of every milestone ever hit for that submission — so re-approving
as a video's view count grows only ever adds, never re-pays. Admins can keep hitting
Recompute on the Admin page indefinitely (even after a submission has already been paid
once), since a video can keep crossing new milestones for weeks after its first payout.

**The seeded "Ascendus Launch Trend" brief's `vip` amounts are placeholders (I guessed
somewhat higher than standard) — swap them for the real numbers**, e.g.:

```sql
update briefs set payout_structure = jsonb_set(payout_structure, '{milestones,vip}', '[
  {"min_views": 30000, "amount": 25},
  {"min_views": 250000, "amount": 40},
  {"min_views": 1000000, "amount": 90},
  {"min_views": 2500000, "amount": 120},
  {"min_views": 5000000, "amount": 180}
]'::jsonb) where title = 'Ascendus Launch Trend';
```

To move a creator to VIP tier:

```sql
update creators set tier = 'vip' where discord_handle = 'their-discord-username';
```

## Weekly payout runs

Payment is batched weekly per creator, not per submission. `milestones_hit.batch_date` is
`null` until a milestone has actually been paid out; the Admin → **Payout Run** page
(`/admin/payouts`) lists every creator with any unpaid milestone, summed across all their
videos, via the `get_weekly_payout_run()` RPC.

**Eligibility gate:** before a creator can be paid, their `creators.us_audience_pct` /
`creators.t1_audience_pct` must meet their tier's minimum — checked server-side in
`creator_meets_tier_threshold()`, the single source of truth used by both the listing and the
pay action:

- Standard: 10% US + 10% T1
- VIP: 20% US + 20% T1
- A `null` percentage fails closed (excluded, not silently passed)

Creators who don't meet the threshold still show up on the Payout Run page — flagged and
excluded, not hidden — so nothing gets silently skipped. Clicking **Mark batch as paid** calls
`mark_payout_batch_paid(creator_id)`, which re-checks eligibility server-side (not just trusting
the page), stamps every currently-unpaid `milestones_hit` row for that creator with today's
date, and flips any of their `approved` submissions to `paid`.

There's no UI yet to edit `us_audience_pct` / `t1_audience_pct` — set them via SQL, same as
`tier`:

```sql
update creators set us_audience_pct = 34.5, t1_audience_pct = 22.0
where discord_handle = 'their-discord-username';
```
