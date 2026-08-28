import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../../lib/supabase-server'
import { calcPayout } from '../../../../src/lib/payout'

const VALID_TIERS = ['standard', 'vip', 'custom', 'disqualified']

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
  return creator?.is_admin ? user : null
}

// Looks up the milestone table for a tier, preferring a creator-specific
// override (payout_tiers.creator_id = this creator) over the global one
// (creator_id is null). 'custom' only ever resolves via a creator-specific
// row -- there is no global 'custom' tier -- so an admin must configure one
// via payout_tiers before a submission can be saved as custom.
async function resolvePayoutTierMilestones(tierName, creatorId) {
  const { data: creatorRow } = await supabaseAdmin
    .from('payout_tiers')
    .select('milestones')
    .eq('name', tierName)
    .eq('creator_id', creatorId)
    .maybeSingle()
  if (creatorRow) return creatorRow.milestones

  if (tierName === 'custom') return null

  const { data: globalRow } = await supabaseAdmin
    .from('payout_tiers')
    .select('milestones')
    .eq('name', tierName)
    .is('creator_id', null)
    .maybeSingle()
  return globalRow?.milestones ?? null
}

export async function POST(request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { submissionId, action, submission_tier } = await request.json()
  if (!submissionId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  let update = {}

  if (action === 'approve') {
    update = { status: 'approved' }
  } else if (action === 'reject') {
    update = { status: 'rejected' }
  } else if (action === 'save_tier') {
    if (!VALID_TIERS.includes(submission_tier)) {
      return NextResponse.json({ error: 'Invalid submission_tier' }, { status: 400 })
    }

    // payout_amount is NEVER accepted from the client -- always computed
    // here, server-side, against payout_tiers + the submission's current
    // (Apify-synced) view count fetched fresh from the DB.
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('creator_id, current_views')
      .eq('id', submissionId)
      .single()
    if (fetchError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    let payout_amount = 0
    if (submission_tier !== 'disqualified') {
      const milestones = await resolvePayoutTierMilestones(submission_tier, submission.creator_id)
      if (!milestones) {
        return NextResponse.json(
          { error: `No payout_tiers row configured for tier "${submission_tier}"` },
          { status: 422 },
        )
      }
      payout_amount = calcPayout(milestones, submission.current_views ?? 0)
    }

    update = { submission_tier, payout_amount }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('submissions')
    .update(update)
    .eq('id', submissionId)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
