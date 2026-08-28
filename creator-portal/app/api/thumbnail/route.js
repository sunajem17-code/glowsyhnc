import { NextResponse } from 'next/server'

// Proxy external thumbnail URLs — also resolves Instagram og:image
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new NextResponse('missing url', { status: 400 })

  // Instagram reels/posts: scrape og:image since CDN blocks hotlinking
  const isInstagram = /instagram\.com/i.test(url)
  if (isInstagram) {
    try {
      const html = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      }).then(r => r.text())

      const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

      if (match?.[1]) {
        const imgUrl = match[1].replace(/&amp;/g, '&')
        const img = await fetch(imgUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' },
          signal: AbortSignal.timeout(8000),
        })
        if (img.ok) {
          const buffer = await img.arrayBuffer()
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': img.headers.get('content-type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
            },
          })
        }
      }
    } catch {}
    return new NextResponse('not found', { status: 404 })
  }

  // TikTok / other: direct proxy
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return new NextResponse('upstream error', { status: 502 })
    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('fetch failed', { status: 502 })
  }
}
