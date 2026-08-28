import { ApifyClient } from 'apify-client'

const ACTORS = {
  tiktok: 'clockworks/tiktok-video-scraper',
  instagram: 'apify/instagram-reel-scraper',
}

const TIMEOUT_SECS = 60

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN })

/**
 * Scrape a single video and return normalised metadata.
 * @returns {{ view_count, create_time, author_bio, description }}
 */
export async function scrapeVideo(platform, videoUrl) {
  const actorId = ACTORS[platform]
  if (!actorId) throw new Error(`Unsupported platform: ${platform}`)

  const input =
    platform === 'tiktok'
      ? { postURLs: [videoUrl], resultsPerPage: 1 }
      : { directUrls: [videoUrl], resultsLimit: 1 }

  const run = await client.actor(actorId).call(input, { waitSecs: TIMEOUT_SECS })

  if (!run || run.status === 'TIMED-OUT') throw new Error('TIMEOUT')

  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 })
  if (!items || items.length === 0) throw new Error('NO_RESULTS')

  const item = items[0]

  const view_count =
    item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? item.likesCount ?? 0

  const raw_time =
    item.createTime ?? item.createTimeISO ?? item.timestamp ?? item.postedAt ?? null

  const create_time = raw_time
    ? typeof raw_time === 'number'
      ? new Date(raw_time * 1000).toISOString()
      : new Date(raw_time).toISOString()
    : new Date().toISOString()

  // Combine all bio-related fields — platforms store the link URL separately
  const author_bio = [
    item.authorMeta?.signature,   // TikTok bio text
    item.authorMeta?.bioLink,     // TikTok clickable link (separate field)
    item.authorMeta?.bioUrl,
    item.biography,               // Instagram bio text
    item.externalUrl,             // Instagram clickable link (separate field)
    item.externalUrlShimmed,
    item.bioLinks?.map(l => l.url ?? l).join(' '), // Instagram bioLinks array
  ].filter(Boolean).join(' ')

  // Thumbnail / cover image URL
  const thumbnail_url =
    item.covers?.[0] ??          // TikTok clockworks (array)
    item.cover ??                 // TikTok alt
    item.dynamicCover ??          // TikTok dynamic
    item.originCover ??           // TikTok origin
    item.displayUrl ??            // Instagram
    item.thumbnailUrl ??          // generic
    null

  // Caption/description — used to check for @ascendus_app mention
  const description =
    item.text ??          // TikTok clockworks
    item.desc ??          // TikTok alt
    item.caption ??       // Instagram
    item.alt ??           // Instagram alt text
    ''

  // Follower count — used to enforce bio link only for accounts ≥1k followers
  const follower_count =
    item.authorMeta?.fans ??        // TikTok clockworks
    item.authorMeta?.followers ??   // TikTok alt
    item.followersCount ??          // Instagram
    item.ownerFollowersCount ??     // Instagram alt
    0

  return { view_count, create_time, author_bio, description, follower_count, thumbnail_url }
}

/**
 * Scrape a creator profile bio for account verification.
 * @returns {{ bio: string }}
 */
export async function scrapeProfileBio(platform, handle) {
  const cleanHandle = handle.replace(/^@/, '')

  let actorId, input
  if (platform === 'tiktok') {
    actorId = 'clockworks/tiktok-scraper'
    input = { profiles: [`https://www.tiktok.com/@${cleanHandle}`], resultsPerPage: 1 }
  } else {
    actorId = 'apify/instagram-profile-scraper'
    input = { usernames: [cleanHandle] }
  }

  let run
  try {
    run = await client.actor(actorId).call(input, { waitSecs: TIMEOUT_SECS })
  } catch {
    throw new Error('TIMEOUT')
  }

  if (!run || run.status === 'TIMED-OUT') throw new Error('TIMEOUT')

  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1 })
  if (!items || items.length === 0) throw new Error('NO_RESULTS')

  const item = items[0]

  const bio = [
    item.authorMeta?.signature,
    item.authorMeta?.bioLink,
    item.authorMeta?.bioUrl,
    item.biography,
    item.externalUrl,
    item.externalUrlShimmed,
    item.bioLinks?.map(l => l.url ?? l).join(' '),
  ].filter(Boolean).join(' ')

  return { bio }
}

function normalizeUrl(u) {
  if (!u) return null
  return u.toLowerCase().replace(/\/+$/, '').split('?')[0]
}

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
    return new Map(videoUrls.map((u) => [u, new Error('ACTOR_FAILED')]))
  }

  const { items } = await client.dataset(run.defaultDatasetId).listItems({
    limit: videoUrls.length,
  })

  const result = new Map()

  for (const item of items ?? []) {
    const url =
      item.webVideoUrl ?? item.videoUrl ?? item.url ??
      (item.shortCode ? `https://www.instagram.com/reel/${item.shortCode}/` : null)

    if (!url) continue

    const view_count =
      item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? 0

    const raw_time = item.createTime ?? item.createTimeISO ?? item.timestamp ?? null
    const create_time = raw_time
      ? typeof raw_time === 'number'
        ? new Date(raw_time * 1000).toISOString()
        : new Date(raw_time).toISOString()
      : new Date().toISOString()

    const author_bio = item.authorMeta?.signature ?? item.biography ?? ''

    result.set(normalizeUrl(url), { view_count, create_time, author_bio })
  }

  for (const u of videoUrls) {
    if (!result.has(normalizeUrl(u))) result.set(normalizeUrl(u), new Error('NO_RESULTS'))
  }

  return result
}
