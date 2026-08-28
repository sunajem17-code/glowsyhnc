import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { extractUsAudiencePct } from '../../../../lib/claude'
import { calcPayout } from '../../../../src/lib/payout'

function tierFromUsPct(us_pct) {
  if (us_pct >= 20) return 'vip'
  if (us_pct >= 10) return 'standard'
  return 'disqualified'
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: creator } = await supabase.from('creators').select('is_admin').eq('id', user.id).single()
  if (!creator?.is_admin) return null
  return user
}

/** POST /api/admin/analyze-screenshot */
export async function POST(request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
