import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../../lib/supabase-server'

// Match @ascendus_app in any caption
const MENTION_PATTERN = /@(ascendus_app|ascendus[\s_-]*app)/i

function detectPlatform(url) {
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/instagram\.com/i.test(url)) return 'instagram'
  return null
}

async function expandUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.url || url
  } catch { return url }
}

// Fast oEmbed metadata — no Apify, ~1 second
async function fetchOembed(platform, videoUrl) {
  try {
    if (platform === 'tiktok') {
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return null
      const data = await res.json()
      return {
        title: data.title ?? '',
        author: data.author_name ?? '',
        thumbnail_url: data.thumbnail_url ?? null,
      }
    } else {
      // Instagram oEmbed requires token — return the video URL itself
      // so the thumbnail proxy can scrape og:image from the page
      return { title: '', author: '', thumbnail_url: videoUrl }
    }
  } catch { return null }
}

export async function POST(request) {
  // --- Auth ---
  const cookieStore = await cookies()
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { videoUrl } = body
  if (!videoUrl || typeof videoUrl !== 'string') {
    return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 })
  }

  const platform = detectPlatform(videoUrl)
  if (!platform) {
    return NextResponse.json({ error: 'Link must be from TikTok or Instagram' }, { status: 400 })
  }

  // Load all creator's verified linked accounts for ownership check
  const { data: linkedAccounts } = await supabaseAdmin
    .from('creator_accounts')
    .select('platform, handle')
    .eq('creator_id', user.id)
    .eq('verified', true)

  // Expand short URLs
  const resolvedUrl = await expandUrl(videoUrl.trim())

  // --- Ownership check: video URL must match one of the creator's verified handles ---
  const verifiedForPlatform = (linkedAccounts ?? []).filter(a => a.platform === platform)
  if (verifiedForPlatform.length > 0) {
    const urlLower = resolvedUrl.toLowerCase()
    if (platform === 'tiktok') {
      const ownsVideo = verifiedForPlatform.some(a => {
        const h = a.handle.replace(/^@/, '').toLowerCase()
        return urlLower.includes(`/@${h}/`) || urlLower.includes(`%40${h}`)
      })
      if (!ownsVideo) {
        const handles = verifiedForPlatform.map(a => `@${a.handle}`).join(', ')
        return NextResponse.json(
          { error: `This video doesn't appear to be from any of your linked TikTok accounts (${handles}). You can only submit your own videos.` },
          { status: 403 }
        )
      }
    }
    if (platform === 'instagram') {
      // Short reel URLs don't include handle — only check when handle is in URL
      if (!urlLower.includes('/reel/')) {
        const ownsVideo = verifiedForPlatform.some(a => {
          const h = a.handle.replace(/^@/, '').toLowerCase()
          return urlLower.includes(`/${h}/`) || urlLower.includes(`/${h}`)
        })
        if (!ownsVideo) {
          const handles = verifiedForPlatform.map(a => `@${a.handle}`).join(', ')
          return NextResponse.json(
            { error: `This video doesn't appear to be from any of your linked Instagram accounts (${handles}).` },
            { status: 403 }
          )
        }
      }
    }
  }

  // --- Duplicate check ---
  const { data: existing } = await supabaseAdmin
    .from('submissions')
    .select('id')
    .or(`video_url.eq.${videoUrl.trim()},video_url.eq.${resolvedUrl}`)
    .eq('creator_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You already submitted this video' }, { status: 409 })
  }

  // --- Fast oEmbed check (instant, no Apify wait) ---
  const oembed = await fetchOembed(platform, resolvedUrl)

  // For TikTok: check @ascendus_app mention in title
  if (platform === 'tiktok' && oembed) {
    const has_mention = MENTION_PATTERN.test(oembed.title) || MENTION_PATTERN.test(oembed.author)
    if (!has_mention) {
      return NextResponse.json(
        { error: 'Your video caption must tag @ascendus_app. Add the tag and resubmit.' },
        { status: 422 }
      )
    }
  }

  const thumbnail_url = oembed?.thumbnail_url ?? null

  // --- Insert immediately — views entered manually by admin on payout day ---
  const { data: submission, error: insertError } = await supabaseAdmin
    .from('submissions')
    .insert({
      creator_id: user.id,
      video_url: resolvedUrl,
      platform,
      posted_at: new Date().toISOString(),
      initial_views: 0,
      current_views: 0,
      has_agency_link: false,
      thumbnail_url,
      status: 'pending',
      view_count_claimed: 0,
    })
    .select('id, platform, status')
    .single()

  if (insertError) {
    console.error('[submissions/create] insert error', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json(submission, { status: 201 })
}
