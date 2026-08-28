import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { scrapeVideo } from '../../../../lib/apify'

/**
 * POST /api/submissions/refresh-views
 * Fetches real view counts via Apify for ALL of the authenticated creator's
 * pending + approved submissions, then updates current_views in Supabase.
 * Scrapes each video individually so URL matching is never an issue.
 */
export async function POST(request) {
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load this creator's submissions worth refreshing
  const { data: subs } = await supabaseAdmin
    .from('submissions')
    .select('id, platform, video_url, current_views')
    .eq('creator_id', user.id)
    .in('status', ['pending', 'approved'])

  if (!subs || subs.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  let updatedCount = 0

  // Scrape each individually — avoids batch URL-matching bugs
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const scraped = await scrapeVideo(sub.platform, sub.video_url)
        const views = scraped.view_count ?? 0
        if (views === sub.current_views) return // no change

        await supabaseAdmin
          .from('submissions')
          .update({ current_views: views })
          .eq('id', sub.id)

        updatedCount++
      } catch {
        // Skip failed scrapes silently
      }
    })
  )

  return NextResponse.json({ updated: updatedCount, total: subs.length })
}
