# Video Submissions Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Vite SPA to Next.js and build video submission verification, hourly view-count syncing, AI-assisted analytics tier assignment, and a server-rendered admin dashboard.

**Architecture:** Next.js App Router replaces Vite. API routes handle submission verification (via Apify) and cron-based view syncing. The admin dashboard is a React Server Component that fetches directly from Supabase with service-role key. Per-video tier (VIP/Standard) is determined from analytics screenshot US audience %, reviewed by admin manually or via Claude Vision.

**Tech Stack:** Next.js 15 (App Router), Supabase JS v2, apify-client, @anthropic-ai/sdk, Tailwind CSS v4, Vercel cron

**Spec:** `docs/superpowers/specs/2026-08-25-video-submissions-module-design.md`

## Global Constraints

- Node.js ≥ 20
- Next.js 15 (`"next": "^15"`) with App Router (`app/` directory)
- Tailwind CSS v4 — use existing design tokens: `bg-bg`, `bg-surface`, `bg-surface-raised`, `text-text`, `text-text-muted`, `text-gold`, `border-border`, `text-danger`
- Dark theme only; do not add light-mode variants
- Supabase project: `htfxrfuwoatmogaooraa` (ascendus-creator-portal)
- Agency link to detect: `beacons.ai/ascendus`
- TikTok Apify actor: `clockworks/tiktok-video-scraper`
- Instagram Apify actor: `apify/instagram-reel-scraper`
- Apify run timeout: 30 seconds
- Cron schedule: `"0 * * * *"` (every hour)
- Max concurrent Apify batches: 10 per platform
- Sync window: submissions where `posted_at >= now() - interval '7 days'`
- Claude model for screenshot analysis: `claude-sonnet-5`
- VIP threshold: US audience ≥ 20 %
- Standard threshold: US audience ≥ 10 % and < 20 %
- Disqualified: US audience < 10 %
- Max payout per video: $300 (at 5 M views)
- `proof-screenshots` Supabase Storage bucket already exists — reuse it

---

## File Map

### New files (created by this plan)
```
next.config.js                                   # replaces vite.config.js
app/
  layout.jsx                                     # root HTML shell, Inter font, AuthProvider
  page.jsx                                       # redirect / → /login
  login/
    page.jsx                                     # migrated Login page
  dashboard/
    layout.jsx                                   # ProtectedRoute wrapper
    page.jsx                                     # migrated Dashboard
    leaderboard/page.jsx
    payout-calendar/page.jsx
    briefs/page.jsx
    submit/page.jsx                              # updated: calls /api/submissions/create
    submissions/page.jsx
  settings/page.jsx
  admin/
    layout.jsx                                   # AdminRoute wrapper
    page.jsx                                     # migrated Admin
    payouts/page.jsx
    creators/page.jsx
    briefs/page.jsx
    dashboard/
      page.jsx                                   # NEW: RSC admin dashboard
      SubmissionsTable.jsx                       # client component: filters + actions
      ScreenshotModal.jsx                        # lightbox
      TierSelect.jsx                             # tier dropdown + approve/reject actions
  api/
    submissions/
      create/
        route.js                                 # POST — verify + save submission
    cron/
      sync-metrics/
        route.js                                 # GET — hourly view-count sync
    admin/
      analyze-screenshot/
        route.js                                 # POST — Claude Vision tier check
lib/
  supabase-server.js                             # service-role client for API routes / RSC
  apify.js                                       # Apify actor helpers
  claude.js                                      # Claude Vision screenshot analysis
  payout.js                                      # existing file — add calcPayout() export
supabase/migrations/
  00000000000008_submissions_view_columns.sql
  00000000000009_payout_tiers.sql
  00000000000010_sync_log.sql
```

### Modified files
```
package.json                    # swap vite → next; add apify-client, @anthropic-ai/sdk
src/index.css → app/globals.css # moved; @import 'tailwindcss' stays
vercel.json                     # replace rewrite with cron config
.env.local                      # add server-side env vars
```

### Untouched files (carry forward as-is)
```
src/lib/AuthContext.jsx         # imported by app/layout.jsx
src/lib/supabase.js             # browser client; unchanged
src/lib/theme.js
src/lib/payout.js               # extended, not replaced
src/components/**               # all components reused
src/store/**
```

---

## Task 1: Swap build tooling — Vite → Next.js

**Files:**
- Modify: `package.json`
- Create: `next.config.js`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `npm run dev` starts Next.js dev server on port 3000

- [ ] **Step 1: Install Next.js, remove Vite**

```bash
cd /Users/abdel/Downloads/creator-portal
npm remove vite @vitejs/plugin-react
npm install next@^15
npm install apify-client @anthropic-ai/sdk
```

- [ ] **Step 2: Update `package.json` scripts**

Open `package.json`. Replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "oxlint"
}
```

- [ ] **Step 3: Create `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
}

export default nextConfig
```

- [ ] **Step 4: Update `vercel.json`**

Replace the entire file:

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

- [ ] **Step 5: Move CSS to app directory**

```bash
mkdir -p app
cp src/index.css app/globals.css
```

Open `app/globals.css`. The first line `@import 'tailwindcss';` is correct — leave it unchanged. Add the Inter font import at the top:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import 'tailwindcss';
```

Keep all existing `@theme` and `body` declarations unchanged.

- [ ] **Step 6: Delete Vite artefacts**

```bash
rm -f vite.config.js index.html
```

- [ ] **Step 7: Verify Next.js starts**

```bash
npm run dev
```

Expected: Next.js starts on port 3000 (will show 404 — no `app/` pages yet; that is correct).

- [ ] **Step 8: Commit**

```bash
git init   # project has no git repo yet
git add -A
git commit -m "chore: migrate build tooling from Vite to Next.js 15"
```

---

## Task 2: Root layout and auth wiring

**Files:**
- Create: `app/layout.jsx`
- Create: `app/page.jsx`

**Interfaces:**
- Produces: `AuthProvider` wraps the entire app; `/` redirects to `/login`
- Consumes: `src/lib/AuthContext.jsx` (unchanged), `app/globals.css`

- [ ] **Step 1: Create `app/layout.jsx`**

```jsx
import './globals.css'
import { AuthProvider } from '../src/lib/AuthContext'

export const metadata = {
  title: 'Ascendus Creator Portal',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `app/page.jsx` (root redirect)**

```jsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/login')
}
```

- [ ] **Step 3: Verify no import errors**

```bash
npm run build 2>&1 | head -40
```

Expected: Build may warn about missing pages — that is fine. No module-not-found errors.

- [ ] **Step 4: Commit**

```bash
git add app/layout.jsx app/page.jsx app/globals.css
git commit -m "feat: add Next.js root layout with AuthProvider"
```

---

## Task 3: Migrate all existing pages to App Router

**Files:**
- Create: `app/login/page.jsx`
- Create: `app/dashboard/layout.jsx` + `app/dashboard/page.jsx` and all sub-routes
- Create: `app/settings/page.jsx`
- Create: `app/admin/layout.jsx` + `app/admin/page.jsx` and sub-routes

**Interfaces:**
- Produces: All existing routes accessible under Next.js file-based routing
- Consumes: All `src/pages/**` and `src/components/**` — these are client components (`'use client'`)

Each migrated page is a thin wrapper that adds `'use client'` (because they use hooks) and re-exports the existing component. React Router `<Link>` and `useNavigate` inside the existing components are replaced with Next.js equivalents inline.

- [ ] **Step 1: Install next/navigation shim awareness**

The existing components use `react-router-dom`. We will replace imports in each component file as we wrap them. Run this to see all router usages:

```bash
grep -r "react-router-dom\|useNavigate\|useLocation\|<Link" src/ --include="*.jsx" -l
```

- [ ] **Step 2: Replace react-router-dom in all source files**

```bash
# Check what we need to replace
grep -rn "from 'react-router-dom'" src/ --include="*.jsx"
```

For every file that imports from `react-router-dom`:
- Replace `import { Link } from 'react-router-dom'` → `import Link from 'next/link'`
- Replace `import { useNavigate } from 'react-router-dom'` → `import { useRouter } from 'next/navigation'`
- Replace `const navigate = useNavigate()` → `const router = useRouter()`
- Replace `navigate('/path')` → `router.push('/path')`
- Replace `<Navigate to="/" replace />` → add `import { redirect } from 'next/navigation'` and call `redirect('/')`

Run find-replace for each file the grep found.

- [ ] **Step 3: Remove react-router-dom**

```bash
npm remove react-router-dom
```

- [ ] **Step 4: Create `app/login/page.jsx`**

```jsx
'use client'
import { Login } from '../../src/pages/Login'
export default Login
```

- [ ] **Step 5: Create `app/dashboard/layout.jsx`** (ProtectedRoute equivalent)

```jsx
'use client'
import { useAuth } from '../../src/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from '../../src/components/Sidebar'

export default function DashboardLayout({ children }) {
  const { session, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) router.push('/login')
  }, [loading, session, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Loading…
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Create dashboard sub-pages**

```bash
mkdir -p app/dashboard/leaderboard app/dashboard/payout-calendar app/dashboard/briefs app/dashboard/submit app/dashboard/submissions
```

`app/dashboard/page.jsx`:
```jsx
'use client'
import { Dashboard } from '../../src/pages/dashboard/Dashboard'
export default Dashboard
```

`app/dashboard/leaderboard/page.jsx`:
```jsx
'use client'
import { Leaderboard } from '../../../src/pages/dashboard/Leaderboard'
export default Leaderboard
```

`app/dashboard/payout-calendar/page.jsx`:
```jsx
'use client'
import { PayoutCalendar } from '../../../src/pages/dashboard/PayoutCalendar'
export default PayoutCalendar
```

`app/dashboard/briefs/page.jsx`:
```jsx
'use client'
import { ActiveBriefs } from '../../../src/pages/dashboard/ActiveBriefs'
export default ActiveBriefs
```

`app/dashboard/submissions/page.jsx`:
```jsx
'use client'
import { MySubmissions } from '../../../src/pages/dashboard/MySubmissions'
export default MySubmissions
```

`app/settings/page.jsx`:
```jsx
'use client'
import { Settings } from '../../src/pages/Settings'
export default Settings
```

- [ ] **Step 7: Create `app/admin/layout.jsx`** (AdminRoute equivalent)

```jsx
'use client'
import { useAuth } from '../../src/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({ children }) {
  const { isAdmin, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAdmin) router.push('/dashboard')
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted">
        Loading…
      </div>
    )
  }

  if (!isAdmin) return null

  return <>{children}</>
}
```

- [ ] **Step 8: Create admin sub-pages**

```bash
mkdir -p app/admin/payouts app/admin/creators app/admin/briefs
```

`app/admin/page.jsx`:
```jsx
'use client'
import { Admin } from '../../src/pages/Admin'
export default Admin
```

`app/admin/payouts/page.jsx`:
```jsx
'use client'
import { AdminPayoutRun } from '../../src/pages/AdminPayoutRun'
export default AdminPayoutRun
```

`app/admin/creators/page.jsx`:
```jsx
'use client'
import { AdminCreators } from '../../src/pages/AdminCreators'
export default AdminCreators
```

`app/admin/briefs/page.jsx`:
```jsx
'use client'
import { AdminBriefs } from '../../src/pages/AdminBriefs'
export default AdminBriefs
```

- [ ] **Step 9: Verify all routes load**

```bash
npm run dev
```

Visit in browser: `http://localhost:3000` → should redirect to `/login`. Sign in → `/dashboard` should load with sidebar. Check `/admin` redirects non-admins.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate all existing pages to Next.js App Router"
```

---

## Task 4: Database migrations

**Files:**
- Create: `supabase/migrations/00000000000008_submissions_view_columns.sql`
- Create: `supabase/migrations/00000000000009_payout_tiers.sql`
- Create: `supabase/migrations/00000000000010_sync_log.sql`

**Interfaces:**
- Produces: `submissions.initial_views`, `submissions.current_views`, `submissions.has_agency_link`, `submissions.submission_tier` columns; `public.payout_tiers` table seeded with Standard and VIP milestones; `public.sync_log` table
- Consumes: existing `public.submissions`, `public.creators` tables

- [ ] **Step 1: Create migration 008 — new submission columns**

`supabase/migrations/00000000000008_submissions_view_columns.sql`:

```sql
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
```

- [ ] **Step 2: Create migration 009 — payout_tiers table**

`supabase/migrations/00000000000009_payout_tiers.sql`:

```sql
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
```

- [ ] **Step 3: Create migration 010 — sync_log table**

`supabase/migrations/00000000000010_sync_log.sql`:

```sql
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
```

- [ ] **Step 4: Apply migrations**

```bash
npx supabase db push
```

Expected: 3 new migrations applied with no errors.

- [ ] **Step 5: Verify schema**

```bash
npx supabase db diff --schema public 2>/dev/null | grep -E "initial_views|current_views|has_agency_link|submission_tier|payout_tiers|sync_log"
```

Expected: lines referencing all 4 new columns and 2 new tables.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add view tracking columns, payout_tiers, and sync_log migrations"
```

---

## Task 5: Server-side Supabase client and Apify helper

**Files:**
- Create: `lib/supabase-server.js`
- Create: `lib/apify.js`

**Interfaces:**
- Produces:
  - `supabaseAdmin` — Supabase client with service-role key (bypasses RLS)
  - `scrapeVideo(platform, videoUrl)` → `{ view_count: number, create_time: string (ISO), author_bio: string }`
- Consumes: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `APIFY_API_TOKEN` env vars

- [ ] **Step 1: Add environment variables to `.env.local`**

Create or open `.env.local` (never committed). Add:

```
NEXT_PUBLIC_SUPABASE_URL=<your existing value from VITE_SUPABASE_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your existing VITE_SUPABASE_PUBLISHABLE_KEY value>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API → service_role secret>
APIFY_API_TOKEN=<get from apify.com → Settings → Integrations → API token>
ANTHROPIC_API_KEY=<get from console.anthropic.com>
CRON_SECRET=<generate: openssl rand -hex 32>
```

- [ ] **Step 2: Create `lib/supabase-server.js`**

```js
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  throw new Error('[supabase-server] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required')
}

// Service-role client: bypasses RLS. Use only in API routes and RSC.
// Never expose to the browser.
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
})
```

- [ ] **Step 3: Create `lib/apify.js`**

```js
import { ApifyClient } from 'apify-client'

const ACTORS = {
  tiktok: 'clockworks/tiktok-video-scraper',
  instagram: 'apify/instagram-reel-scraper',
}

const TIMEOUT_SECS = 30

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

/**
 * Scrape a single video and return normalised metadata.
 *
 * @param {'tiktok'|'instagram'} platform
 * @param {string} videoUrl
 * @returns {{ view_count: number, create_time: string, author_bio: string }}
 * @throws Error with human-readable message on timeout or no result
 */
export async function scrapeVideo(platform, videoUrl) {
  const actorId = ACTORS[platform]
  if (!actorId) throw new Error(`Unsupported platform: ${platform}`)

  const input =
    platform === 'tiktok'
      ? { postURLs: [videoUrl], resultsPerPage: 1 }
      : { directUrls: [videoUrl], resultsLimit: 1 }

  const run = await client.actor(actorId).call(input, {
    waitSecs: TIMEOUT_SECS,
  })

  if (!run || run.status === 'TIMED-OUT') {
    throw new Error('TIMEOUT')
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 })

  if (!items || items.length === 0) {
    throw new Error('NO_RESULTS')
  }

  const item = items[0]

  // Normalise field names across TikTok and Instagram actor outputs
  const view_count =
    item.playCount ??          // TikTok clockworks actor
    item.videoPlayCount ??     // TikTok alt field
    item.videoViewCount ??     // Instagram reel scraper
    item.likesCount ??         // fallback
    0

  const raw_time =
    item.createTime ??         // TikTok (Unix seconds)
    item.createTimeISO ??      // TikTok ISO
    item.timestamp ??          // Instagram
    item.postedAt ??
    null

  const create_time = raw_time
    ? typeof raw_time === 'number'
      ? new Date(raw_time * 1000).toISOString()
      : new Date(raw_time).toISOString()
    : new Date().toISOString()

  const author_bio =
    item.authorMeta?.signature ??   // TikTok
    item.ownerFullName ??           // Instagram (bio not always returned)
    item.biography ??
    ''

  return { view_count, create_time, author_bio }
}

/**
 * Scrape multiple videos of the same platform in one actor run.
 * Returns a map of videoUrl → normalised metadata (or Error on failure).
 *
 * @param {'tiktok'|'instagram'} platform
 * @param {string[]} videoUrls
 * @returns {Map<string, { view_count: number, create_time: string, author_bio: string } | Error>}
 */
export async function scrapeVideoBatch(platform, videoUrls) {
  const actorId = ACTORS[platform]
  if (!actorId) throw new Error(`Unsupported platform: ${platform}`)

  const input =
    platform === 'tiktok'
      ? { postURLs: videoUrls, resultsPerPage: videoUrls.length }
      : { directUrls: videoUrls, resultsLimit: videoUrls.length }

  let run
  try {
    run = await client.actor(actorId).call(input, { waitSecs: 120 })
  } catch {
    // Return all as errors if actor call fails
    return new Map(videoUrls.map((u) => [u, new Error('ACTOR_FAILED')]))
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: videoUrls.length,
  })

  const result = new Map()

  for (const item of items ?? []) {
    const url =
      item.webVideoUrl ??
      item.videoUrl ??
      item.url ??
      item.shortCode
        ? `https://www.instagram.com/reel/${item.shortCode}/`
        : null

    if (!url) continue

    const view_count =
      item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? 0

    const raw_time = item.createTime ?? item.createTimeISO ?? item.timestamp ?? null
    const create_time = raw_time
      ? typeof raw_time === 'number'
        ? new Date(raw_time * 1000).toISOString()
        : new Date(raw_time).toISOString()
      : new Date().toISOString()

    const author_bio =
      item.authorMeta?.signature ?? item.biography ?? ''

    result.set(url, { view_count, create_time, author_bio })
  }

  // Mark any URL not returned by the actor as an error
  for (const u of videoUrls) {
    if (!result.has(u)) result.set(u, new Error('NO_RESULTS'))
  }

  return result
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase-server.js lib/apify.js .env.local
git commit -m "feat: add server Supabase client and Apify scraping helpers"
```

---

## Task 6: Submission & Verification API route

**Files:**
- Create: `app/api/submissions/create/route.js`

**Interfaces:**
- Consumes: `scrapeVideo(platform, videoUrl)` from `lib/apify.js`; `supabaseAdmin` from `lib/supabase-server.js`
- Produces: `POST /api/submissions/create` → `{ id, has_agency_link, status, initial_views }`

- [ ] **Step 1: Create the route**

```bash
mkdir -p app/api/submissions/create
```

`app/api/submissions/create/route.js`:

```js
import { NextResponse } from 'next/server'
import { scrapeVideo } from '../../../../lib/apify'
import { supabaseAdmin } from '../../../../lib/supabase-server'

const AGENCY_LINK_PATTERN = /beacons\.ai\/ascendus/i

/** POST /api/submissions/create */
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { videoUrl, userId, platform, briefId } = body

  // --- Input validation ---
  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
  }
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }
  if (!platform || !['tiktok', 'instagram'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be tiktok or instagram' }, { status: 400 })
  }
  if (!briefId || typeof briefId !== 'string') {
    return NextResponse.json({ error: 'briefId is required' }, { status: 400 })
  }

  // --- Duplicate check ---
  const { data: existing } = await supabaseAdmin
    .from('submissions')
    .select('id')
    .eq('video_url', videoUrl.trim())
    .eq('creator_id', userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Video already submitted' }, { status: 409 })
  }

  // --- Apify scrape ---
  let scraped
  try {
    scraped = await scrapeVideo(platform, videoUrl.trim())
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      return NextResponse.json(
        { error: 'Could not reach video — try again' },
        { status: 504 }
      )
    }
    if (err.message === 'NO_RESULTS') {
      return NextResponse.json(
        { error: 'Video not found or private' },
        { status: 422 }
      )
    }
    console.error('[submissions/create] Apify error', err)
    return NextResponse.json({ error: 'Scraping failed' }, { status: 502 })
  }

  const { view_count, create_time, author_bio } = scraped

  // --- Agency link check ---
  const has_agency_link = AGENCY_LINK_PATTERN.test(author_bio)
  const status = has_agency_link ? 'pending' : 'rejected'

  // --- Insert submission ---
  const { data: submission, error: insertError } = await supabaseAdmin
    .from('submissions')
    .insert({
      creator_id: userId,
      brief_id: briefId,
      video_url: videoUrl.trim(),
      platform,
      posted_at: create_time,
      initial_views: view_count,
      current_views: view_count,
      has_agency_link,
      status,
      view_count_claimed: view_count,
    })
    .select('id, has_agency_link, status, initial_views')
    .single()

  if (insertError) {
    console.error('[submissions/create] insert error', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(submission, { status: 201 })
}
```

- [ ] **Step 2: Update `src/pages/dashboard/SubmitVideo.jsx` to call the API**

Open `src/pages/dashboard/SubmitVideo.jsx`. Replace the section that does `supabase.from('submissions').insert(...)` with a `fetch` call:

```jsx
// Replace the direct supabase insert block (around line 60-80) with:
const res = await fetch('/api/submissions/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    videoUrl: videoUrl.trim(),
    userId: creator.id,
    platform,
    briefId,
  }),
})

const result = await res.json()
setSubmitting(false)

if (!res.ok) {
  setError(result.error ?? 'Submission failed')
  return
}

if (!result.has_agency_link) {
  setError('Your bio must contain a link to beacons.ai/ascendus to qualify.')
  return
}

setSuccess(true)
```

Keep the screenshot upload block (Supabase Storage) that runs before the insert — it should stay as-is. After the API call succeeds, update the `proof_screenshot_url` separately using `supabaseAdmin` from the client (`supabase` browser client):

```jsx
// After successful API call, attach screenshot if provided
if (screenshot && result.id) {
  const path = `${creator.id}/${crypto.randomUUID()}-${screenshot.name}`
  const { error: uploadError } = await supabase.storage
    .from('proof-screenshots')
    .upload(path, screenshot)
  if (!uploadError) {
    await supabase
      .from('submissions')
      .update({ proof_screenshot_url: path })
      .eq('id', result.id)
  }
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

In browser: navigate to `/dashboard/submit`, submit a TikTok URL. Check Supabase `submissions` table for the new row with `initial_views`, `current_views`, and `has_agency_link` populated.

- [ ] **Step 4: Commit**

```bash
git add app/api/submissions/create/route.js src/pages/dashboard/SubmitVideo.jsx
git commit -m "feat: add POST /api/submissions/create with Apify verification"
```

---

## Task 7: Hourly sync cron job

**Files:**
- Create: `app/api/cron/sync-metrics/route.js`

**Interfaces:**
- Consumes: `scrapeVideoBatch(platform, videoUrls)` from `lib/apify.js`; `supabaseAdmin`
- Produces: `GET /api/cron/sync-metrics` → `{ synced, errors }` JSON; updates `submissions.current_views`; inserts into `sync_log`

- [ ] **Step 1: Create the route**

```bash
mkdir -p app/api/cron/sync-metrics
```

`app/api/cron/sync-metrics/route.js`:

```js
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { scrapeVideoBatch } from '../../../../lib/apify'

const BATCH_SIZE = 10
const SYNC_WINDOW_DAYS = 7

/** GET /api/cron/sync-metrics — called by Vercel cron every hour */
export async function GET(request) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Query active submissions within the sync window
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - SYNC_WINDOW_DAYS)

  const { data: submissions, error: queryError } = await supabaseAdmin
    .from('submissions')
    .select('id, video_url, platform')
    .in('status', ['pending', 'approved'])
    .gte('posted_at', windowStart.toISOString())

  if (queryError) {
    console.error('[sync-metrics] query error', queryError)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ synced: 0, errors: [] })
  }

  // Group by platform
  const byPlatform = { tiktok: [], instagram: [] }
  for (const s of submissions) {
    if (byPlatform[s.platform]) byPlatform[s.platform].push(s)
  }

  const allErrors = []
  let totalSynced = 0

  for (const [platform, platformSubs] of Object.entries(byPlatform)) {
    if (platformSubs.length === 0) continue

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < platformSubs.length; i += BATCH_SIZE) {
      const batch = platformSubs.slice(i, i + BATCH_SIZE)
      const urls = batch.map((s) => s.video_url)

      const resultMap = await scrapeVideoBatch(platform, urls)

      for (const sub of batch) {
        const result = resultMap.get(sub.video_url)

        if (!result || result instanceof Error) {
          allErrors.push({
            submission_id: sub.id,
            video_url: sub.video_url,
            message: result?.message ?? 'No result returned',
          })
          continue
        }

        const { error: updateError } = await supabaseAdmin
          .from('submissions')
          .update({ current_views: result.view_count })
          .eq('id', sub.id)

        if (updateError) {
          allErrors.push({
            submission_id: sub.id,
            video_url: sub.video_url,
            message: updateError.message,
          })
        } else {
          totalSynced++
        }
      }
    }
  }

  // Write audit log
  await supabaseAdmin.from('sync_log').insert({
    videos_synced: totalSynced,
    errors: allErrors.length > 0 ? allErrors : null,
  })

  return NextResponse.json({ synced: totalSynced, errors: allErrors })
}
```

- [ ] **Step 2: Verify cron route is reachable locally**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -s -X GET http://localhost:3000/api/cron/sync-metrics \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" \
  | jq .
```

Expected: `{ "synced": <number>, "errors": [] }` (or empty if no active submissions in window).

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/sync-metrics/route.js
git commit -m "feat: add hourly Apify sync cron at /api/cron/sync-metrics"
```

---

## Task 8: Claude Vision screenshot analysis API

**Files:**
- Create: `lib/claude.js`
- Create: `app/api/admin/analyze-screenshot/route.js`

**Interfaces:**
- Consumes: `ANTHROPIC_API_KEY`, screenshot file URL from Supabase Storage; `supabaseAdmin`
- Produces: `POST /api/admin/analyze-screenshot` with `{ submissionId }` → `{ us_pct: number, tier: 'vip'|'standard'|'disqualified', payout_amount: number }`

- [ ] **Step 1: Add payout calculation to `src/lib/payout.js`**

Open `src/lib/payout.js`. Add this export at the bottom (do not modify existing exports):

```js
/**
 * Calculate payout from a milestone tier and a view count.
 * Milestones shape: [{ min_views, cumulative_payout }, ...]
 *
 * @param {Array<{min_views: number, cumulative_payout: number}>} milestones
 * @param {number} viewCount
 * @returns {number} payout in USD
 */
export function calcPayout(milestones, viewCount) {
  if (!milestones || milestones.length === 0) return 0
  const sorted = [...milestones].sort((a, b) => b.min_views - a.min_views)
  const hit = sorted.find((m) => viewCount >= m.min_views)
  return hit ? hit.cumulative_payout : 0
}
```

- [ ] **Step 2: Create `lib/claude.js`**

```js
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Extract US audience percentage from an analytics screenshot.
 *
 * @param {string} imageUrl - Public or signed URL of the screenshot
 * @returns {{ us_pct: number }} Extracted US audience percentage (0–100)
 */
export async function extractUsAudiencePct(imageUrl) {
  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `This is a TikTok or Instagram analytics screenshot showing audience geography.
Find the United States row and extract the percentage shown next to it.
Reply with ONLY a JSON object in this exact format, nothing else:
{"us_pct": <number between 0 and 100>}
If you cannot find a US percentage, reply with {"us_pct": 0}.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0]?.text ?? '{}'
  try {
    const parsed = JSON.parse(text)
    const us_pct = Number(parsed.us_pct)
    if (isNaN(us_pct)) return { us_pct: 0 }
    return { us_pct: Math.min(100, Math.max(0, us_pct)) }
  } catch {
    return { us_pct: 0 }
  }
}
```

- [ ] **Step 3: Create `app/api/admin/analyze-screenshot/route.js`**

```bash
mkdir -p app/api/admin/analyze-screenshot
```

```js
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { extractUsAudiencePct } from '../../../../lib/claude'
import { calcPayout } from '../../../../src/lib/payout'

function tierFromUsPct(us_pct) {
  if (us_pct >= 20) return 'vip'
  if (us_pct >= 10) return 'standard'
  return 'disqualified'
}

/** POST /api/admin/analyze-screenshot */
export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { submissionId } = body
  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  // Fetch submission + screenshot URL
  const { data: submission, error: fetchError } = await supabaseAdmin
    .from('submissions')
    .select('id, proof_screenshot_url, current_views')
    .eq('id', submissionId)
    .single()

  if (fetchError || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  if (!submission.proof_screenshot_url) {
    return NextResponse.json({ error: 'No analytics screenshot uploaded' }, { status: 422 })
  }

  // Get signed URL for the screenshot
  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from('proof-screenshots')
    .createSignedUrl(submission.proof_screenshot_url, 120)

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not access screenshot' }, { status: 502 })
  }

  // Call Claude Vision
  let us_pct
  try {
    const result = await extractUsAudiencePct(signedData.signedUrl)
    us_pct = result.us_pct
  } catch (err) {
    console.error('[analyze-screenshot] Claude error', err)
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 502 })
  }

  const tier = tierFromUsPct(us_pct)

  // Look up milestone table for this tier
  let payout_amount = 0
  if (tier !== 'disqualified') {
    const { data: tierRow } = await supabaseAdmin
      .from('payout_tiers')
      .select('milestones')
      .eq('name', tier)
      .is('creator_id', null)
      .single()

    if (tierRow?.milestones) {
      payout_amount = calcPayout(tierRow.milestones, submission.current_views ?? 0)
    }
  }

  return NextResponse.json({ us_pct, tier, payout_amount })
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/claude.js app/api/admin/analyze-screenshot/route.js src/lib/payout.js
git commit -m "feat: add Claude Vision screenshot analysis for tier assignment"
```

---

## Task 9: Admin dashboard — server-rendered RSC page

**Files:**
- Create: `app/admin/dashboard/page.jsx` (React Server Component)
- Create: `app/admin/dashboard/SubmissionsTable.jsx` (Client Component)
- Create: `app/admin/dashboard/ScreenshotModal.jsx` (Client Component)
- Create: `app/admin/dashboard/TierSelect.jsx` (Client Component)

**Interfaces:**
- Consumes: `supabaseAdmin` (server), `POST /api/admin/analyze-screenshot`, Supabase browser client for mutations
- Produces: `/admin/dashboard` page with full submissions table, filters, and inline actions

- [ ] **Step 1: Create `app/admin/dashboard/page.jsx`** (RSC — no `'use client'`)

```jsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../lib/supabase-server'
import { SubmissionsTable } from './SubmissionsTable'

async function getAdminSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: creator } = await supabase
    .from('creators')
    .select('role')
    .eq('id', user.id)
    .single()

  if (creator?.role !== 'admin') redirect('/dashboard')
  return user
}

export default async function AdminDashboardPage({ searchParams }) {
  await getAdminSession()

  const params = await searchParams
  const platform = params?.platform ?? 'all'
  const status   = params?.status   ?? 'all'
  const linkStatus = params?.linkStatus ?? 'all'

  let query = supabaseAdmin
    .from('submissions')
    .select(`
      id,
      video_url,
      platform,
      posted_at,
      initial_views,
      current_views,
      has_agency_link,
      submission_tier,
      status,
      payout_amount,
      proof_screenshot_url,
      admin_notes,
      created_at,
      creators ( id, discord_handle, tier )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (platform !== 'all') query = query.eq('platform', platform)
  if (status   !== 'all') query = query.eq('status',   status)
  if (linkStatus === 'verified') query = query.eq('has_agency_link', true)
  if (linkStatus === 'missing')  query = query.eq('has_agency_link', false)

  const { data: submissions, error } = await query

  if (error) {
    return (
      <div className="text-danger p-8">
        Failed to load submissions: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Submissions Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          {submissions?.length ?? 0} submissions
        </p>
      </div>
      <SubmissionsTable
        submissions={submissions ?? []}
        currentFilters={{ platform, status, linkStatus }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Install `@supabase/ssr`**

```bash
npm install @supabase/ssr
```

- [ ] **Step 3: Create `app/admin/dashboard/ScreenshotModal.jsx`**

```jsx
'use client'
import { useEffect } from 'react'

export function ScreenshotModal({ url, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!url) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl border border-border bg-surface p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-text-muted hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Analytics screenshot" className="max-h-[85vh] rounded-lg" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/admin/dashboard/TierSelect.jsx`**

```jsx
'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TIERS = ['vip', 'standard', 'disqualified']

export function TierSelect({ submission, onUpdated }) {
  const [tier, setTier] = useState(submission.submission_tier ?? '')
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [aiResult, setAiResult] = useState(null)

  async function runAiCheck() {
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAiResult(data)
      setTier(data.tier)
    } catch (e) {
      setError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function saveTier() {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        submission_tier: tier || null,
        payout_amount: aiResult?.payout_amount ?? submission.payout_amount,
      })
      .eq('id', submission.id)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onUpdated()
  }

  async function approve() {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'approved' })
      .eq('id', submission.id)
    setSaving(false)
    if (updateError) setError(updateError.message)
    else onUpdated()
  }

  async function reject() {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ status: 'rejected' })
      .eq('id', submission.id)
    setSaving(false)
    if (updateError) setError(updateError.message)
    else onUpdated()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text"
        >
          <option value="">— not reviewed —</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {submission.proof_screenshot_url && (
          <button
            onClick={runAiCheck}
            disabled={aiLoading}
            className="rounded bg-gold/10 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
          >
            {aiLoading ? 'Analysing…' : 'AI Check'}
          </button>
        )}

        <button
          onClick={saveTier}
          disabled={saving || !tier}
          className="rounded bg-surface-raised px-2 py-1 text-xs text-text hover:bg-border disabled:opacity-50"
        >
          Save
        </button>
      </div>

      {aiResult && (
        <p className="text-xs text-text-muted">
          US: {aiResult.us_pct}% → {aiResult.tier} → ${aiResult.payout_amount?.toFixed(2)}
        </p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={approve}
          disabled={saving}
          className="rounded bg-gold/10 px-2 py-1 text-xs text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={reject}
          disabled={saving}
          className="rounded bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20 disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/admin/dashboard/SubmissionsTable.jsx`**

```jsx
'use client'
import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ScreenshotModal } from './ScreenshotModal'
import { TierSelect } from './TierSelect'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function FilterBar({ current }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function setFilter(key, value) {
    const params = new URLSearchParams(searchParams)
    params.set(key, value)
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="flex flex-wrap gap-3">
      {[
        { key: 'platform', label: 'Platform', options: ['all', 'tiktok', 'instagram'] },
        { key: 'status',   label: 'Status',   options: ['all', 'pending', 'approved', 'rejected', 'paid'] },
        { key: 'linkStatus', label: 'Link',   options: ['all', 'verified', 'missing'] },
      ].map(({ key, label, options }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{label}</span>
          <select
            value={current[key]}
            onChange={(e) => setFilter(key, e.target.value)}
            className="rounded border border-border bg-surface-raised px-2 py-1 text-sm text-text"
          >
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

export function SubmissionsTable({ submissions: initial, currentFilters }) {
  const router = useRouter()
  const [screenshotUrl, setScreenshotUrl] = useState(null)

  const openScreenshot = useCallback(async (path) => {
    const { data } = await supabase.storage
      .from('proof-screenshots')
      .createSignedUrl(path, 120)
    if (data?.signedUrl) setScreenshotUrl(data.signedUrl)
  }, [])

  return (
    <>
      <FilterBar current={currentFilters} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-text-muted">
            <tr>
              {['Clipper', 'Platform', 'Post Date', 'Initial', 'Live Views', 'Net', 'Screenshot', 'Tier', 'Payout', 'Status', 'Link', 'Actions'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initial.map((sub) => {
              const net = (sub.current_views ?? 0) - (sub.initial_views ?? 0)
              return (
                <tr key={sub.id} className="bg-surface hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 text-text-muted">{sub.creators?.discord_handle ?? sub.creator_id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{sub.platform}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-text-muted">
                    {sub.posted_at ? new Date(sub.posted_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">{(sub.initial_views ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{(sub.current_views ?? 0).toLocaleString()}</td>
                  <td className={`px-4 py-3 ${net > 0 ? 'text-gold' : 'text-text-muted'}`}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {sub.proof_screenshot_url ? (
                      <button
                        onClick={() => openScreenshot(sub.proof_screenshot_url)}
                        className="text-gold hover:underline"
                      >
                        View
                      </button>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <TierSelect submission={sub} onUpdated={() => router.refresh()} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {sub.payout_amount > 0 ? `$${Number(sub.payout_amount).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      sub.status === 'approved' ? 'bg-gold/10 text-gold' :
                      sub.status === 'rejected' ? 'bg-danger/10 text-danger' :
                      sub.status === 'paid'     ? 'bg-green-900/30 text-green-400' :
                      'bg-surface-raised text-text-muted'
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sub.has_agency_link ? (
                      <span className="text-xs text-gold">✓ Verified</span>
                    ) : (
                      <span className="text-xs text-danger">✗ Missing</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={sub.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold hover:underline"
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              )
            })}
            {initial.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-text-muted">
                  No submissions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ScreenshotModal url={screenshotUrl} onClose={() => setScreenshotUrl(null)} />
    </>
  )
}
```

- [ ] **Step 6: Add `/admin/dashboard` to the admin sidebar nav**

Open `src/components/Sidebar.jsx` (or wherever admin nav links live). Add a link:

```jsx
<Link href="/admin/dashboard">Submissions</Link>
```

alongside the existing admin links.

- [ ] **Step 7: Smoke test the dashboard**

```bash
npm run dev
```

Sign in as an admin user. Navigate to `/admin/dashboard`. Verify:
- Table renders with existing submissions
- Platform/Status/Link filters update the URL and re-fetch data
- "View" screenshot button opens modal
- "AI Check" button calls `/api/admin/analyze-screenshot` and pre-fills tier
- Tier save and Approve/Reject buttons update Supabase

- [ ] **Step 8: Commit**

```bash
git add app/admin/dashboard/ src/components/Sidebar.jsx
git commit -m "feat: add server-rendered admin submissions dashboard with AI tier check"
```

---

## Task 10: Final wiring, env check, and deploy

**Files:**
- Modify: `.env.local` (verify all vars present)

**Interfaces:**
- Produces: deployed Next.js app on Vercel with cron active

- [ ] **Step 1: Verify all env vars are set**

```bash
grep -E "NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|APIFY_API_TOKEN|ANTHROPIC_API_KEY|CRON_SECRET" .env.local
```

Expected: 6 lines, none empty.

- [ ] **Step 2: Full build check**

```bash
npm run build
```

Expected: Build completes with no errors. Warnings about missing `APIFY_API_TOKEN` at build time are acceptable (runtime-only).

- [ ] **Step 3: Set env vars in Vercel**

In Vercel dashboard → Project Settings → Environment Variables, add all 6 vars. The `CRON_SECRET` value must match `.env.local`.

- [ ] **Step 4: Deploy**

```bash
git push  # or via Vercel CLI: npx vercel --prod
```

- [ ] **Step 5: Verify cron is registered**

In Vercel dashboard → Project → Cron Jobs tab. Confirm `/api/cron/sync-metrics` appears with schedule `0 * * * *`.

- [ ] **Step 6: Trigger a manual cron test**

In Vercel Cron Jobs tab, click "Run now" on `sync-metrics`. Check Vercel function logs for `{ synced: N, errors: [] }`. Check Supabase `sync_log` table for a new row.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: production deploy — video submissions module complete"
```
