export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '../../../lib/supabase-server'
import { SubmissionsTable } from './SubmissionsTable'

async function getAdminSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: creator } = await supabase
    .from('creators')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!creator?.is_admin) redirect('/dashboard')
  return user
}

export default async function AdminDashboardPage({ searchParams }) {
  await getAdminSession()

  const params = await searchParams
  const platform = params?.platform ?? 'all'
  const status   = params?.status   ?? 'all'
  const linkStatus = params?.linkStatus ?? 'all'
  const dateFrom = params?.dateFrom ?? null
  const dateTo   = params?.dateTo   ?? null

  let query = supabaseAdmin
    .from('submissions')
    .select(`
      id,
      video_url,
      platform,
      posted_at,
      initial_views,
      current_views,
      has_agency_link,
      submission_tier,
      status,
      payout_amount,
      proof_screenshot_url,
      admin_notes,
      created_at,
      creators ( id, discord_handle, tier )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (platform !== 'all') query = query.eq('platform', platform)
  if (status   !== 'all') query = query.eq('status',   status)
  if (linkStatus === 'verified') query = query.eq('has_agency_link', true)
  if (linkStatus === 'missing')  query = query.eq('has_agency_link', false)
  if (dateFrom) query = query.gte('posted_at', dateFrom)
  if (dateTo)   query = query.lte('posted_at', dateTo + 'T23:59:59Z')

  const { data: submissions, error } = await query

  if (error) {
    return (
      <div className="text-danger p-8">
        Failed to load submissions: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Submissions Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">
          {submissions?.length ?? 0} submissions
        </p>
      </div>
      <SubmissionsTable
        submissions={submissions ?? []}
        currentFilters={{ platform, status, linkStatus, dateFrom, dateTo }}
      />
    </div>
  )
}
