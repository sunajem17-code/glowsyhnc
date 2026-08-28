import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { getNextPayoutDate, formatPayoutDate } from '../../lib/payoutSchedule'



function CountdownCard({ nextPayout }) {
  const [now, setNow] = useState(Date.now())
  const target = nextPayout ? new Date(`${nextPayout.payout_date}T00:00:00`) : null

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [nextPayout])

  const ms = target ? Math.max(0, target.getTime() - now) : 0
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 px-5 py-6">
      {target ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold/70">Time left to submit for this pay period</p>
          <p className="mt-0.5 text-sm text-text-muted">Closes {formatPayoutDate(nextPayout.payout_date)}</p>
          <div className="mt-4 flex gap-3 sm:gap-5">
            {[{ v: pad(days), l: 'Days' }, { v: pad(hours), l: 'Hours' }, { v: pad(minutes), l: 'Min' }, { v: pad(seconds), l: 'Sec' }].map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="font-mono text-3xl sm:text-4xl font-bold text-gold leading-none">{v}</p>
                <p className="mt-1 text-xs text-text-muted/60 uppercase tracking-wide">{l}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-text-muted">No upcoming payout dates scheduled.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-gold/30 bg-gold/5' : 'border-border bg-surface'}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? 'text-gold' : 'text-text'}`}>{value}</p>
    </div>
  )
}

export function Dashboard() {
  const { creator } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({ verified: 0, unverified: 0, posts: 0, views: 0 })
  const [nextPayout, setNextPayout] = useState(null)
  const [linkedAccounts, setLinkedAccounts] = useState([])

  useEffect(() => {
    if (!creator) return
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      const [submissionsRes, milestonesRes, nextPayoutRes, accountsRes] = await Promise.allSettled([
        supabase.from('submissions').select('id, view_count_claimed').eq('creator_id', creator.id),
        supabase
          .from('milestones_hit')
          .select('amount, batch_date, submissions!inner(creator_id)')
          .eq('submissions.creator_id', creator.id),
        getNextPayoutDate(),
        supabase.from('creator_accounts').select('platform, handle, verified').eq('verified', true),
      ])

      if (!active) return

      if (submissionsRes.value?.error) {
        setError(submissionsRes.value.error.message)
        setLoading(false)
        return
      }
      if (milestonesRes.value?.error) {
        setError(milestonesRes.value.error.message)
        setLoading(false)
        return
      }
      if (nextPayoutRes.status === 'rejected') {
        setError(nextPayoutRes.reason?.message ?? 'Failed to load payout schedule')
        setLoading(false)
        return
      }

      const submissions = submissionsRes.value.data ?? []
      const milestones = milestonesRes.value.data ?? []

      const verified = milestones
        .filter((m) => m.batch_date)
        .reduce((sum, m) => sum + Number(m.amount), 0)
      const unverified = milestones
        .filter((m) => !m.batch_date)
        .reduce((sum, m) => sum + Number(m.amount), 0)
      const posts = submissions.length
      const views = submissions.reduce((sum, s) => sum + s.view_count_claimed, 0)

      setStats({ verified, unverified, posts, views })
      setNextPayout(nextPayoutRes.value)
      setLinkedAccounts(accountsRes.value?.data ?? [])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [creator])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Track your performance and earnings</p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard label="Total Paid Out" value={loading ? '—' : `$${stats.verified.toFixed(2)}`} highlight />
        <StatCard label="Videos Submitted" value={loading ? '—' : stats.posts.toLocaleString()} />
      </div>

      {/* Active accounts */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold text-text">Active Accounts</h2>
        {linkedAccounts.length === 0 ? (
          <div className="mt-3">
            <Link
              href="/dashboard/link-account"
              className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/5 px-4 py-2.5 text-sm font-medium text-gold hover:bg-gold/10 transition-colors"
            >
              + Link an Account to get started
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {linkedAccounts.map(acc => (
              <AccountRow key={`${acc.platform}-${acc.handle}`} platform={acc.platform} handle={acc.handle} />
            ))}
          </div>
        )}
      </div>

      {/* Countdown at bottom */}
      <CountdownCard nextPayout={nextPayout} />
    </div>
  )
}

function AccountRow({ platform, handle }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg px-4 py-3">
      {platform === 'tiktok' ? <TikTokIcon /> : <InstagramIcon />}
      <span className="text-sm font-medium text-text">@{handle?.replace(/^@/, '')}</span>
    </div>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-text-muted">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.75a8.26 8.26 0 004.84 1.56V6.85a4.85 4.85 0 01-1.07-.16z"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0 text-text-muted">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}
