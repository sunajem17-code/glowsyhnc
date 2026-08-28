import { NextResponse } from 'next/server'

// Fetch thumbnail for a video URL via oEmbed (no Apify needed)
// Supports TikTok and Instagram
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const videoUrl = searchParams.get('videoUrl')
  if (!videoUrl) return new NextResponse('missing videoUrl', { status: 400 })

  let thumbnailUrl = null

  try {
    if (/tiktok\.com/i.test(videoUrl)) {
      // TikTok oEmbed
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      if (res.ok) {
        const json = await res.json()
        thumbnailUrl = json.thumbnail_url
      }
    } else if (/instagram\.com/i.test(videoUrl)) {
      // Instagram oEmbed (requires no auth for public posts)
      const res = await fetch(
        `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(videoUrl)}&omitscript=true`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      )
      if (res.ok) {
        const json = await res.json()
        thumbnailUrl = json.thumbnail_url
      }
    }
  } catch {
    // fall through to 404
  }

  if (!thumbnailUrl) {
    return new NextResponse('thumbnail not found', { status: 404 })
  }

  // Proxy the image through our server
  try {
    const imgRes = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.tiktok.com/',
      },
    })
    if (!imgRes.ok) return new NextResponse('upstream error', { status: 502 })
    const buffer = await imgRes.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('fetch failed', { status: 502 })
  }
}
