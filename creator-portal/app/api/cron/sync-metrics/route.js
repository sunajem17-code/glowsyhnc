import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { scrapeVideoBatch } from '../../../../lib/apify'

function normalizeUrl(u) {
  if (!u) return null
  return u.toLowerCase().replace(/\/+$/, '').split('?')[0]
}

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
        const result = resultMap.get(normalizeUrl(sub.video_url))

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
