import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { scrapeVideoBatch } from '../../../../lib/apify'

export async function POST(request) {
  // --- Auth: must be admin ---
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!creator?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Load all non-rejected submissions (pending + approved)
  const { data: submissions, error: fetchErr } = await supabaseAdmin
    .from('submissions')
    .select('id, platform, video_url, current_views')
    .in('status', ['pending', 'approved'])

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No approved submissions to update.' })
  }

  // Group by platform
  const byPlatform = { tiktok: [], instagram: [] }
  for (const s of submissions) {
    if (byPlatform[s.platform]) byPlatform[s.platform].push(s)
  }

  const updates = []
  const errors = []

  for (const platform of ['tiktok', 'instagram']) {
    const batch = byPlatform[platform]
    if (batch.length === 0) continue

    const urls = batch.map(s => s.video_url)
    let results
    try {
      results = await scrapeVideoBatch(platform, urls)
    } catch (err) {
      errors.push(`${platform}: ${err.message}`)
      continue
    }

    for (const sub of batch) {
      const key = sub.video_url.toLowerCase().replace(/\/+$/, '').split('?')[0]
      const result = results.get(key)
      if (!result || result instanceof Error) {
        errors.push(`${sub.id}: ${result?.message ?? 'not found in scrape'}`)
        continue
      }

      const newViews = result.view_count ?? 0
      if (newViews === sub.current_views) continue // no change

      updates.push({ id: sub.id, current_views: newViews })
    }
  }

  // Batch update in Supabase
  let updatedCount = 0
  for (const upd of updates) {
    const { error: updErr } = await supabaseAdmin
      .from('submissions')
      .update({ current_views: upd.current_views })
      .eq('id', upd.id)
    if (!updErr) updatedCount++
    else errors.push(`update ${upd.id}: ${updErr.message}`)
  }

  return NextResponse.json({
    updated: updatedCount,
    total: submissions.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
