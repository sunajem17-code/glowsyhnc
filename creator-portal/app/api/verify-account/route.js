import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../lib/supabase-server'
import { scrapeProfileBio } from '../../../lib/apify'

export async function POST(request) {
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { platform, handle: clientHandle } = body
  if (!['tiktok', 'instagram'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be tiktok or instagram' }, { status: 400 })
  }
  if (!clientHandle || typeof clientHandle !== 'string') {
    return NextResponse.json({ error: 'handle is required' }, { status: 400 })
  }

  const handle = clientHandle.replace(/^@/, '').toLowerCase()

  // Load creator's verification code
  const { data: creator, error: creatorErr } = await supabaseAdmin
    .from('creators')
    .select('verification_code')
    .eq('id', user.id)
    .single()

  if (creatorErr || !creator) {
    return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 })
  }

  const code = creator.verification_code
  if (!code) {
    return NextResponse.json({ error: 'No verification code found. Please reload and try again.' }, { status: 500 })
  }

  // Upsert a pending row in creator_accounts so the handle is registered
  await supabaseAdmin
    .from('creator_accounts')
    .upsert({
      creator_id: user.id,
      platform,
      handle,
      verification_code: code,
      verified: false,
    }, { onConflict: 'creator_id,platform,handle', ignoreDuplicates: false })

  // Scrape the bio to find the code
  let bio
  try {
    const result = await scrapeProfileBio(platform, handle)
    bio = result.bio
  } catch (err) {
    if (err.message === 'TIMEOUT') {
      return NextResponse.json({ error: 'Could not reach your profile — try again in a moment.' }, { status: 504 })
    }
    if (err.message === 'NO_RESULTS') {
      return NextResponse.json({ error: 'Profile not found. Double-check your link and try again.' }, { status: 422 })
    }
    console.error('[verify-account] Apify error', err)
    return NextResponse.json({ error: 'Could not verify — try again.' }, { status: 502 })
  }

  // Check if the code appears in the bio
  if (!bio.includes(code)) {
    return NextResponse.json(
      { error: `Verification code not found in your ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} bio. Make sure it's saved and public, then try again.` },
      { status: 422 }
    )
  }

  // Mark as verified in creator_accounts
  const { error: accountErr } = await supabaseAdmin
    .from('creator_accounts')
    .update({ verified: true })
    .eq('creator_id', user.id)
    .eq('platform', platform)
    .eq('handle', handle)

  if (accountErr) {
    return NextResponse.json({ error: accountErr.message }, { status: 500 })
  }

  // Also sync first linked handle back to creators table for submission ownership checks
  const handleField = platform === 'tiktok' ? 'tiktok_handle' : 'instagram_handle'
  const verifiedField = platform === 'tiktok' ? 'tiktok_verified' : 'instagram_verified'

  // Only set the single-column handle if none is set yet (first account for that platform)
  const { data: existingCreator } = await supabaseAdmin
    .from('creators')
    .select(handleField)
    .eq('id', user.id)
    .single()

  if (!existingCreator?.[handleField]) {
    await supabaseAdmin
      .from('creators')
      .update({ [handleField]: handle, [verifiedField]: true })
      .eq('id', user.id)
  } else {
    await supabaseAdmin
      .from('creators')
      .update({ [verifiedField]: true })
      .eq('id', user.id)
  }

  return NextResponse.json({ ok: true })
}
